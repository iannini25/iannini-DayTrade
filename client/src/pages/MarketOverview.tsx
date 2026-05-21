import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { getRefetchInterval } from "@/hooks/useRefetchInterval";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TrendingUp, TrendingDown, Minus, RefreshCw,
  ChevronLeft, ChevronRight, BarChart3, Globe,
  DollarSign, Activity, AlertTriangle, ArrowUpRight, ArrowDownRight,
} from "lucide-react";

function PriceChange({ value, suffix = "%" }: { value: number; suffix?: string }) {
  const isPositive = value > 0;
  const isNeutral = value === 0;
  const color = isNeutral ? "text-muted-foreground" : isPositive ? "text-buy" : "text-sell";
  const Icon = isNeutral ? Minus : isPositive ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 font-trading font-semibold ${color}`}>
      <Icon className="w-3.5 h-3.5" />
      {Math.abs(value).toFixed(2)}{suffix}
    </span>
  );
}

function IndexCard({ index, updatedAt }: { index: any; updatedAt?: number }) {
  const isPositive = index.changePct > 0;
  const isNeutral = index.changePct === 0;
  // Prioriza o horário REAL da cotação (marketTime do provedor) sobre o horário do fetch
  const apiTimeMs = index.marketTime && index.marketTime > 0 ? index.marketTime * 1000 : null;
  const refTime = apiTimeMs ?? updatedAt ?? null;
  const ageMs = refTime ? Date.now() - refTime : null;
  const stale = ageMs !== null && ageMs > 5 * 60 * 1000;
  const updatedLabel = refTime
    ? new Date(refTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : null;
  const sourceLabel =
    index.source === "awesomeapi" ? "AwesomeAPI"
    : index.source === "b3-smal11" ? "B3/SMAL11"
    : index.source === "unavailable" ? "indisponível"
    : index.source === "yahoo" ? "Yahoo"
    : null;
  const borderColor = isNeutral ? "border-border" : isPositive ? "border-buy/30" : "border-sell/30";
  const bgGlow = isNeutral ? "" : isPositive ? "shadow-[0_0_20px_oklch(0.65_0.15_142/0.08)]" : "shadow-[0_0_20px_oklch(0.65_0.15_0/0.08)]";

  return (
    <Card className={`border ${borderColor} ${bgGlow} transition-all`} style={{ background: "oklch(0.10 0.01 240)" }}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{index.shortName}</p>
            <p className="text-sm font-medium text-foreground">{index.name}</p>
          </div>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isPositive ? "bg-buy/10" : isNeutral ? "bg-muted/10" : "bg-sell/10"}`}>
            {isPositive ? <TrendingUp className="w-4 h-4 text-buy" /> : isNeutral ? <Minus className="w-4 h-4 text-muted-foreground" /> : <TrendingDown className="w-4 h-4 text-sell" />}
          </div>
        </div>
        <p className="text-2xl font-bold font-trading text-foreground">
          {index.price > 0 ? index.price.toLocaleString("pt-BR", { minimumFractionDigits: index.price < 100 ? 4 : 0 }) : "—"}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <PriceChange value={index.changePct} />
          <span className="text-xs text-muted-foreground">
            ({index.change > 0 ? "+" : ""}{index.change.toLocaleString("pt-BR", { minimumFractionDigits: 2 })})
          </span>
        </div>
        {index.high > 0 && (
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <span>Máx: <span className="text-buy font-trading">{index.high.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</span></span>
            <span>Mín: <span className="text-sell font-trading">{index.low.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</span></span>
          </div>
        )}
        {updatedLabel && (
          <div className={`mt-2 flex items-center justify-between gap-1 text-[10px] ${stale ? "text-amber-400" : "text-muted-foreground/60"}`}>
            <span className="flex items-center gap-1">
              {stale && <AlertTriangle className="w-3 h-3" />}
              Atualizado {updatedLabel}{stale ? " (desatualizado)" : ""}
            </span>
            {sourceLabel && <span className="font-mono">{sourceLabel}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MoverCard({ stock, type }: { stock: any; type: "gainer" | "loser" }) {
  const isGainer = type === "gainer";
  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border transition-all ${isGainer ? "border-buy/20 bg-buy/5 hover:bg-buy/10" : "border-sell/20 bg-sell/5 hover:bg-sell/10"}`}>
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold font-trading ${isGainer ? "bg-buy/20 text-buy" : "bg-sell/20 text-sell"}`}>
          {stock.symbol.slice(0, 4)}
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{stock.symbol}</p>
          <p className="text-xs text-muted-foreground truncate max-w-[120px]">{stock.name?.split(" ").slice(0, 3).join(" ")}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-trading font-bold text-foreground">R$ {stock.price.toFixed(2)}</p>
        <PriceChange value={stock.changePct} />
      </div>
    </div>
  );
}

// Carrossel automático de indicações
function SignalCarousel({ gainers, losers }: { gainers: any[]; losers: any[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const allSignals = [
    ...gainers.map(s => ({ ...s, type: "gainer" as const, signal: "COMPRA" })),
    ...losers.map(s => ({ ...s, type: "loser" as const, signal: "VENDA" })),
  ];

  useEffect(() => {
    if (!isPaused && allSignals.length > 0) {
      intervalRef.current = setInterval(() => {
        setCurrentIndex(i => (i + 1) % allSignals.length);
      }, 3500);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPaused, allSignals.length]);

  if (allSignals.length === 0) return null;

  const current = allSignals[currentIndex];
  if (!current) return null;
  const isGainer = current.type === "gainer";

  return (
    <Card className="border-border overflow-hidden" style={{ background: "oklch(0.10 0.01 240)" }}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          Indicações em Destaque
          <Badge variant="outline" className="ml-auto text-[10px]">Ao Vivo</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        {/* Slide atual */}
        <div
          className={`rounded-xl border p-4 mb-4 transition-all ${isGainer ? "border-buy/30 bg-buy/5" : "border-sell/30 bg-sell/5"}`}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Badge className={`text-xs font-bold ${isGainer ? "bg-buy/20 text-buy border-buy/30" : "bg-sell/20 text-sell border-sell/30"} border`} variant="outline">
                {isGainer ? "🟢 DESTAQUE ALTA" : "🔴 EM QUEDA"}
              </Badge>
              <span className="text-xs text-muted-foreground">#{currentIndex + 1}/{allSignals.length}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentIndex(i => (i - 1 + allSignals.length) % allSignals.length)}
                className="w-6 h-6 rounded flex items-center justify-center hover:bg-muted/20 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
              <button
                onClick={() => setCurrentIndex(i => (i + 1) % allSignals.length)}
                className="w-6 h-6 rounded flex items-center justify-center hover:bg-muted/20 transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold font-trading text-foreground">{current.symbol}</p>
              <p className="text-xs text-muted-foreground">{current.name?.split(" ").slice(0, 4).join(" ")}</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold font-trading text-foreground">R$ {current.price.toFixed(2)}</p>
              <PriceChange value={current.changePct} />
            </div>
          </div>
          <div className="mt-3 text-xs text-muted-foreground flex items-center gap-1">
            {isGainer
              ? <><TrendingUp className="w-3 h-3 text-buy" /> Ativo em tendência de alta — monitorar para entrada em pullback</>
              : <><TrendingDown className="w-3 h-3 text-sell" /> Ativo em queda — evitar compra, monitorar suporte</>}
          </div>
        </div>

        {/* Indicadores de posição */}
        <div className="flex items-center justify-center gap-1">
          {allSignals.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`h-1 rounded-full transition-all ${i === currentIndex ? "w-6 bg-primary" : "w-1.5 bg-muted/40"}`}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function MarketOverview() {
  const { data: indices, refetch: refetchIndices, isLoading: loadingIndices, dataUpdatedAt: indicesUpdatedAt } = trpc.market.getIndices.useQuery(undefined, {
    refetchInterval: getRefetchInterval,
  });
  const { data: movers, refetch: refetchMovers, isLoading: loadingMovers } = trpc.market.getTopMovers.useQuery(undefined, {
    refetchInterval: getRefetchInterval,
  });

  const [lastUpdate, setLastUpdate] = useState(new Date());

  const handleRefresh = () => {
    refetchIndices();
    refetchMovers();
    setLastUpdate(new Date());
  };

  useEffect(() => {
    const interval = setInterval(() => setLastUpdate(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const ibov = indices?.find(i => i.shortName === "IBOV");
  const marketSentiment = ibov
    ? ibov.changePct > 0.5 ? "bullish" : ibov.changePct < -0.5 ? "bearish" : "neutral"
    : "neutral";

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="w-6 h-6 text-primary" />
            Visão de Mercado
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Índices, movers e indicações em tempo real · Atualizado às {lastUpdate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className={`text-xs ${marketSentiment === "bullish" ? "border-buy/30 text-buy" : marketSentiment === "bearish" ? "border-sell/30 text-sell" : "border-border text-muted-foreground"}`}
          >
            {marketSentiment === "bullish" ? "🟢 Mercado em Alta" : marketSentiment === "bearish" ? "🔴 Mercado em Baixa" : "🟡 Mercado Lateral"}
          </Badge>
          <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-2 h-8">
            <RefreshCw className={`w-3.5 h-3.5 ${(loadingIndices || loadingMovers) ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Índices Principais */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4" /> Índices Principais
        </h2>
        {loadingIndices ? (
          <div className="grid grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-28 rounded-xl bg-muted/10 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-5 gap-3">
            {(indices ?? []).map((index) => (
              <IndexCard key={index.shortName} index={index} updatedAt={indicesUpdatedAt} />
            ))}
          </div>
        )}
      </div>

      {/* Carrossel + Top Movers */}
      <div className="grid grid-cols-3 gap-4">
        {/* Carrossel */}
        <div className="col-span-1">
          {movers ? (
            <SignalCarousel gainers={movers.gainers} losers={movers.losers} />
          ) : (
            <div className="h-64 rounded-xl bg-muted/10 animate-pulse" />
          )}
        </div>

        {/* Maiores Altas */}
        <Card className="border-border" style={{ background: "oklch(0.10 0.01 240)" }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-buy" />
              Maiores Altas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pb-4">
            {loadingMovers ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-14 rounded-lg bg-muted/10 animate-pulse" />
              ))
            ) : (
              (movers?.gainers ?? []).map((stock) => (
                <MoverCard key={stock.symbol} stock={stock} type="gainer" />
              ))
            )}
          </CardContent>
        </Card>

        {/* Maiores Quedas */}
        <Card className="border-border" style={{ background: "oklch(0.10 0.01 240)" }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-sell" />
              Maiores Quedas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pb-4">
            {loadingMovers ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-14 rounded-lg bg-muted/10 animate-pulse" />
              ))
            ) : (
              (movers?.losers ?? []).map((stock) => (
                <MoverCard key={stock.symbol} stock={stock} type="loser" />
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Aviso de horário */}
      {(() => {
        const h = new Date().getHours();
        const m = new Date().getMinutes();
        const isPreMarket = h < 9 || (h === 9 && m < 0);
        const isOpeningVolatile = h === 9 && m < 30;
        const isLunch = h >= 12 && h < 13;
        const isClosing = h >= 16 && h < 17;
        const isAfterMarket = h >= 17;

        let msg = null;
        if (isPreMarket) msg = { text: "Pré-mercado: aguardar abertura às 09:00 para iniciar operações.", color: "border-amber-400/30 bg-amber-400/5 text-amber-400" };
        else if (isOpeningVolatile) msg = { text: "⚡ Abertura: volatilidade elevada nos primeiros 30 minutos. Aguardar estabilização antes de operar.", color: "border-sell/30 bg-sell/5 text-sell" };
        else if (isLunch) msg = { text: "🍽️ Horário de almoço: liquidez reduzida. Evitar novas entradas entre 12h e 13h.", color: "border-amber-400/30 bg-amber-400/5 text-amber-400" };
        else if (isClosing) msg = { text: "⏰ Próximo ao fechamento: risco de reversão. Encerrar posições abertas antes das 17h.", color: "border-sell/30 bg-sell/5 text-sell" };
        else if (isAfterMarket) msg = { text: "Mercado encerrado. Próxima sessão às 09:00.", color: "border-border bg-muted/5 text-muted-foreground" };

        if (!msg) return null;
        return (
          <div className={`flex items-center gap-2 p-3 rounded-lg border text-sm ${msg.color}`}>
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {msg.text}
          </div>
        );
      })()}
    </div>
  );
}
