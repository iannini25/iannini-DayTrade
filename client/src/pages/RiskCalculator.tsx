import { useState, useMemo } from "react";
import { Link } from "wouter";
import { ArrowLeft, Calculator, TrendingUp, TrendingDown, DollarSign, Shield } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const POINT_VALUE = 0.20; // R$ por ponto por contrato
const MARGIN_PER_CONTRACT = 1000; // Margem estimada por contrato (R$)

export default function RiskCalculator() {
  const [contracts, setContracts] = useState(5);
  const [stopLoss, setStopLoss] = useState(150);
  const [takeProfit, setTakeProfit] = useState(250);
  const [capital, setCapital] = useState(15000);
  const [entryPrice, setEntryPrice] = useState(130000);

  const calc = useMemo(() => {
    const pointValueTotal = POINT_VALUE * contracts;
    const riskBrl = stopLoss * pointValueTotal;
    const rewardBrl = takeProfit * pointValueTotal;
    const rrRatio = riskBrl > 0 ? rewardBrl / riskBrl : 0;
    const marginRequired = MARGIN_PER_CONTRACT * contracts;
    const riskPct = capital > 0 ? (riskBrl / capital) * 100 : 0;
    const stopPrice = entryPrice - stopLoss;
    const targetPrice = entryPrice + takeProfit;
    const breakevenWinRate = rrRatio > 0 ? (1 / (1 + rrRatio)) * 100 : 50;

    // Simulação de resultados
    const scenarios = [1, 2, 3, 4, 5].map(ops => ({
      ops,
      allWin: ops * rewardBrl,
      allLoss: -(ops * riskBrl),
      mixed: (ops * rewardBrl * 0.6) - (ops * riskBrl * 0.4),
    }));

    return {
      pointValueTotal,
      riskBrl,
      rewardBrl,
      rrRatio,
      marginRequired,
      riskPct,
      stopPrice,
      targetPrice,
      breakevenWinRate,
      scenarios,
    };
  }, [contracts, stopLoss, takeProfit, capital, entryPrice]);

  const Row = ({ label, value, color, mono = true }: any) => (
    <div className="flex items-center justify-between py-2 border-b border-border/50">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-xs font-semibold ${mono ? "font-trading" : ""}`} style={color ? { color } : {}}>
        {value}
      </span>
    </div>
  );

  return (
    <div className="min-h-screen bg-background" style={{ fontFamily: "'Inter', sans-serif" }}>
      <header className="h-12 border-b border-border flex items-center px-4 gap-3"
        style={{ background: "oklch(0.09 0.01 240)" }}>
        <a href="/workspace" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </a>
        <div className="w-5 h-5 rounded flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, oklch(0.65 0.18 195), oklch(0.55 0.22 250))" }}>
          <Calculator className="w-3 h-3 text-white" />
        </div>
        <span className="text-sm font-semibold">Calculadora de Risco</span>
      </header>

      <div className="max-w-5xl mx-auto p-6">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Parâmetros */}
          <div className="space-y-5">
            <div className="rounded-xl border border-border p-5" style={{ background: "oklch(0.11 0.01 240)" }}>
              <h3 className="text-sm font-semibold mb-4">Parâmetros da Operação</h3>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <Label className="text-xs text-muted-foreground">Contratos</Label>
                    <span className="font-trading text-sm font-bold" style={{ color: "oklch(0.65 0.18 195)" }}>{contracts}</span>
                  </div>
                  <Slider value={[contracts]} onValueChange={([v]) => setContracts(v)} min={1} max={15} step={1} />
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1"><span>1</span><span>15</span></div>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <Label className="text-xs text-muted-foreground">Stop Loss</Label>
                    <span className="font-trading text-sm font-bold text-sell">{stopLoss} pts</span>
                  </div>
                  <Slider value={[stopLoss]} onValueChange={([v]) => setStopLoss(v)} min={50} max={200} step={5} />
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <Label className="text-xs text-muted-foreground">Take Profit</Label>
                    <span className="font-trading text-sm font-bold text-buy">{takeProfit} pts</span>
                  </div>
                  <Slider value={[takeProfit]} onValueChange={([v]) => setTakeProfit(v)} min={50} max={400} step={5} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Capital (R$)</Label>
                    <Input type="number" value={capital} onChange={e => setCapital(Number(e.target.value))}
                      className="mt-1 h-8 font-trading text-xs" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Preço de Entrada</Label>
                    <Input type="number" value={entryPrice} onChange={e => setEntryPrice(Number(e.target.value))}
                      className="mt-1 h-8 font-trading text-xs" />
                  </div>
                </div>
              </div>
            </div>

            {/* Referência WIN */}
            <div className="rounded-xl border border-border p-4 text-xs"
              style={{ background: "oklch(0.11 0.01 240)", borderColor: "oklch(0.65 0.18 195 / 0.3)" }}>
              <p className="font-semibold mb-2" style={{ color: "oklch(0.65 0.18 195)" }}>Referência Mini Índice (WIN)</p>
              <div className="space-y-1 text-muted-foreground">
                <p>• Valor por ponto: <strong className="text-foreground">R$ 0,20 / contrato</strong></p>
                <p>• Variação mínima: <strong className="text-foreground">5 pontos (1 tick)</strong></p>
                <p>• Valor por tick: <strong className="text-foreground">R$ 1,00 / contrato</strong></p>
                <p>• Margem estimada: <strong className="text-foreground">R$ 1.000 / contrato</strong></p>
              </div>
            </div>
          </div>

          {/* Resultados */}
          <div className="space-y-4">
            <div className="rounded-xl border border-border p-5" style={{ background: "oklch(0.11 0.01 240)" }}>
              <h3 className="text-sm font-semibold mb-3">Análise da Operação</h3>
              <Row label="Valor por ponto (total)" value={`R$ ${calc.pointValueTotal.toFixed(2)}`} />
              <Row label="Risco máximo (Stop)" value={`R$ ${calc.riskBrl.toFixed(2)}`} color="#ef4444" />
              <Row label="Retorno alvo (Gain)" value={`R$ ${calc.rewardBrl.toFixed(2)}`} color="#22c55e" />
              <Row label="Ratio Risco/Retorno" value={`1 : ${calc.rrRatio.toFixed(2)}`} color="#d97706" />
              <Row label="Risco sobre capital" value={`${calc.riskPct.toFixed(1)}%`}
                color={calc.riskPct > 5 ? "#ef4444" : "#22c55e"} />
              <Row label="Margem necessária" value={`R$ ${calc.marginRequired.toLocaleString("pt-BR")}`} />
              <Row label="Preço de Stop" value={calc.stopPrice.toLocaleString("pt-BR")} color="#ef4444" />
              <Row label="Preço de Gain" value={calc.targetPrice.toLocaleString("pt-BR")} color="#22c55e" />
              <Row label="Win rate mínimo" value={`${calc.breakevenWinRate.toFixed(1)}%`} color="#d97706" />
            </div>

            {/* Simulação */}
            <div className="rounded-xl border border-border p-5" style={{ background: "oklch(0.11 0.01 240)" }}>
              <h3 className="text-sm font-semibold mb-3">Simulação de Resultados</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-1.5 text-muted-foreground font-medium">Ops</th>
                      <th className="text-right py-1.5 text-buy font-medium">100% Gain</th>
                      <th className="text-right py-1.5 text-muted-foreground font-medium">60/40</th>
                      <th className="text-right py-1.5 text-sell font-medium">100% Stop</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calc.scenarios.map(s => (
                      <tr key={s.ops} className="border-b border-border/30">
                        <td className="py-1.5 font-trading text-muted-foreground">{s.ops}x</td>
                        <td className="py-1.5 font-trading text-buy text-right">+R$ {s.allWin.toFixed(2)}</td>
                        <td className={`py-1.5 font-trading text-right ${s.mixed >= 0 ? "text-buy" : "text-sell"}`}>
                          {s.mixed >= 0 ? "+" : ""}R$ {s.mixed.toFixed(2)}
                        </td>
                        <td className="py-1.5 font-trading text-sell text-right">-R$ {Math.abs(s.allLoss).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Alerta de risco */}
            {calc.riskPct > 3 && (
              <div className="rounded-xl border p-4 text-xs" style={{ borderColor: "#d97706", background: "rgba(217,119,6,0.08)" }}>
                <p className="font-semibold mb-1" style={{ color: "#d97706" }}>⚠ Atenção ao Risco</p>
                <p className="text-muted-foreground">
                  Você está arriscando <strong style={{ color: "#d97706" }}>{calc.riskPct.toFixed(1)}%</strong> do capital por operação.
                  O ideal é manter abaixo de 2-3% para preservação de capital.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
