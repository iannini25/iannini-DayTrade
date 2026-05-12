import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface Trade {
  id: number;
  time: string;
  price: number;
  qty: number;
  side: "buy" | "sell";
  isAggressor: boolean;
}

interface TimesAndTradesProps {
  currentPrice: number;
}

let tradeIdCounter = 0;

function generateTrade(basePrice: number): Trade {
  const offset = (Math.random() - 0.5) * 20;
  const price = Math.round((basePrice + offset) / 5) * 5;
  const qty = Math.floor(Math.random() * 200) + 1;
  const side: "buy" | "sell" = Math.random() > 0.5 ? "buy" : "sell";
  const now = new Date();
  return {
    id: ++tradeIdCounter,
    time: now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    price,
    qty,
    side,
    isAggressor: qty > 100,
  };
}

export default function TimesAndTrades({ currentPrice }: TimesAndTradesProps) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [minVolFilter, setMinVolFilter] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentPrice || currentPrice === 0) return;

    // Seed inicial
    const initial: Trade[] = [];
    for (let i = 0; i < 20; i++) initial.push(generateTrade(currentPrice));
    setTrades(initial.reverse());

    const interval = setInterval(() => {
      const newTrade = generateTrade(currentPrice);
      setTrades(prev => {
        const updated = [newTrade, ...prev];
        return updated.slice(0, 200); // max 200 registros
      });
    }, 800 + Math.random() * 1200);

    return () => clearInterval(interval);
  }, [currentPrice]);

  const filtered = trades.filter(t => t.qty >= minVolFilter);

  return (
    <div className="h-full rounded-lg border border-border overflow-hidden flex flex-col"
      style={{ background: "oklch(0.09 0.01 240)" }}>
      {/* Header */}
      <div className="px-3 py-2 border-b border-border shrink-0 flex items-center justify-between"
        style={{ background: "oklch(0.11 0.01 240)" }}>
        <span className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">Times & Trades</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">Vol. mín:</span>
          <Input
            type="number"
            value={minVolFilter}
            onChange={e => setMinVolFilter(parseInt(e.target.value) || 0)}
            className="h-5 w-16 text-[10px] font-trading px-1.5 py-0"
            min={0}
          />
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-3 px-3 py-1 border-b border-border shrink-0"
        style={{ background: "oklch(0.12 0.01 240)" }}>
        <span className="text-[10px] text-muted-foreground font-medium">Hora</span>
        <span className="text-[10px] text-muted-foreground font-medium text-center">Preço</span>
        <span className="text-[10px] text-muted-foreground font-medium text-right">Qtd</span>
      </div>

      {/* Trades list */}
      <div ref={listRef} className="flex-1 overflow-y-auto">
        {filtered.map((trade) => (
          <div
            key={trade.id}
            className={`grid grid-cols-3 px-3 py-0.5 border-b border-border/30 transition-colors
              ${trade.isAggressor
                ? trade.side === "buy" ? "bg-buy" : "bg-sell"
                : "hover:bg-secondary/30"
              }`}
          >
            <span className="font-trading text-[10px] text-muted-foreground">{trade.time}</span>
            <span className={`font-trading text-[10px] font-semibold text-center ${trade.side === "buy" ? "text-buy" : "text-sell"}`}>
              {trade.price.toLocaleString("pt-BR")}
            </span>
            <div className="flex items-center justify-end gap-1">
              <span className="font-trading text-[10px] text-foreground">{trade.qty.toLocaleString()}</span>
              {trade.isAggressor && (
                <span className={`text-[8px] font-bold ${trade.side === "buy" ? "text-buy" : "text-sell"}`}>
                  {trade.side === "buy" ? "▲" : "▼"}
                </span>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
            Aguardando negócios...
          </div>
        )}
      </div>

      {/* Footer stats */}
      <div className="px-3 py-1.5 border-t border-border shrink-0 flex items-center justify-between"
        style={{ background: "oklch(0.11 0.01 240)" }}>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-buy">▲ {trades.filter(t => t.side === "buy").length}</span>
          <span className="text-muted-foreground">/</span>
          <span className="text-sell">▼ {trades.filter(t => t.side === "sell").length}</span>
        </div>
        <span className="text-[10px] text-muted-foreground">{filtered.length} negócios</span>
      </div>
    </div>
  );
}
