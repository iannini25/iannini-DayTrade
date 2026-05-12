import { useState, useEffect } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { ArrowLeft, Settings, Shield, TrendingUp, Target, Activity, Save } from "lucide-react";

export default function OcoConfig() {
  const [stopLoss, setStopLoss] = useState(150);
  const [takeProfit, setTakeProfit] = useState(250);
  const [breakeven, setBreakeven] = useState(100);
  const [trailingStop, setTrailingStop] = useState(50);
  const [trailingTrigger, setTrailingTrigger] = useState(150);
  const [contracts, setContracts] = useState(5);

  const { data: savedConfig } = trpc.oco.get.useQuery();
  const saveMutation = trpc.oco.save.useMutation({
    onSuccess: () => toast.success("Estratégia OCO salva com sucesso!"),
    onError: () => toast.error("Erro ao salvar configuração"),
  });

  useEffect(() => {
    if (savedConfig) {
      setStopLoss(savedConfig.stopLossPoints);
      setTakeProfit(savedConfig.takeProfitPoints);
      setBreakeven(savedConfig.breakevenTriggerPoints);
      setTrailingStop(savedConfig.trailingStopPoints);
      setTrailingTrigger(savedConfig.trailingStopTriggerPoints);
      setContracts(savedConfig.defaultContracts);
    }
  }, [savedConfig]);

  const handleSave = () => {
    saveMutation.mutate({
      stopLossPoints: stopLoss,
      takeProfitPoints: takeProfit,
      breakevenTriggerPoints: breakeven,
      trailingStopPoints: trailingStop,
      trailingStopTriggerPoints: trailingTrigger,
      defaultContracts: contracts,
    });
  };

  const riskBrl = stopLoss * 0.20 * contracts;
  const rewardBrl = takeProfit * 0.20 * contracts;
  const rrRatio = riskBrl > 0 ? (rewardBrl / riskBrl).toFixed(2) : "—";

  const ConfigCard = ({ icon: Icon, title, color, children }: any) => (
    <div className="rounded-xl border border-border p-5" style={{ background: "oklch(0.11 0.01 240)" }}>
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${color}20` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      {children}
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
          <Settings className="w-3 h-3 text-white" />
        </div>
        <span className="text-sm font-semibold">Configuração OCO</span>
      </header>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Resumo financeiro */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Risco (Stop)", value: `R$ ${riskBrl.toFixed(2)}`, color: "#ef4444" },
            { label: "Retorno (Gain)", value: `R$ ${rewardBrl.toFixed(2)}`, color: "#22c55e" },
            { label: "Ratio R/R", value: `1 : ${rrRatio}`, color: "#d97706" },
            { label: "Contratos", value: `${contracts}`, color: "#06b6d4" },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-border p-4 text-center"
              style={{ background: "oklch(0.11 0.01 240)" }}>
              <p className="text-[11px] text-muted-foreground mb-1">{item.label}</p>
              <p className="font-trading text-base font-bold" style={{ color: item.color }}>{item.value}</p>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Stop Loss */}
          <ConfigCard icon={Shield} title="Stop Loss" color="#ef4444">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Pontos de perda máxima</Label>
                <span className="font-trading text-sm font-semibold text-sell">{stopLoss} pts</span>
              </div>
              <Slider value={[stopLoss]} onValueChange={([v]) => setStopLoss(v)}
                min={100} max={150} step={5} className="w-full" />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>100 pts (mín)</span><span>150 pts (máx)</span>
              </div>
              <p className="text-[11px] text-muted-foreground bg-secondary/50 rounded-lg p-2.5">
                Perda máxima: <span className="text-sell font-semibold">R$ {riskBrl.toFixed(2)}</span> com {contracts} contratos
              </p>
            </div>
          </ConfigCard>

          {/* Take Profit */}
          <ConfigCard icon={Target} title="Take Profit (Gain)" color="#22c55e">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Pontos de lucro alvo</Label>
                <span className="font-trading text-sm font-semibold text-buy">{takeProfit} pts</span>
              </div>
              <Slider value={[takeProfit]} onValueChange={([v]) => setTakeProfit(v)}
                min={150} max={250} step={5} className="w-full" />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>150 pts (mín)</span><span>250 pts (máx)</span>
              </div>
              <p className="text-[11px] text-muted-foreground bg-secondary/50 rounded-lg p-2.5">
                Lucro alvo: <span className="text-buy font-semibold">R$ {rewardBrl.toFixed(2)}</span> com {contracts} contratos
              </p>
            </div>
          </ConfigCard>

          {/* Breakeven */}
          <ConfigCard icon={Activity} title="Auto Breakeven" color="#d97706">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Disparo do breakeven</Label>
                <span className="font-trading text-sm font-semibold" style={{ color: "#d97706" }}>{breakeven} pts</span>
              </div>
              <Slider value={[breakeven]} onValueChange={([v]) => setBreakeven(v)}
                min={50} max={150} step={5} className="w-full" />
              <p className="text-[11px] text-muted-foreground bg-secondary/50 rounded-lg p-2.5">
                Quando o mercado andar <strong>{breakeven} pontos</strong> a seu favor, o stop é movido para o ponto de entrada (zero a zero).
              </p>
            </div>
          </ConfigCard>

          {/* Trailing Stop */}
          <ConfigCard icon={TrendingUp} title="Trailing Stop (Stop Móvel)" color="#a855f7">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Distância do trailing</Label>
                <span className="font-trading text-sm font-semibold" style={{ color: "#a855f7" }}>{trailingStop} pts</span>
              </div>
              <Slider value={[trailingStop]} onValueChange={([v]) => setTrailingStop(v)}
                min={25} max={100} step={5} className="w-full" />
              <div className="flex items-center justify-between mt-1">
                <Label className="text-xs text-muted-foreground">Disparo do trailing</Label>
                <span className="font-trading text-xs font-semibold" style={{ color: "#a855f7" }}>{trailingTrigger} pts</span>
              </div>
              <Slider value={[trailingTrigger]} onValueChange={([v]) => setTrailingTrigger(v)}
                min={100} max={200} step={5} className="w-full" />
              <p className="text-[11px] text-muted-foreground bg-secondary/50 rounded-lg p-2.5">
                Ativa após <strong>{trailingTrigger} pts</strong> de lucro. O stop persegue o preço mantendo <strong>{trailingStop} pts</strong> de distância.
              </p>
            </div>
          </ConfigCard>
        </div>

        {/* Contratos */}
        <div className="rounded-xl border border-border p-5" style={{ background: "oklch(0.11 0.01 240)" }}>
          <h3 className="text-sm font-semibold mb-4">Número de Contratos Padrão</h3>
          <div className="flex items-center gap-4">
            <Slider value={[contracts]} onValueChange={([v]) => setContracts(v)}
              min={1} max={15} step={1} className="flex-1" />
            <div className="font-trading text-2xl font-bold w-12 text-center"
              style={{ color: "oklch(0.65 0.18 195)" }}>{contracts}</div>
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>1 contrato</span><span>15 contratos (máx sugerido)</span>
          </div>
        </div>

        {/* Visualização da estratégia */}
        <div className="rounded-xl border border-border p-5" style={{ background: "oklch(0.11 0.01 240)" }}>
          <h3 className="text-sm font-semibold mb-4">Visualização da Estratégia</h3>
          <div className="relative h-32 rounded-lg overflow-hidden" style={{ background: "oklch(0.09 0.01 240)" }}>
            <div className="absolute inset-0 flex items-center justify-center">
              {/* Linha de entrada */}
              <div className="absolute w-full border-t-2 border-dashed border-primary/60" style={{ top: "50%" }}>
                <span className="absolute right-2 -top-4 text-[10px] font-trading text-primary">ENTRADA</span>
              </div>
              {/* Take Profit */}
              <div className="absolute w-full border-t border-dashed" style={{ top: "15%", borderColor: "#22c55e" }}>
                <span className="absolute right-2 -top-4 text-[10px] font-trading text-buy">+{takeProfit} pts</span>
              </div>
              {/* Breakeven */}
              <div className="absolute w-full border-t border-dotted" style={{ top: "35%", borderColor: "#d97706" }}>
                <span className="absolute right-2 -top-4 text-[10px] font-trading" style={{ color: "#d97706" }}>BE +{breakeven} pts</span>
              </div>
              {/* Stop Loss */}
              <div className="absolute w-full border-t border-dashed" style={{ top: "80%", borderColor: "#ef4444" }}>
                <span className="absolute right-2 -top-4 text-[10px] font-trading text-sell">-{stopLoss} pts</span>
              </div>
            </div>
          </div>
        </div>

        <Button onClick={handleSave} disabled={saveMutation.isPending}
          className="w-full h-11 font-semibold text-sm"
          style={{ background: "linear-gradient(135deg, oklch(0.65 0.18 195), oklch(0.55 0.22 250))" }}>
          <Save className="w-4 h-4 mr-2" />
          {saveMutation.isPending ? "Salvando..." : "Salvar Configuração OCO"}
        </Button>
      </div>
    </div>
  );
}
