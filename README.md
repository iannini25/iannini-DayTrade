# Iannini Day Trade Workspace

Plataforma interna de day trade no Mini Índice (WIN) usada pelos traders da família Iannini. Foco em fidelidade ao método operacional do Túlio Iannini, gestão de risco rigorosa e rastreabilidade de operações.

## ⚠️ Aviso

Este sistema **não é conselho financeiro**. Day trade envolve risco real de perda. A plataforma opera por padrão em **modo simulação (paper trading)** — nenhuma ordem é enviada para corretora real. A integração com o Banco Inter (mTLS + OAuth2) deve ser configurada e validada antes de qualquer operação com dinheiro real, e ainda assim recomendamos cautela e confirmação manual.

## Stack

- **Frontend:** React 19 + TypeScript + Tailwind 4 + shadcn/ui + Lightweight Charts + wouter
- **Backend:** Node.js 22 + Express 4 + tRPC 11 + Drizzle ORM + MySQL 8
- **Auth:** JWT (jose) + bcryptjs + whitelist de e-mails (3 traders autorizados)
- **Segurança:** AES-256-GCM para segredos do Inter, rate limit no login, kill switch global, confirmação dupla de ordens
- **Infra:** PM2 + Nginx + Let's Encrypt (Certbot) + Hostinger VPS

## Desenvolvimento local

**Pré-requisitos:** Node 22+, pnpm 10+, MySQL 8+ rodando localmente.

```bash
# 1. Instalar dependências
pnpm install

# 2. Configurar .env
cp env-template.txt .env
# Edite .env: DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY (instruções dentro do arquivo)

# 3. Rodar migrations
pnpm db:migrate

# 4. Subir o servidor
pnpm dev

# 5. Criar o primeiro usuário (em outro terminal, com o servidor rodando OU usando o seed direto)
node scripts/seed-user.mjs tulio.iannini@gmail.com SenhaSegura123 "Túlio Iannini"
```

Acesso: http://localhost:3000

## Whitelist de acesso

Apenas estes e-mails podem se autenticar (definidos em [`shared/const.ts`](shared/const.ts)):

- `tulio.iannini@gmail.com`
- `lucaszbr@gmail.com`
- `bernardo.iannini14@gmail.com`

Para alterar, edite o array `AUTHORIZED_EMAILS`.

## Deploy em VPS

Ver [`GUIA_VPS_IANNINI_DAYTRADE.md`](GUIA_VPS_IANNINI_DAYTRADE.md) — passo-a-passo completo: setup Ubuntu, MySQL, PM2, Nginx, Certbot.

Comando único para atualizar depois de já estar no ar:

```bash
cd /var/www/ianninidaytrade && \
  git pull && pnpm install --frozen-lockfile && \
  pnpm db:migrate && pnpm build && \
  pm2 restart iannini-daytrade
```

## Estrutura

```
├── client/                  # Frontend React
│   ├── public/
│   └── src/
│       ├── components/      # UI components (shadcn/ui + trading)
│       ├── contexts/
│       ├── hooks/           # useAuth, useTradingAlerts, useTradingAutomations
│       ├── lib/             # trpc client, audio engine, utils
│       └── pages/           # Workspace, Predictions, MarketOverview, ...
├── server/
│   ├── index.ts             # Bootstrap (Express + tRPC + Vite/static)
│   ├── auth.ts              # Login / logout / setup / change-password (REST)
│   ├── routers.ts           # tRPC procedures (market, predictions, trades, oco, inter, userSettings...)
│   ├── db.ts                # Helpers Drizzle (insert/upsert/select)
│   ├── yahooFinance.ts      # Cliente Yahoo Finance (não-oficial)
│   ├── config/env.ts        # Validação de env (assertRequiredEnv)
│   ├── lib/                 # Cookies, crypto AES-GCM, rate limit, vite dev
│   ├── services/llm.ts      # Cliente OpenAI-compatível
│   └── trpc/                # Context + procedures base
├── shared/const.ts          # Constantes compartilhadas (cookie name, whitelist, TTL)
├── drizzle/
│   ├── schema.ts            # Definição das tabelas
│   ├── 0000..0004_*.sql     # Migrations versionadas
│   └── relations.ts
├── scripts/
│   ├── create-user.mjs      # Cria usuário via API HTTP (servidor precisa estar rodando)
│   └── seed-user.mjs        # Cria/atualiza usuário direto no banco
├── nginx.conf               # Reverse proxy + WebSocket upgrade
├── ecosystem.config.cjs     # PM2 config
└── setup-vps.sh             # Script idempotente para preparar VPS Ubuntu
```

## Funcionalidades principais

- **Workspace** — gráfico candlestick com VWAP/EMA9/EMA21, SuperDOM (book), Times & Trades, alertas sonoros customizáveis
- **Análise IA** — gera sinais via OpenAI/Anthropic-compatible com base em dados de mercado e perfil do trader
- **Performance** — P&L diário, equity curve, win-rate, drawdown
- **Kill Switch** — botão no header pausa todo envio de ordens
- **Paper Trading** — banner persistente; Live Trading só ativa se Inter estiver `active`
- **Confirmação dupla** — modal de revisão antes de cada ordem (toggleável em Configurações)
- **Limite diário** — bloqueia operações ao atingir `-dailyLimit`; alerta ao atingir `+dailyGoal`
- **Integração Banco Inter** — clientSecret criptografado AES-256-GCM, mTLS pendente

## Comandos úteis

| Comando | Descrição |
|---|---|
| `pnpm dev` | Dev server (Vite + tsx watch) |
| `pnpm build` | Build de produção (vite + esbuild) |
| `pnpm start` | Roda o build de produção |
| `pnpm check` | TypeScript check (`tsc --noEmit`) |
| `pnpm test` | Vitest (138 testes) |
| `pnpm db:generate` | Gera nova migration a partir do schema |
| `pnpm db:migrate` | Aplica migrations pendentes |
| `pnpm db:seed` | Cria usuário direto no banco |
| `pnpm format` | Prettier |
