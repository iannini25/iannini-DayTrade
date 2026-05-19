import { useState, useMemo, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  GraduationCap, Check, X, ArrowRight, Copy, TrendingUp,
  TrendingDown, Trophy, RotateCcw,
} from "lucide-react";
import { getRefetchInterval } from "@/hooks/useRefetchInterval";
import { useSignalAlert } from "@/hooks/useSignalAlert";
import { generateNtslCode } from "@shared/ntslGenerator";

type Step = 1 | 2 | 3 | 4 | 5;

function isGoodHour(now: Date): boolean {
  const h = (now.getUTCHours() - 3 + 24) % 24;
  const m = now.getUTCMinutes();
  const t = h + m / 60;
  return (t >= 9.25 && t <= 11.75) || (t >= 14.0 && t <= 16.5);
}

export default function Iniciante() {
  const [step, setStep] = useState<Step>(1);
  const [entered, setEntered] = useState(false);

  const { data: marketData } = trpc.market.getWinData.useQuery(
    { interval: "5m", range: "1d" },
    { refetchInterval: getRefetchInterval }
  );
  const { data: predictions } = trpc.predictions.list.useQuery(
    { limit: 1 },
    { refetchInterval: 60_000 }
  );
  const { data: summary } = trpc.trades.getDailySummary.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  const { data: settings } = trpc.userSettings.get.useQuery();
  const registerTrade = trpc.trades.registerTrade.useMutation();
  const { playAlert } = useSignalAlert();

  const latest = predictions?.[0];
  const ctx = useMemo(() => {
    if (!latest?.marketContext) return {} as any;
    try { return JSON.parse(latest.marketContext); } catch { return {}; }
  }, [latest]);

  const b3 = (marketData as any)?.b3 ?? null;
  const yahooPrice = (marketData as any)?.data?.chart?.result?.[0]?.meta?.regularMarketPrice ?? 0;
  const currentPrice = b3?.price && b3.price > 0 ? b3.price : yahooPrice;

  const ema9 = ctx.indicators?.ema9 ?? 0;
  const ema21 = ctx.indicators?.ema21 ?? 0;
  const vwap = ctx.indicators?.vwap ?? 0;
  const confidence = latest?.confidence ?? 0;
  const dailyLimit = settings?.dailyLimit ? Number(settings.dailyLimit) : 1000;
  const todayPnl = summary?.totalPnlBrl ?? 0;

  // Estado 1 — checklist
  const checks = [
    { label: "Horário adequado para operar", ok: isGoodHour(new Date()) },
    { label: "Mercado com tendência definida (EMA9 ≠ EMA21)", ok: ema9 > 0 && ema21 > 0 && Math.abs(ema9 - ema21) > 5 },
    { label: "Preço posicionado vs VWAP", ok: vwap > 0 && currentPrice > 0 },
    { label: "Confiança da IA ≥ 60%", ok: confidence >= 60 },
    { label: "Limite diário de perda não atingido", ok: todayPnl > -dailyLimit },
  ];
  const allGreen = checks.every((c) => c.ok);

  const entry = Math.round(((Number(latest?.entryZoneLow ?? 0)) + (Number(latest?.entryZoneHigh ?? 0))) / 2);
  const stop = Number(latest?.stopLoss ?? 0);
  const target = Number(latest?.takeProfit ?? 0);
  const contracts = ctx.suggestedContracts ?? settings?.preferredContracts ?? 5;
  const stopPts = Math.abs(entry - stop);
  const gainPts = Math.abs(target - entry);
  const riskBrl = stopPts * 0.2 * contracts;
  const gainBrl = gainPts * 0.2 * contracts;
  const sig = latest?.signalType ?? "neutral";

  const ntsl = useMemo(
    () =>
      latest
        ? generateNtslCode({
            entryPrice: entry, stopLossPoints: stopPts, takeProfitPoints: gainPts,
            contracts, signalType: sig as any,
            breakevenPoints: (settings as any)?.breakevenTriggerPoints ?? 100,
          })
        : "",
    [latest, entry, stopPts, gainPts, contracts, sig, settings]
  );

  // Estado 4 — alertas de proximidade
  const alertedRef = useRef({ stop: false, target: false });
  useEffect(() => {
    if (step !== 4 || !entered || currentPrice <= 0) return;
    if (!alertedRef.current.stop && Math.abs(currentPrice - stop) < 30) {
      alertedRef.current.stop = true;
      playAlert("sell");
      toast.error("⚠️ Preço próximo do STOP (< 30 pontos)");
    }
    if (!alertedRef.current.target && Math.abs(currentPrice - target) < 30) {
      alertedRef.current.target = true;
      playAlert("buy");
      toast.success("🎯 Preço próximo do ALVO (< 30 pontos)");
    }
  }, [currentPrice, step, entered, stop, target, playAlert]);

  const progressPct = useMemo(() => {
    if (!entered || stop === target) return 50;
    const lo = Math.min(stop, target);
    const hi = Math.max(stop, target);
    return Math.max(0, Math.min(100, ((currentPrice - lo) / (hi - lo)) * 100));
  }, [currentPrice, stop, target, entered]);

  const finishTrade = async (outcome: "win" | "loss" | "zero") => {
    const pnlBrl = outcome === "win" ? gainBrl : outcome === "loss" ? -riskBrl : 0;
    const pnlPoints = outcome === "win" ? gainPts : outcome === "loss" ? -stopPts : 0;
    try {
      await registerTrade.mutateAsync({
        symbol: "WIN",
        side: sig === "sell" ? "sell" : "buy",
        contracts,
        entryPrice: entry,
        exitPrice: outcome === "win" ? target : outcome === "loss" ? stop : entry,
        stopLoss: stop,
        takeProfit: target,
        pnlPoints,
        pnlBrl,
        reason: outcome === "win" ? "take_profit" : outcome === "loss" ? "stop_loss" : "manual",
        entryAt: new Date().toISOString(),
      });
      toast.success("Operação registrada");
    } catch {
      toast.error("Falha ao registrar — anote manualmente");
    }
    setStep(5);
  };

  const reset = () => {
    setStep(1);
    setEntered(false);
    alertedRef.current = { stop: false, target: false };
  };

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <GraduationCap className="w-6 h-6 text-primary" />
          Modo Iniciante
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Uma decisão de cada vez, sem jargão. Passo {step} de 5.
        </p>
      </div>

      {/* ESTADO 1 — Checklist */}
      {step === 1 && (
        <Card className="border-border" style={{ background: "oklch(0.10 0.01 240)" }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Antes de operar — está tudo certo?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {checks.map((c, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                {c.ok ? (
                  <Check className="w-4 h-4 text-buy shrink-0" />
                ) : (
                  <X className="w-4 h-4 text-sell shrink-0" />
                )}
                <span className={c.ok ? "text-foreground" : "text-muted-foreground"}>{c.label}</span>
              </div>
            ))}
            {allGreen ? (
              <Button className="w-full mt-3 gap-2" onClick={() => setStep(2)}>
                Estou pronto para operar <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <p className="text-xs text-amber-400 mt-3">
                Ainda não é o momento ideal. Aguarde os itens acima ficarem verdes — operar fora de
                condição é o erro nº 1 do iniciante.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ESTADO 2 — O que fazer */}
      {step === 2 && (
        <Card className={`border ${sig === "buy" ? "border-buy/40" : sig === "sell" ? "border-sell/40" : "border-amber-400/40"}`} style={{ background: "oklch(0.10 0.01 240)" }}>
          <CardContent className="p-5 space-y-3 text-center">
            <div className="flex items-center justify-center gap-2 text-lg font-bold">
              {sig === "buy" ? <TrendingUp className="w-6 h-6 text-buy" /> : sig === "sell" ? <TrendingDown className="w-6 h-6 text-sell" /> : null}
              A IA sugere: <span className={sig === "buy" ? "text-buy" : sig === "sell" ? "text-sell" : "text-amber-400"}>
                {sig === "buy" ? "COMPRAR" : sig === "sell" ? "VENDER" : sig === "avoid" ? "NÃO OPERAR" : "AGUARDAR"}
              </span>
            </div>
            {(sig === "buy" || sig === "sell") ? (
              <>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div><p className="text-muted-foreground text-xs">Entrada</p><p className="font-trading font-bold">{entry.toLocaleString("pt-BR")}</p></div>
                  <div><p className="text-muted-foreground text-xs">Stop</p><p className="font-trading font-bold text-sell">{stop.toLocaleString("pt-BR")}</p></div>
                  <div><p className="text-muted-foreground text-xs">Alvo</p><p className="font-trading font-bold text-buy">{target.toLocaleString("pt-BR")}</p></div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Se atingir o alvo, você ganha <strong className="text-buy">R$ {gainBrl.toFixed(2)}</strong>.
                  Se bater o stop, perde <strong className="text-sell">R$ {riskBrl.toFixed(2)}</strong>.
                  ({contracts} contrato{contracts > 1 ? "s" : ""})
                </p>
                <details className="text-left text-xs">
                  <summary className="cursor-pointer text-primary">Por que a IA sugere isso?</summary>
                  <p className="mt-2 text-muted-foreground leading-relaxed">
                    {ctx.strategyExplanation ?? latest?.reasoning ?? "Sem detalhes adicionais."}
                  </p>
                </details>
                <Button className="w-full gap-2" onClick={() => setStep(3)}>
                  Ver código NTSL <ArrowRight className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  A IA não recomenda operar agora. O melhor trade às vezes é não operar.
                </p>
                <Button variant="outline" className="w-full" onClick={reset}>Voltar ao início</Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ESTADO 3 — NTSL simplificado */}
      {step === 3 && (
        <Card className="border-border" style={{ background: "oklch(0.10 0.01 240)" }}>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Cole no Profit One Pro</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <ol className="text-sm space-y-1 text-muted-foreground">
              <li>1. Abra o Profit One Pro</li>
              <li>2. Vá em Estratégias → Nova Estratégia</li>
              <li>3. Cole o código abaixo</li>
              <li>4. Clique em Compilar e depois em Ativar</li>
            </ol>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg p-2 border border-border/30"><p className="text-muted-foreground">Entrada</p><p className="font-trading font-bold">{entry.toLocaleString("pt-BR")}</p></div>
              <div className="rounded-lg p-2 border border-sell/30"><p className="text-muted-foreground">Stop</p><p className="font-trading font-bold text-sell">{stop.toLocaleString("pt-BR")}</p></div>
              <div className="rounded-lg p-2 border border-buy/30"><p className="text-muted-foreground">Alvo</p><p className="font-trading font-bold text-buy">{target.toLocaleString("pt-BR")}</p></div>
            </div>
            <pre className="rounded-lg p-3 text-[11px] font-mono overflow-x-auto border border-border/30 max-h-72 overflow-y-auto" style={{ background: "oklch(0.07 0.01 240)" }}>
              <code className="text-foreground">{ntsl}</code>
            </pre>
            <Button variant="outline" className="w-full gap-2" onClick={() => { navigator.clipboard.writeText(ntsl); toast.success("Código copiado!"); }}>
              <Copy className="w-4 h-4" /> Copiar código
            </Button>
            <Button className="w-full gap-2" onClick={() => { setEntered(true); setStep(4); }}>
              Entrei na operação <ArrowRight className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ESTADO 4 — Durante a operação */}
      {step === 4 && (
        <Card className="border-border" style={{ background: "oklch(0.10 0.01 240)" }}>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Acompanhando a operação</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Preço atual do WIN</p>
              <p className="font-trading text-3xl font-bold">{currentPrice > 0 ? currentPrice.toLocaleString("pt-BR") : "—"}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg p-3 border border-sell/30 text-center">
                <p className="text-muted-foreground text-xs">Distância até o Stop</p>
                <p className="font-trading font-bold text-sell">{Math.abs(currentPrice - stop).toFixed(0)} pts</p>
                <p className="text-[10px] text-muted-foreground">R$ {(Math.abs(currentPrice - stop) * 0.2 * contracts).toFixed(2)}</p>
              </div>
              <div className="rounded-lg p-3 border border-buy/30 text-center">
                <p className="text-muted-foreground text-xs">Distância até o Alvo</p>
                <p className="font-trading font-bold text-buy">{Math.abs(target - currentPrice).toFixed(0)} pts</p>
                <p className="text-[10px] text-muted-foreground">R$ {(Math.abs(target - currentPrice) * 0.2 * contracts).toFixed(2)}</p>
              </div>
            </div>
            <div>
              <div className="h-2 rounded-full bg-muted/30 overflow-hidden relative">
                <div className="absolute inset-y-0 bg-primary/60" style={{ width: `${progressPct}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span className="text-sell">Stop {stop.toLocaleString("pt-BR")}</span>
                <span className="text-buy">Alvo {target.toLocaleString("pt-BR")}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Quando encerrar a operação no Profit, registre o resultado:
            </p>
            <div className="grid grid-cols-3 gap-2">
              <Button className="gap-1" style={{ background: "oklch(0.65 0.18 145)", color: "white" }} onClick={() => finishTrade("win")}>Ganhei</Button>
              <Button variant="outline" onClick={() => finishTrade("zero")}>Zero a zero</Button>
              <Button className="gap-1" style={{ background: "oklch(0.60 0.22 25)", color: "white" }} onClick={() => finishTrade("loss")}>Perdi</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ESTADO 5 — Resultado */}
      {step === 5 && (
        <Card className="border-border" style={{ background: "oklch(0.10 0.01 240)" }}>
          <CardContent className="p-6 text-center space-y-3">
            <Trophy className="w-10 h-10 mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">P&L acumulado do dia</p>
            <p className={`font-trading text-3xl font-bold ${todayPnl >= 0 ? "text-buy" : "text-sell"}`}>
              {todayPnl >= 0 ? "+" : ""}R$ {todayPnl.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-sm text-muted-foreground">
              {todayPnl >= 0
                ? "Disciplina e consistência valem mais que um trade isolado. Continue seguindo o método."
                : "Perdas fazem parte. O importante é ter respeitado o stop. Reavalie a próxima entrada com calma."}
            </p>
            <Button className="w-full gap-2" onClick={reset}>
              <RotateCcw className="w-4 h-4" /> Fazer nova operação
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
