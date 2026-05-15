import { z } from "zod";
import { COOKIE_NAME, isAuthorizedEmail } from "@shared/const";
import { getSessionCookieOptions } from "./lib/cookies";
import { encrypt } from "./lib/crypto";
import { makeProcedureLimiter } from "./lib/rateLimit";
import { resolveActiveWinContract } from "./lib/winContract";
import {
  extractCandles,
  generateTechnicalSignal,
  generateFallbackSignal,
  type TechnicalSignal,
} from "./services/technicalAnalysis";
import { ENV } from "./config/env";
import {
  computeStats,
  getRecentPredictions,
  formatStatsForPrompt,
} from "./services/predictionStats";
import { fetchMarketNews, formatNewsForPrompt } from "./services/newsRss";
import { protectedProcedure, publicProcedure, router } from "./trpc";
import { getStockChart, extractQuoteMeta } from "./yahooFinance";
import { invokeLLM } from "./services/llm";
import { verifyPassword, createSessionToken } from "./auth";
import { THIRTY_DAYS_MS } from "@shared/const";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import {
  getTrades, insertTrade, updateTrade,
  getOcoConfig, upsertOcoConfig,
  getDailyPerformance, upsertDailyPerformance,
  getTradesByDateRange,
  getPredictions, insertPrediction, updatePredictionStatus,
  getUserSettings, upsertUserSettings,
  getInterCredentials, upsertInterCredentials,
} from "./db";

const loginRateCheck = makeProcedureLimiter({ windowMs: 15 * 60 * 1000, max: 5 });

// ─── Helpers para predictions.generate ────────────────────────────────────────

async function tryLLMSignal(args: {
  symbol: string;
  candles: ReturnType<typeof extractCandles>;
  ibovMeta: any;
  params: { stopLossPoints: number; takeProfitPoints: number; preferredContracts: number; riskProfile: "conservative" | "moderate" | "aggressive" };
  historyContext: string;
  newsContext: string;
}): Promise<TechnicalSignal | null> {
  const { symbol, candles, ibovMeta, params, historyContext, newsContext } = args;

  // Constrói contexto resumido para o LLM
  const lastClose = candles[candles.length - 1]?.close ?? 0;
  const prevClose = candles[candles.length - 2]?.close ?? 0;
  const high = Math.max(...candles.map((c) => c.high));
  const low = Math.min(...candles.map((c) => c.low));
  const avgVol = Math.round(
    candles.slice(-10).reduce((sum, c) => sum + c.volume, 0) / Math.max(1, Math.min(10, candles.length))
  );

  let marketContext = `${symbol}: Preço ${lastClose.toFixed(0)}, Anterior ${prevClose.toFixed(0)}, Máx ${high.toFixed(0)}, Mín ${low.toFixed(0)}, Volume médio ${avgVol.toLocaleString("pt-BR")}. `;
  if (ibovMeta?.regularMarketPrice) {
    marketContext += `Ibovespa: ${ibovMeta.regularMarketPrice.toFixed(0)} pts. `;
  }

  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const timeStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  const isOpeningHour = hour === 9 && minute < 30;
  const isLunchHour = hour >= 12 && hour < 13;
  const isClosingHour = hour >= 16 && hour < 17;

  const systemPrompt =
    "Você é um especialista em Day Trade do Mini Índice (WIN) na B3. " +
    "Use o HISTÓRICO do trader para calibrar sua confiança e o tipo de sinal. " +
    "Use as NOTÍCIAS para identificar catalisadores macro que possam afetar o intraday. " +
    "Responda SEMPRE em JSON válido com a estrutura exata especificada.";

  const userPrompt = `Analise o mercado e gere um sinal para ${symbol}.

CONTEXTO DE MERCADO:
${marketContext}

HORÁRIO: ${timeStr} (Brasília)
${isOpeningHour ? "⚠️ Abertura — volatilidade elevada." : ""}
${isLunchHour ? "⚠️ Almoço — liquidez reduzida." : ""}
${isClosingHour ? "⚠️ Pré-fechamento — risco de reversão." : ""}

PERFIL: ${params.riskProfile}. Stop ${params.stopLossPoints}pts. Gain ${params.takeProfitPoints}pts. ${params.preferredContracts} contratos.

${historyContext}

${newsContext}

Responda APENAS com o JSON especificado no schema.`;

  const llmResponse = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "trading_signal",
        strict: true,
        schema: {
          type: "object",
          properties: {
            signalType: { type: "string", enum: ["buy", "sell", "neutral", "avoid"] },
            confidence: { type: "integer" },
            entryZoneLow: { type: "number" },
            entryZoneHigh: { type: "number" },
            stopLoss: { type: "number" },
            takeProfit: { type: "number" },
            riskLevel: { type: "string", enum: ["low", "medium", "high"] },
            reasoning: { type: "string" },
            strategyExplanation: { type: "string" },
            keyLevels: { type: "array", items: { type: "string" } },
            marketBias: { type: "string", enum: ["bullish", "bearish", "sideways"] },
            suggestedContracts: { type: "integer" },
            validUntil: { type: "string" },
            warnings: { type: "array", items: { type: "string" } },
          },
          required: [
            "signalType", "confidence", "entryZoneLow", "entryZoneHigh", "stopLoss", "takeProfit",
            "riskLevel", "reasoning", "strategyExplanation", "keyLevels", "marketBias",
            "suggestedContracts", "validUntil", "warnings",
          ],
          additionalProperties: false,
        },
      },
    },
  });

  const content = (llmResponse as any)?.choices?.[0]?.message?.content;
  const parsed = typeof content === "string" ? JSON.parse(content) : content;
  if (!parsed) return null;

  return {
    ...parsed,
    indicators: {
      ema9: 0,
      ema21: 0,
      vwap: 0,
      rsi: 50,
      currentPrice: lastClose,
      high,
      low,
    },
  };
}

