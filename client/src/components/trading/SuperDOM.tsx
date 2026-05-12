import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ChevronUp, ChevronDown, Minus, Plus, Volume2, VolumeX, Lock } from "lucide-react";
import { audioEngine } from "@/lib/tradingAudio";
import {
  showOrderExecutedToast,
  showOrderClosedToast,
} from "@/components/trading/TradingToast";

interface SuperDOMProps {
  currentPrice: number;
  stopLossPoints?: number;
  takeProfitPoints?: number;
  /** Quando definido, bloqueia envio de ordens e exibe overlay com a razão. */
  disabled?: { reason: string } | null;
  /** Quando true, mostra AlertDialog de confirmação antes de enviar a ordem. */
  requireConfirmation?: boolean;
  /** Callback chamado ao encerrar uma posição (stop, gain ou manual) */
  onTradeClose?: (payload: {
    side: "buy" | "sell";
    contracts: number;
    entryPrice: number;
    exitPrice: number;
    stopLoss?: number;
    takeProfit?: number;
    pnlPoints: number;
    pnlBrl: number;
    reason: "take_profit" | "stop_loss" | "manual";
    durationMs: number;
    entryAt: string;
  }) => void;
}

interface BookLevel {
  price: number;
  qty: number;
  total: number;
}

interface Position {
  side: "buy" | "sell";
  qty: number;
  avgPrice: number;
  stopPrice: number;
  targetPrice: number;
  openedAt: number; // timestamp ms
}

function generateBook(basePrice: number, side: "ask" | "bid", levels: number): BookLevel[] {
  const result: BookLevel[] = [];
  let cumTotal = 0;
  for (let i = 0; i < levels; i++) {
    const offset = (i + 1) * 5;
    const price = side === "ask" ? basePrice + offset : basePrice - offset;
    const qty = Math.floor(Math.random() * 500) + 50;
    cumTotal += qty;
    result.push({ price, qty, total: cumTotal });
  }
  return result;
}