async function persistAndReturn(
  userId: number,
  symbol: string,
  signal: TechnicalSignal,
  generatedBy: "llm" | "technical" | "fallback"
) {
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  const prediction = await insertPrediction({
    userId,
    symbol,
    signalType: signal.signalType,
    confidence: Math.min(100, Math.max(0, signal.confidence)),
    entryZoneLow: String(signal.entryZoneLow),
    entryZoneHigh: String(signal.entryZoneHigh),
    stopLoss: String(signal.stopLoss),
    takeProfit: String(signal.takeProfit),
    reasoning: signal.reasoning,
    marketContext: JSON.stringify({
      generatedBy,
      strategyExplanation: signal.strategyExplanation,
      keyLevels: signal.keyLevels,
      marketBias: signal.marketBias,
      suggestedContracts: signal.suggestedContracts,
      validUntil: signal.validUntil,
      warnings: signal.warnings,
      indicators: signal.indicators,
    }),
    riskLevel: signal.riskLevel,
    expiresAt,
  });

  return {
    success: true,
    generatedBy,
    prediction: { ...prediction, parsed: signal },
  };
}

export const appRouter = router({
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    login: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const { TRPCError } = await import("@trpc/server");
        const ip = ctx.req.ip ?? ctx.req.socket.remoteAddress ?? "unknown";
        const rl = loginRateCheck(ip);
        if (!rl.allowed) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: `Muitas tentativas de login. Aguarde ${rl.retryAfter}s e tente novamente.`,
          });
        }
        if (!isAuthorizedEmail(input.email)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "E-mail n\u00e3o autorizado" });
        }
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indispon\u00edvel" });
        const result = await db.select().from(users).where(eq(users.email, input.email.toLowerCase().trim())).limit(1);
        const user = result[0];
        if (!user || !user.passwordHash) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Credenciais inv\u00e1lidas" });
        }
        const valid = await verifyPassword(input.password, user.passwordHash);
        if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Credenciais inv\u00e1lidas" });
        await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));
        const token = await createSessionToken(user.id, user.email ?? "", user.name ?? "");
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: THIRTY_DAYS_MS });
        return { success: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    checkAccess: publicProcedure.query(({ ctx }) => {
      if (!ctx.user) return { authorized: false, reason: "not_logged_in" };
      if (!isAuthorizedEmail(ctx.user.email)) {
        return { authorized: false, reason: "not_authorized" };
      }
      return { authorized: true, reason: null };
    }),
  }),

  // ─── MERCADO ──────────────────────────────────────────────────────────────
  market: router({
    getWinData: publicProcedure
      .input(z.object({
        interval: z.string().default("5m"),
        range: z.string().default("1d"),
      }))
      .query(async ({ input }) => {
        try {
          // getStockChart já tenta a cadeia WIN=F → ^BVSP internamente
          const result = await getStockChart({ symbol: "WIN=F", interval: input.interval, range: input.range });
          return {
            success: true,
            data: result,
            resolvedSymbol: result.resolvedSymbol ?? "WIN=F",
            fallback: result.resolvedSymbol !== "WIN=F",
            fetchedAt: new Date().toISOString(),
          };
        } catch {
          return { success: false, data: null, error: "Dados indisponíveis", fetchedAt: new Date().toISOString() };
        }
      }),

    getQuote: publicProcedure
      .input(z.object({ symbol: z.string().default("^BVSP") }))
      .query(async ({ input }) => {
        try {
          const result = await getStockChart({ symbol: input.symbol, interval: "1m", range: "1d" });
          return { success: true, data: result };
        } catch {
          return { success: false, data: null };
        }
      }),

    // Buscar múltiplos índices de uma vez: Ibovespa, IFIX, SMLL
    getIndices: publicProcedure.query(async () => {
      const symbols = [
        { symbol: "^BVSP", name: "Ibovespa", shortName: "IBOV" },
        { symbol: "IFIX.SA", name: "IFIX", shortName: "IFIX" },
        { symbol: "SMLL11.SA", name: "Small Caps", shortName: "SMLL" },
        { symbol: "USDBRL=X", name: "Dólar", shortName: "USD/BRL" },
        { symbol: "^TNX", name: "Juros EUA 10Y", shortName: "T10Y" },
      ];

      const results = await Promise.allSettled(
        symbols.map(async (s) => {
          const result = await getStockChart({ symbol: s.symbol, interval: "1d", range: "5d" });
          const extracted = extractQuoteMeta(result);
          return {
            ...s,
            price: extracted?.price ?? 0,
            change: extracted?.change ?? 0,
            changePct: extracted?.changePct ?? 0,
            high: extracted?.high ?? 0,
            low: extracted?.low ?? 0,
            volume: extracted?.volume ?? 0,
            prevClose: extracted?.prevClose ?? 0,
          };
        })
      );

      return symbols.map((s, i) => {
        const r = results[i];
        if (r?.status === "fulfilled") return r.value;
        return { ...s, price: 0, change: 0, changePct: 0, high: 0, low: 0, volume: 0, prevClose: 0, error: true };
      });
    }),

    // Notícias do mercado brasileiro via RSS do Google News (cache 10min)
    getNews: publicProcedure.query(async () => {
      const items = await fetchMarketNews();
      return { items: items.slice(0, 10) };
    }),

    // Contrato WIN ativo (resolvido dinamicamente por data)
    getActiveWinContract: publicProcedure.query(() => {
      const c = resolveActiveWinContract();
      return {
        symbol: c.symbol,
        yahooSymbol: c.yahooSymbol,
        expiry: c.expiry.toISOString(),
        expiryMonth: c.expiryMonth,
        expiryYear: c.expiryYear,
        monthCode: c.monthCode,
        daysToExpiry: c.daysToExpiry,
        nearExpiry: c.nearExpiry,
      };
    }),

    // Buscar top movers (maiores altas e baixas do dia)
    getTopMovers: publicProcedure.query(async () => {
      const stocks = [
        "PETR4.SA","VALE3.SA","ITUB4.SA","BBDC4.SA","ABEV3.SA",
        "WEGE3.SA","RENT3.SA","BBAS3.SA","SUZB3.SA","RADL3.SA",
        "MGLU3.SA","VBBR3.SA","GGBR4.SA","CSNA3.SA","USIM5.SA",
      ];
      const results = await Promise.allSettled(
        stocks.map(async (symbol) => {
          const result = await getStockChart({ symbol, interval: "1d", range: "5d" });
          const extracted = extractQuoteMeta(result);
          return {
            symbol: symbol.replace(".SA", ""),
            name: extracted?.name ?? symbol,
            price: extracted?.price ?? 0,
            change: extracted?.change ?? 0,
            changePct: extracted?.changePct ?? 0,
            volume: extracted?.volume ?? 0,
          };
        })
      );
      const data = results
        .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled" && r.value.price > 0)
        .map(r => r.value);
      const sorted = [...data].sort((a, b) => b.changePct - a.changePct);
      return {
        gainers: sorted.slice(0, 5),
        losers: sorted.slice(-5).reverse(),
        all: data,
      };
    }),
  }),

  // ─── PREDIÇÕES / IA ───────────────────────────────────────────────────────
  predictions: router({
    generate: protectedProcedure
      .input(z.object({
        symbol: z.string().default("WIN"),
        forceRefresh: z.boolean().default(false),
      }))
      .mutation(async ({ ctx, input }) => {
        // Resolver contrato WIN ativo (ex.: WINM26)
        const activeContract = resolveActiveWinContract();
        const displaySymbol = input.symbol === "WIN" ? activeContract.symbol : input.symbol;

        // Configurações do usuário
        const settings = await getUserSettings(ctx.user.id);
        const params = {
          stopLossPoints: settings?.stopLossPoints ?? 150,
          takeProfitPoints: settings?.takeProfitPoints ?? 250,
          preferredContracts: settings?.preferredContracts ?? 5,
          riskProfile: (settings?.riskProfile ?? "moderate") as "conservative" | "moderate" | "aggressive",
        };

        // Tentar buscar dados de mercado
        let winChart: any = null;
        let ibovMeta: any = null;
        try {
          const [winRes, ibovRes] = await Promise.allSettled([
            getStockChart({ symbol: activeContract.yahooSymbol, interval: "5m", range: "1d" }),
            getStockChart({ symbol: "^BVSP", interval: "1d", range: "5d" }),
          ]);
          if (winRes.status === "fulfilled") winChart = winRes.value;
          if (ibovRes.status === "fulfilled") ibovMeta = ibovRes.value?.chart?.result?.[0]?.meta;
        } catch {
          /* segue para fallback */
        }

        const candles = winChart ? extractCandles(winChart) : [];
        const hasMarketData = candles.length >= 21;

        // ─── CAMADA 1: LLM (se OPENAI_API_KEY estiver setada E houver dados) ───
        if (ENV.openaiApiKey && hasMarketData) {
          try {
            // Memória 30d: histórico do próprio usuário para calibrar a IA
            const history = await getRecentPredictions(ctx.user.id, 30);
            const historyContext = formatStatsForPrompt(computeStats(history));

            // News RSS: catalisadores macro recentes (Brasil)
            const news = await fetchMarketNews().catch(() => []);
            const newsContext = formatNewsForPrompt(news);

            const llmSignal = await tryLLMSignal({
              symbol: displaySymbol,
              candles,
              ibovMeta,
              params,
              historyContext,
              newsContext,
            });
            if (llmSignal) {
              return await persistAndReturn(ctx.user.id, displaySymbol, llmSignal, "llm");
            }
          } catch (err) {
            console.warn("[predictions.generate] LLM failed, falling to technical:", err);
          }
        }

        // ─── CAMADA 2: Análise técnica determinística ───
        if (hasMarketData) {
          const techSignal = generateTechnicalSignal(candles, params);
          return await persistAndReturn(ctx.user.id, displaySymbol, techSignal, "technical");
        }

        // ─── CAMADA 3: Fallback baseado em horário ───
        const fallbackSignal = generateFallbackSignal(new Date(), {
          preferredContracts: params.preferredContracts,
        });
        return await persistAndReturn(ctx.user.id, displaySymbol, fallbackSignal, "fallback");
      }),

    list: protectedProcedure
      .input(z.object({ limit: z.number().default(10) }))
      .query(async ({ ctx, input }) => {
        return getPredictions(ctx.user.id, input.limit);
      }),

    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["executed", "ignored", "won", "lost", "expired"]),
      }))
      .mutation(async ({ ctx, input }) => {
        return updatePredictionStatus(input.id, ctx.user.id, input.status);
      }),
  }),

  // ─── CONFIGURAÇÕES DO USUÁRIO ─────────────────────────────────────────────
  userSettings: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      return getUserSettings(ctx.user.id);
    }),

    save: protectedProcedure
      .input(z.object({
        preferredContracts: z.number().min(1).max(15).optional(),
        riskProfile: z.enum(["conservative", "moderate", "aggressive"]).optional(),
        dailyGoal: z.number().min(100).max(50000).optional(),
        dailyLimit: z.number().min(100).max(50000).optional(),
        stopLossPoints: z.number().min(50).max(300).optional(),
        takeProfitPoints: z.number().min(50).max(500).optional(),
        enableAiPredictions: z.boolean().optional(),
        enableSoundAlerts: z.boolean().optional(),
        enableAutoBreakeven: z.boolean().optional(),
        pauseAfterLosses: z.number().min(1).max(10).optional(),
        requireOrderConfirmation: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { dailyGoal, dailyLimit, ...rest } = input;
        return upsertUserSettings(ctx.user.id, {
          ...rest,
          ...(dailyGoal !== undefined ? { dailyGoal: String(dailyGoal) as unknown as any } : {}),
          ...(dailyLimit !== undefined ? { dailyLimit: String(dailyLimit) as unknown as any } : {}),
        });
      }),

    toggleTradingPause: protectedProcedure.mutation(async ({ ctx }) => {
      const current = await getUserSettings(ctx.user.id);
      const next = !(current?.tradingPaused ?? false);
      await upsertUserSettings(ctx.user.id, { tradingPaused: next });
      return { tradingPaused: next };
    }),

    toggleLiveTrading: protectedProcedure
      .input(z.object({ enabled: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        // Live Trading = modo de orientação ativa da IA (auto-refresh, alertas,
        // painel em destaque). NÃO envia ordens reais sozinho — o envio real só
        // acontece quando a integração Banco Inter estiver `active` (hoje mock).
        // Por isso o toggle é livre; o PaperTradingBanner continua mostrando
        // SIMULAÇÃO até o Inter estar realmente ativo.
        const creds = await getInterCredentials(ctx.user.id);
        const interActive = creds?.status === "active";
        await upsertUserSettings(ctx.user.id, { enableLiveTrading: input.enabled });
        return {
          enableLiveTrading: input.enabled,
          interActive,
          mode: input.enabled && interActive ? "live" : input.enabled ? "orientation" : "off",
        };
      }),
  }),

  // ─── INTEGRAÇÃO BANCO INTER ───────────────────────────────────────────────
  inter: router({
    getCredentials: protectedProcedure.query(async ({ ctx }) => {
      const creds = await getInterCredentials(ctx.user.id);
      if (!creds) return null;
      // Nunca retornar o secret hash
      return {
        id: creds.id,
        clientId: creds.clientId,
        certFingerprint: creds.certFingerprint,
        accountNumber: creds.accountNumber,
        environment: creds.environment,
        status: creds.status,
        lastTestedAt: creds.lastTestedAt,
        lastError: creds.lastError,
      };
    }),

    saveCredentials: protectedProcedure
      .input(z.object({
        clientId: z.string().min(1),
        clientSecret: z.string().min(1),
        accountNumber: z.string().optional(),
        environment: z.enum(["sandbox", "production"]).default("sandbox"),
      }))
      .mutation(async ({ ctx, input }) => {
        const encryptedSecret = encrypt(input.clientSecret);
        await upsertInterCredentials(ctx.user.id, {
          clientId: input.clientId,
          clientSecretHash: encryptedSecret,
          accountNumber: input.accountNumber,
          environment: input.environment,
          status: "pending",
        });
        return { success: true };
      }),

    testConnection: protectedProcedure.mutation(async ({ ctx }) => {
      const creds = await getInterCredentials(ctx.user.id);
      if (!creds || !creds.clientId) {
        return { success: false, error: "Credenciais não configuradas." };
      }
      // Simular teste de conexão (integração real requer certificado mTLS)
      // Em produção: fazer requisição OAuth2 ao Inter com mTLS
      const isConfigured = creds.clientId && creds.clientSecretHash;
      if (isConfigured) {
        await upsertInterCredentials(ctx.user.id, {
          status: "active",
          lastTestedAt: new Date(),
          lastError: undefined,
        });
        return {
          success: true,
          message: "Configuração validada. Para ativação completa, o certificado mTLS deve ser instalado no servidor.",
          environment: creds.environment,
        };
      }
      return { success: false, error: "Credenciais incompletas." };
    }),

    getSetupGuide: publicProcedure.query(() => {
      return {
        steps: [
          {
            step: 1,
            title: "Abrir Conta PJ no Banco Inter",
            description: "Acesse inter.co e abra uma conta PJ. Ative o módulo de Investimentos e solicite acesso à API de Investimentos.",
            url: "https://inter.co/empresas/conta-digital/",
            required: true,
          },
          {
            step: 2,
            title: "Acessar o Inter Developer Portal",
            description: "Acesse developers.inter.co, faça login com sua conta PJ e crie uma nova aplicação.",
            url: "https://developers.inter.co",
            required: true,
          },
          {
            step: 3,
            title: "Gerar Certificado mTLS",
            description: "No portal do desenvolvedor, gere o par de chaves (certificado .crt e chave privada .key). Este certificado é obrigatório para autenticação.",
            codeExample: `# Gerar chave privada e certificado auto-assinado
openssl req -x509 -newkey rsa:2048 -keyout chave_privada.key \\
  -out certificado.crt -days 365 -nodes \\
  -subj "/C=BR/ST=SP/L=SaoPaulo/O=SeuNome/CN=inter-api"`,
            required: true,
          },
          {
            step: 4,
            title: "Registrar Aplicação e Obter Credenciais",
            description: "No portal, registre sua aplicação e copie o client_id e client_secret. Selecione os escopos: extrato.read, bolsa.read, bolsa.trade.",
            scopes: ["extrato.read", "bolsa.read", "bolsa.trade", "carteira.read"],
            required: true,
          },
          {
            step: 5,
            title: "Configurar Credenciais no Sistema",
            description: "Insira o client_id e client_secret no formulário abaixo. O certificado mTLS deve ser instalado no servidor pelo administrador.",
            required: true,
          },
        ],
        endpoints: {
          sandbox: "https://cdpj.partners.bancointer.com.br",
          production: "https://cdpj.partners.bancointer.com.br",
          auth: "/oauth/v2/token",
          balance: "/banking/v3/saldo",
          portfolio: "/investimentos/v1/carteira",
          order: "/investimentos/v1/ordens",
        },
        profitOneComparison: [
          { feature: "Gráfico de Candlestick", profitOne: true, thisSystem: true },
          { feature: "SuperDOM (Book de Ofertas)", profitOne: true, thisSystem: true },
          { feature: "Times & Trades", profitOne: true, thisSystem: true },
          { feature: "Ordens OCO (Stop + Gain)", profitOne: true, thisSystem: true },
          { feature: "Análise Preditiva com IA", profitOne: false, thisSystem: true },
          { feature: "Painel de Resumo Diário", profitOne: false, thisSystem: true },
          { feature: "Calendário Econômico", profitOne: false, thisSystem: true },
          { feature: "Alertas Sonoros Customizáveis", profitOne: false, thisSystem: true },
          { feature: "Calculadora de Risco Integrada", profitOne: false, thisSystem: true },
          { feature: "Integração Banco Inter", profitOne: false, thisSystem: true },
        ],
      };
    }),
  }),

  // ─── TRADES ───────────────────────────────────────────────────────────────
  trades: router({
    registerTrade: protectedProcedure
      .input(z.object({
        symbol: z.string().default("WIN"),
        side: z.enum(["buy", "sell"]),
        contracts: z.number().min(1).max(15),
        entryPrice: z.number(),
        exitPrice: z.number(),
        stopLoss: z.number().optional(),
        takeProfit: z.number().optional(),
        pnlPoints: z.number(),
        pnlBrl: z.number(),
        reason: z.enum(["take_profit", "stop_loss", "manual"]),
        durationMs: z.number().optional(),
        entryAt: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const isWin = input.pnlBrl > 0;
        const status = input.reason === "take_profit" ? "target" :
                       input.reason === "stop_loss" ? "stopped" : "closed";
        const entryAt = input.entryAt ? new Date(input.entryAt) : new Date();
        const exitAt = new Date();

        await insertTrade({
          userId: ctx.user.id,
          symbol: input.symbol,
          side: input.side,
          contracts: input.contracts,
          entryPrice: String(input.entryPrice),
          exitPrice: String(input.exitPrice),
          stopLoss: input.stopLoss ? String(input.stopLoss) : undefined,
          takeProfit: input.takeProfit ? String(input.takeProfit) : undefined,
          pnl: String(input.pnlBrl),
          pnlPoints: String(input.pnlPoints),
          status,
          entryAt,
          exitAt,
        });

        const today = new Date().toISOString().split("T")[0]!;
        const existing = await getDailyPerformance(ctx.user.id, 1);
        const todayPerf = existing.find(p => p.date === today);
        const prevPnl = todayPerf ? Number(todayPerf.totalPnl) : 0;
        const prevPts = todayPerf ? Number(todayPerf.totalPnlPoints) : 0;
        const newPnl = prevPnl + input.pnlBrl;
        const newPts = prevPts + input.pnlPoints;
        const prevDrawdown = todayPerf ? Number(todayPerf.maxDrawdown) : 0;
        const newDrawdown = newPnl < 0 ? Math.min(prevDrawdown, newPnl) : prevDrawdown;

        await upsertDailyPerformance(ctx.user.id, today, {
          totalPnl: String(newPnl) as unknown as any,
          totalPnlPoints: String(newPts) as unknown as any,
          tradesCount: (todayPerf?.tradesCount ?? 0) + 1,
          winsCount: (todayPerf?.winsCount ?? 0) + (isWin ? 1 : 0),
          lossesCount: (todayPerf?.lossesCount ?? 0) + (isWin ? 0 : 1),
          maxDrawdown: String(newDrawdown) as unknown as any,
        });

        return { success: true, pnlBrl: input.pnlBrl, isWin };
      }),

    getDailySummary: protectedProcedure.query(async ({ ctx }) => {
      const today = new Date().toISOString().split("T")[0]!;
      const [todayTrades, perfData] = await Promise.all([
        getTradesByDateRange(ctx.user.id, today, today),
        getDailyPerformance(ctx.user.id, 1),
      ]);
      const todayPerf = perfData.find(p => p.date === today);

      const sorted = [...todayTrades].sort((a, b) =>
        new Date(a.entryAt).getTime() - new Date(b.entryAt).getTime()
      );
      let streak = 0;
      let streakType: "win" | "loss" | null = null;
      for (let i = sorted.length - 1; i >= 0; i--) {
        const t = sorted[i];
        if (!t) break;
        const isWin = Number(t.pnl ?? 0) > 0;
        if (streakType === null) {
          streakType = isWin ? "win" : "loss";
          streak = 1;
        } else if ((streakType === "win") === isWin) {
          streak++;
        } else {
          break;
        }
      }

      let cumPnl = 0;
      const equityCurve = sorted
        .filter(t => t.exitAt !== null)
        .map(t => {
          cumPnl += Number(t.pnl ?? 0);
          return {
            time: t.exitAt ? new Date(t.exitAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "",
            pnl: Math.round(cumPnl * 100) / 100,
          };
        });

      const tradesCount = todayPerf?.tradesCount ?? 0;
      const winsCount = todayPerf?.winsCount ?? 0;
      const lossesCount = todayPerf?.lossesCount ?? 0;
      const winRate = tradesCount > 0 ? Math.round((winsCount / tradesCount) * 1000) / 10 : 0;

      return {
        date: today,
        totalPnlBrl: Math.round(Number(todayPerf?.totalPnl ?? 0) * 100) / 100,
        totalPnlPoints: Math.round(Number(todayPerf?.totalPnlPoints ?? 0) * 10) / 10,
        tradesCount,
        winsCount,
        lossesCount,
        winRate,
        maxDrawdown: Math.round(Number(todayPerf?.maxDrawdown ?? 0) * 100) / 100,
        streak,
        streakType,
        equityCurve,
        trades: sorted.map(t => ({
          id: t.id,
          side: t.side,
          contracts: t.contracts,
          entryPrice: Number(t.entryPrice),
          exitPrice: t.exitPrice ? Number(t.exitPrice) : null,
          pnlPoints: t.pnlPoints ? Number(t.pnlPoints) : null,
          pnlBrl: t.pnl ? Number(t.pnl) : null,
          status: t.status,
          entryAt: t.entryAt,
          exitAt: t.exitAt,
        })),
      };
    }),

    list: protectedProcedure
      .input(z.object({ limit: z.number().default(50), offset: z.number().default(0) }))
      .query(async ({ ctx, input }) => getTrades(ctx.user.id, input.limit, input.offset)),

    create: protectedProcedure
      .input(z.object({
        symbol: z.string().default("WIN"),
        side: z.enum(["buy", "sell"]),
        contracts: z.number().min(1).max(100),
        entryPrice: z.number(),
        stopLoss: z.number().optional(),
        takeProfit: z.number().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return insertTrade({
          userId: ctx.user.id,
          symbol: input.symbol,
          side: input.side,
          contracts: input.contracts,
          entryPrice: String(input.entryPrice),
          stopLoss: input.stopLoss ? String(input.stopLoss) : undefined,
          takeProfit: input.takeProfit ? String(input.takeProfit) : undefined,
          notes: input.notes,
          status: "open",
        });
      }),

    close: protectedProcedure
      .input(z.object({
        id: z.number(),
        exitPrice: z.number(),
        status: z.enum(["closed", "stopped", "target"]),
      }))
      .mutation(async ({ ctx, input }) => {
        return updateTrade(input.id, ctx.user.id, {
          exitPrice: String(input.exitPrice),
          status: input.status,
          exitAt: new Date(),
        });
      }),

    getByDateRange: protectedProcedure
      .input(z.object({ startDate: z.string(), endDate: z.string() }))
      .query(async ({ ctx, input }) => getTradesByDateRange(ctx.user.id, input.startDate, input.endDate)),
  }),

  // ─── OCO ──────────────────────────────────────────────────────────────────
  oco: router({
    get: protectedProcedure.query(async ({ ctx }) => getOcoConfig(ctx.user.id)),
    save: protectedProcedure
      .input(z.object({
        name: z.string().default("Estratégia Padrão"),
        stopLossPoints: z.number().min(100).max(150),
        takeProfitPoints: z.number().min(150).max(250),
        breakevenTriggerPoints: z.number().default(100),
        trailingStopPoints: z.number().default(50),
        trailingStopTriggerPoints: z.number().default(150),
        defaultContracts: z.number().min(1).max(15),
      }))
      .mutation(async ({ ctx, input }) => upsertOcoConfig(ctx.user.id, input)),
  }),

  // ─── PERFORMANCE ──────────────────────────────────────────────────────────
  performance: router({
    getDaily: protectedProcedure
      .input(z.object({ days: z.number().default(30) }))
      .query(async ({ ctx, input }) => getDailyPerformance(ctx.user.id, input.days)),

    getSummary: protectedProcedure.query(async ({ ctx }) => {
      const today = new Date().toISOString().split("T")[0];
      const perf = await getDailyPerformance(ctx.user.id, 30);
      const todayPerf = perf.find(p => p.date === today);
      const totalPnl = perf.reduce((sum: number, p) => sum + Number(p.totalPnl), 0);
      const totalTrades = perf.reduce((sum: number, p) => sum + p.tradesCount, 0);
      const totalWins = perf.reduce((sum: number, p) => sum + p.winsCount, 0);
      const winRate = totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0;
      return {
        todayPnl: todayPerf ? Number(todayPerf.totalPnl) : 0,
        totalPnl30d: totalPnl,
        winRate: Math.round(winRate * 10) / 10,
        totalTrades30d: totalTrades,
        dailyData: perf,
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