export default function SuperDOM({
  currentPrice,
  stopLossPoints = 150,
  takeProfitPoints = 250,
  disabled = null,
  requireConfirmation = true,
  onTradeClose,
}: SuperDOMProps) {
  const positionEntryAtRef = useRef<string | null>(null);
  const [contracts, setContracts] = useState(5);
  const [asks, setAsks] = useState<BookLevel[]>([]);
  const [bids, setBids] = useState<BookLevel[]>([]);
  const [position, setPosition] = useState<Position | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [pendingOrder, setPendingOrder] = useState<"buy" | "sell" | null>(null);
  // Ref para evitar disparos duplos de stop/gain no mesmo ciclo
  const closingRef = useRef(false);

  // Simular book de ofertas
  useEffect(() => {
    if (!currentPrice || currentPrice === 0) return;
    const update = () => {
      setAsks(generateBook(currentPrice, "ask", 8).sort((a, b) => a.price - b.price));
      setBids(generateBook(currentPrice, "bid", 8).sort((a, b) => b.price - a.price));
    };
    update();
    const interval = setInterval(update, 2000);
    return () => clearInterval(interval);
  }, [currentPrice]);

  // Monitorar stop/gain da posição aberta
  useEffect(() => {
    if (!position || !currentPrice || closingRef.current) return;

    const { side, stopPrice, targetPrice, avgPrice, qty, openedAt } = position;
    const durationMs = Date.now() - openedAt;

    const checkStop = side === "buy"
      ? currentPrice <= stopPrice
      : currentPrice >= stopPrice;

    const checkGain = side === "buy"
      ? currentPrice >= targetPrice
      : currentPrice <= targetPrice;

    if (checkStop) {
      closingRef.current = true;
      const pnlPoints = side === "buy"
        ? currentPrice - avgPrice
        : avgPrice - currentPrice;
      const pnlBrl = pnlPoints * 0.20 * qty;

      if (audioEnabled) audioEngine.play("stop_loss");
      showOrderClosedToast({
        side,
        contracts: qty,
        entryPrice: avgPrice,
        exitPrice: currentPrice,
        pnlPoints,
        pnlBrl,
        reason: "stop_loss",
        durationMs,
      });
      onTradeClose?.({
        side,
        contracts: qty,
        entryPrice: avgPrice,
        exitPrice: currentPrice,
        stopLoss: stopPrice,
        takeProfit: targetPrice,
        pnlPoints,
        pnlBrl,
        reason: "stop_loss",
        durationMs,
        entryAt: positionEntryAtRef.current ?? new Date().toISOString(),
      });
      setPosition(null);
      setTimeout(() => { closingRef.current = false; }, 500);

    } else if (checkGain) {
      closingRef.current = true;
      const pnlPoints = side === "buy"
        ? currentPrice - avgPrice
        : avgPrice - currentPrice;
      const pnlBrl = pnlPoints * 0.20 * qty;

      if (audioEnabled) audioEngine.play("take_profit");
      showOrderClosedToast({
        side,
        contracts: qty,
        entryPrice: avgPrice,
        exitPrice: currentPrice,
        pnlPoints,
        pnlBrl,
        reason: "take_profit",
        durationMs,
      });
      onTradeClose?.({
        side,
        contracts: qty,
        entryPrice: avgPrice,
        exitPrice: currentPrice,
        stopLoss: stopPrice,
        takeProfit: targetPrice,
        pnlPoints,
        pnlBrl,
        reason: "take_profit",
        durationMs,
        entryAt: positionEntryAtRef.current ?? new Date().toISOString(),
      });
      setPosition(null);
      setTimeout(() => { closingRef.current = false; }, 500);
    }
  }, [currentPrice, position, audioEnabled, onTradeClose]);

  const maxTotal = Math.max(
    ...asks.map(a => a.total),
    ...bids.map(b => b.total),
    1
  );

  const submitOrder = useCallback((side: "buy" | "sell") => {
    if (contracts < 1) { toast.error("Quantidade inválida"); return; }
    const price = side === "buy"
      ? (asks[0]?.price ?? currentPrice)
      : (bids[0]?.price ?? currentPrice);

    const stopPrice = side === "buy" ? price - stopLossPoints : price + stopLossPoints;
    const targetPrice = side === "buy" ? price + takeProfitPoints : price - takeProfitPoints;
    const financialValue = contracts * price * 0.20;

    const entryAt = new Date().toISOString();
    positionEntryAtRef.current = entryAt;
    setPosition({
      side,
      qty: contracts,
      avgPrice: price,
      stopPrice,
      targetPrice,
      openedAt: Date.now(),
    });

    if (audioEnabled) {
      audioEngine.play(side === "buy" ? "order_buy" : "order_sell");
    }

    showOrderExecutedToast({
      side,
      contracts,
      price,
      stopPrice,
      targetPrice,
      stopPoints: stopLossPoints,
      targetPoints: takeProfitPoints,
      financialValue,
    });
  }, [contracts, asks, bids, currentPrice, stopLossPoints, takeProfitPoints, audioEnabled]);

  const handleOrder = useCallback((side: "buy" | "sell") => {
    if (disabled) {
      toast.error(disabled.reason);
      return;
    }
    if (requireConfirmation) {
      setPendingOrder(side);
      return;
    }
    submitOrder(side);
  }, [disabled, requireConfirmation, submitOrder]);

  // Preview da ordem pendente (para o modal)
  const pendingPreview = pendingOrder
    ? (() => {
        const side = pendingOrder;
        const price = side === "buy"
          ? (asks[0]?.price ?? currentPrice)
          : (bids[0]?.price ?? currentPrice);
        const stopPrice = side === "buy" ? price - stopLossPoints : price + stopLossPoints;
        const targetPrice = side === "buy" ? price + takeProfitPoints : price - takeProfitPoints;
        const riskBrl = stopLossPoints * 0.20 * contracts;
        return { side, price, stopPrice, targetPrice, riskBrl };
      })()
    : null;

  const handleClose = useCallback(() => {
    if (!position || closingRef.current) return;
    closingRef.current = true;

    const exitPrice = position.side === "buy"
      ? (bids[0]?.price ?? currentPrice)
      : (asks[0]?.price ?? currentPrice);
    const pnlPoints = position.side === "buy"
      ? exitPrice - position.avgPrice
      : position.avgPrice - exitPrice;
    const pnlBrl = pnlPoints * 0.20 * position.qty;
    const durationMs = Date.now() - position.openedAt;

    if (audioEnabled) {
      audioEngine.play(pnlBrl >= 0 ? "take_profit" : "stop_loss");
    }

    // Toast rico de encerramento manual
    showOrderClosedToast({
      side: position.side,
      contracts: position.qty,
      entryPrice: position.avgPrice,
      exitPrice,
      pnlPoints,
      pnlBrl,
      reason: "manual",
      durationMs,
    });

    onTradeClose?.({
      side: position.side,
      contracts: position.qty,
      entryPrice: position.avgPrice,
      exitPrice,
      stopLoss: position.stopPrice,
      takeProfit: position.targetPrice,
      pnlPoints,
      pnlBrl,
      reason: "manual",
      durationMs,
      entryAt: positionEntryAtRef.current ?? new Date().toISOString(),
    });

    setPosition(null);
    setTimeout(() => { closingRef.current = false; }, 500);
  }, [position, bids, asks, currentPrice, audioEnabled, onTradeClose]);

  // P&L flutuante da posição aberta
  const floatingPnl = position && currentPrice
    ? (() => {
        const pts = position.side === "buy"
          ? currentPrice - position.avgPrice
          : position.avgPrice - currentPrice;
        return { pts, brl: pts * 0.20 * position.qty };
      })()
    : null;

  return (
    <div className="relative h-full rounded-lg border border-border overflow-hidden flex flex-col"
      style={{ background: "oklch(0.09 0.01 240)" }}>
      {/* Overlay de bloqueio */}
      {disabled && !position && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 backdrop-blur-sm"
          style={{ background: "oklch(0.09 0.01 240 / 0.85)" }}
          role="alert">
          <Lock className="w-6 h-6 text-loss" />
          <p className="font-semibold text-sm text-foreground tracking-wide">
            ENVIO DE ORDENS BLOQUEADO
          </p>
          <p className="text-xs text-muted-foreground max-w-xs text-center px-4">
            {disabled.reason}
          </p>
        </div>
      )}

      {/* Modal de confirmação de ordem */}
      <AlertDialog
        open={pendingOrder !== null}
        onOpenChange={(open) => { if (!open) setPendingOrder(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Confirmar ordem de {pendingPreview?.side === "buy" ? "COMPRA" : "VENDA"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 pt-2">
                {pendingPreview && (
                  <div className="rounded-lg border border-border p-3 grid grid-cols-2 gap-2 text-xs"
                    style={{ background: "oklch(0.12 0.01 240)" }}>
                    <div>
                      <p className="text-muted-foreground">Lado</p>
                      <p className={`font-semibold ${pendingPreview.side === "buy" ? "text-buy" : "text-sell"}`}>
                        {pendingPreview.side === "buy" ? "▲ COMPRA" : "▼ VENDA"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Contratos</p>
                      <p className="font-trading font-semibold">{contracts}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Entrada estimada</p>
                      <p className="font-trading font-semibold">
                        {pendingPreview.price.toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Risco em R$</p>
                      <p className="font-trading font-semibold text-loss">
                        R$ {pendingPreview.riskBrl.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Stop</p>
                      <p className="font-trading font-semibold text-sell">
                        {pendingPreview.stopPrice.toLocaleString("pt-BR")} ({stopLossPoints} pts)
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Alvo</p>
                      <p className="font-trading font-semibold text-buy">
                        {pendingPreview.targetPrice.toLocaleString("pt-BR")} ({takeProfitPoints} pts)
                      </p>
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Para desabilitar esta confirmação, vá em Configurações → Segurança Operacional.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingOrder) submitOrder(pendingOrder);
                setPendingOrder(null);
              }}>
              Confirmar Ordem
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Header */}
      <div className="px-3 py-2 border-b border-border shrink-0 flex items-center justify-between"
        style={{ background: "oklch(0.11 0.01 240)" }}>
        <span className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">SuperDOM</span>
        <div className="flex items-center gap-2">
          <span className="font-trading text-xs text-muted-foreground">
            {currentPrice > 0 ? currentPrice.toLocaleString("pt-BR") : "—"}
          </span>
          <button
            onClick={() => setAudioEnabled(v => !v)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title={audioEnabled ? "Silenciar alertas" : "Ativar alertas"}>
            {audioEnabled
              ? <Volume2 className="w-3.5 h-3.5 text-primary" />
              : <VolumeX className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Posição atual */}
      {position && (
        <div className="mx-2 mt-2 rounded-lg border text-xs shrink-0 overflow-hidden"
          style={{ borderColor: position.side === "buy" ? "#22c55e" : "#ef4444" }}>
          <div className="px-3 py-1.5 flex items-center justify-between"
            style={{ background: position.side === "buy" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)" }}>
            <span className={`font-semibold ${position.side === "buy" ? "text-buy" : "text-sell"}`}>
              {position.side === "buy" ? "▲ COMPRADO" : "▼ VENDIDO"} · {position.qty} contratos
            </span>
            <Button size="sm" variant="outline" className="h-5 text-[10px] px-2" onClick={handleClose}>
              Zerar
            </Button>
          </div>
          <div className="px-3 py-1 grid grid-cols-3 gap-1 text-[10px]"
            style={{ background: "oklch(0.13 0.01 240)" }}>
            <div>
              <p className="text-muted-foreground">Entrada</p>
              <p className="font-trading font-semibold">{position.avgPrice.toLocaleString("pt-BR")}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Stop</p>
              <p className="font-trading font-semibold text-sell">{position.stopPrice.toLocaleString("pt-BR")}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Alvo</p>
              <p className="font-trading font-semibold text-buy">{position.targetPrice.toLocaleString("pt-BR")}</p>
            </div>
          </div>
          {floatingPnl && (
            <div className="px-3 py-1 border-t border-border/50 flex items-center justify-between text-[10px]"
              style={{ background: "oklch(0.11 0.01 240)" }}>
              <span className="text-muted-foreground">P&L Flutuante</span>
              <span className={`font-trading font-bold ${floatingPnl.brl >= 0 ? "text-profit" : "text-loss"}`}>
                {floatingPnl.pts >= 0 ? "+" : ""}{floatingPnl.pts.toFixed(0)} pts
                {" "}({floatingPnl.brl >= 0 ? "+" : ""}R$ {floatingPnl.brl.toFixed(2)})
              </span>
            </div>
          )}
        </div>
      )}

      {/* Book */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {/* Asks */}
        <div className="flex-1 overflow-y-auto flex flex-col-reverse">
          {asks.map((level, i) => (
            <div key={i} className="relative flex items-center justify-between px-3 py-0.5 hover:bg-secondary/50 cursor-pointer"
              onClick={() => toast.info(`Ordem limitada em ${level.price.toLocaleString("pt-BR")}`)}>
              <div className="absolute left-0 top-0 bottom-0 opacity-20"
                style={{ width: `${(level.total / maxTotal) * 100}%`, background: "oklch(0.60 0.22 25)" }} />
              <span className="font-trading text-xs text-sell relative z-10">{level.price.toLocaleString("pt-BR")}</span>
              <span className="font-trading text-xs text-muted-foreground relative z-10">{level.qty.toLocaleString()}</span>
            </div>
          ))}
        </div>

        {/* Preço atual */}
        <div className="px-3 py-1.5 border-y border-border shrink-0 flex items-center justify-center gap-2"
          style={{ background: "oklch(0.13 0.01 240)" }}>
          <span className="font-trading text-sm font-bold text-foreground">
            {currentPrice > 0 ? currentPrice.toLocaleString("pt-BR") : "—"}
          </span>
          <span className="text-[10px] text-muted-foreground">WIN</span>
        </div>

        {/* Bids */}
        <div className="flex-1 overflow-y-auto">
          {bids.map((level, i) => (
            <div key={i} className="relative flex items-center justify-between px-3 py-0.5 hover:bg-secondary/50 cursor-pointer"
              onClick={() => toast.info(`Ordem limitada em ${level.price.toLocaleString("pt-BR")}`)}>
              <div className="absolute left-0 top-0 bottom-0 opacity-20"
                style={{ width: `${(level.total / maxTotal) * 100}%`, background: "oklch(0.65 0.18 145)" }} />
              <span className="font-trading text-xs text-buy relative z-10">{level.price.toLocaleString("pt-BR")}</span>
              <span className="font-trading text-xs text-muted-foreground relative z-10">{level.qty.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Controles de ordem */}
      <div className="p-2 border-t border-border shrink-0 space-y-2" style={{ background: "oklch(0.11 0.01 240)" }}>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-7 w-7 p-0 shrink-0"
            onClick={() => setContracts(c => Math.max(1, c - 1))}>
            <Minus className="w-3 h-3" />
          </Button>
          <Input
            type="number"
            value={contracts}
            onChange={e => setContracts(Math.max(1, Math.min(15, parseInt(e.target.value) || 1)))}
            className="h-7 text-center font-trading text-xs font-semibold"
            min={1} max={15}
          />
          <Button variant="outline" size="sm" className="h-7 w-7 p-0 shrink-0"
            onClick={() => setContracts(c => Math.min(15, c + 1))}>
            <Plus className="w-3 h-3" />
          </Button>
        </div>
        <div className="text-center text-[10px] text-muted-foreground">
          {contracts} contrato{contracts > 1 ? "s" : ""} · R$ {(contracts * 0.20 * 5).toFixed(2)}/tick
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <Button
            className="h-9 font-semibold text-xs tracking-wide"
            style={{ background: "oklch(0.65 0.18 145)", color: "white" }}
            onClick={() => handleOrder("buy")}
            disabled={!!position || !!disabled}>
            <ChevronUp className="w-3.5 h-3.5 mr-1" />
            COMPRAR
          </Button>
          <Button
            className="h-9 font-semibold text-xs tracking-wide"
            style={{ background: "oklch(0.60 0.22 25)", color: "white" }}
            onClick={() => handleOrder("sell")}
            disabled={!!position || !!disabled}>
            <ChevronDown className="w-3.5 h-3.5 mr-1" />
            VENDER
          </Button>
        </div>
      </div>
    </div>
  );
}
