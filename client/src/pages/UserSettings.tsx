import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Settings, Shield, Zap, AlertTriangle, Save, User, Target, TrendingUp, Pause, AlertOctagon } from "lucide-react";

const RISK_PROFILES = [
  {
    id: "conservative",
    label: "Conservador",
    description: "Menor risco, operações mais seletivas",
    icon: Shield,
    color: "text-buy",
    border: "border-buy/30",
    bg: "bg-buy/5",
  },
  {
    id: "moderate",
    label: "Moderado",
    description: "Equilíbrio entre risco e retorno",
    icon: Zap,
    color: "text-amber-400",
    border: "border-amber-400/30",
    bg: "bg-amber-400/5",
  },
  {
    id: "aggressive",
    label: "Agressivo",
    description: "Maior risco, mais operações por dia",
    icon: AlertTriangle,
    color: "text-sell",
    border: "border-sell/30",
    bg: "bg-sell/5",
  },
];

export default function UserSettings() {
  const { user } = useAuth();
  const { data: settings, refetch } = trpc.userSettings.get.useQuery();
  const saveMutation = trpc.userSettings.save.useMutation();

  const [form, setForm] = useState({
    riskProfile: "moderate" as "conservative" | "moderate" | "aggressive",
    preferredContracts: 5,
    dailyGoal: 2000,
    dailyLimit: 1000,
    stopLossPoints: 150,
    takeProfitPoints: 250,
    enableAiPredictions: true,
    enableSoundAlerts: true,
    enableAutoBreakeven: true,
    pauseAfterLosses: 3,
    requireOrderConfirmation: true,
  });

  // Mutações para os toggles imediatos (kill switch + live trading)
  const toggleTradingPause = trpc.userSettings.toggleTradingPause.useMutation({
    onSuccess: (data) => {
      refetch();
      toast[data.tradingPaused ? "warning" : "success"](
        data.tradingPaused ? "Operações pausadas." : "Operações retomadas."
      );
    },
    onError: () => toast.error("Falha ao alternar pausa."),
  });

  const toggleLiveTrading = trpc.userSettings.toggleLiveTrading.useMutation({
    onSuccess: (data) => {
      refetch();
      toast[data.enableLiveTrading ? "warning" : "success"](
        data.enableLiveTrading
          ? "Live Trading ATIVADO — ordens reais serão enviadas."
          : "Live Trading desativado. De volta ao modo simulação."
      );
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    if (settings) {
      setForm({
        riskProfile: (settings.riskProfile as any) ?? "moderate",
        preferredContracts: settings.preferredContracts ?? 5,
        dailyGoal: Number(settings.dailyGoal ?? 2000),
        dailyLimit: Number(settings.dailyLimit ?? 1000),
        stopLossPoints: settings.stopLossPoints ?? 150,
        takeProfitPoints: settings.takeProfitPoints ?? 250,
        enableAiPredictions: settings.enableAiPredictions ?? true,
        enableSoundAlerts: settings.enableSoundAlerts ?? true,
        enableAutoBreakeven: settings.enableAutoBreakeven ?? true,
        pauseAfterLosses: settings.pauseAfterLosses ?? 3,
        requireOrderConfirmation: settings.requireOrderConfirmation ?? true,
      });
    }
  }, [settings]);

  const handleSave = async () => {
    try {
      await saveMutation.mutateAsync(form);
      toast.success("Configurações salvas!", { description: "Suas preferências foram atualizadas." });
      refetch();
    } catch {
      toast.error("Erro ao salvar configurações");
    }
  };

  // Cálculo de P&L potencial
  const pointValue = 0.20;
  const potentialGain = form.takeProfitPoints * pointValue * form.preferredContracts;
  const potentialLoss = form.stopLossPoints * pointValue * form.preferredContracts;
  const rr = (potentialGain / potentialLoss).toFixed(2);
  const tradesNeeded = Math.ceil(form.dailyGoal / potentialGain);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="w-6 h-6 text-primary" />
          Configurações
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Personalize seu perfil de risco e preferências operacionais
        </p>
      </div>

      {/* Perfil do usuário */}
      <Card className="border-border" style={{ background: "oklch(0.10 0.01 240)" }}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            Perfil do Trader
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="flex items-center gap-3 p-3 rounded-lg border border-border/30 mb-4" style={{ background: "oklch(0.07 0.01 240)" }}>
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-lg font-bold text-primary">
              {user?.name?.charAt(0)?.toUpperCase() ?? "T"}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{user?.name ?? "Trader"}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-3 block">Perfil de Risco</Label>
          <div className="grid grid-cols-3 gap-3">
            {RISK_PROFILES.map((profile) => {
              const Icon = profile.icon;
              const isSelected = form.riskProfile === profile.id;
              return (
                <button
                  key={profile.id}
                  onClick={() => setForm(f => ({ ...f, riskProfile: profile.id as any }))}
                  className={`p-3 rounded-xl border text-left transition-all ${isSelected ? `${profile.border} ${profile.bg}` : "border-border hover:border-border/60"}`}
                >
                  <Icon className={`w-5 h-5 mb-2 ${isSelected ? profile.color : "text-muted-foreground"}`} />
                  <p className={`text-sm font-semibold ${isSelected ? profile.color : "text-foreground"}`}>{profile.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{profile.description}</p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Parâmetros operacionais */}
      <Card className="border-border" style={{ background: "oklch(0.10 0.01 240)" }}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Parâmetros Operacionais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 pb-4">
          {/* Contratos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs text-muted-foreground">Contratos Padrão</Label>
              <span className="text-sm font-bold font-trading text-foreground">{form.preferredContracts} contratos</span>
            </div>
            <Slider
              value={[form.preferredContracts]}
              onValueChange={([v]) => setForm(f => ({ ...f, preferredContracts: v! }))}
              min={1} max={15} step={1}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>1</span><span>5</span><span>10</span><span>15</span>
            </div>
          </div>

          {/* Stop Loss */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs text-muted-foreground">Stop Loss</Label>
              <span className="text-sm font-bold font-trading text-sell">{form.stopLossPoints} pontos</span>
            </div>
            <Slider
              value={[form.stopLossPoints]}
              onValueChange={([v]) => setForm(f => ({ ...f, stopLossPoints: v! }))}
              min={100} max={150} step={10}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>100 pts</span><span>125 pts</span><span>150 pts</span>
            </div>
          </div>

          {/* Take Profit */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs text-muted-foreground">Take Profit</Label>
              <span className="text-sm font-bold font-trading text-buy">{form.takeProfitPoints} pontos</span>
            </div>
            <Slider
              value={[form.takeProfitPoints]}
              onValueChange={([v]) => setForm(f => ({ ...f, takeProfitPoints: v! }))}
              min={150} max={250} step={10}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>150 pts</span><span>200 pts</span><span>250 pts</span>
            </div>
          </div>

          {/* Metas */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs text-muted-foreground">Meta Diária</Label>
                <span className="text-sm font-bold font-trading text-buy">R$ {form.dailyGoal.toLocaleString("pt-BR")}</span>
              </div>
              <Slider
                value={[form.dailyGoal]}
                onValueChange={([v]) => setForm(f => ({ ...f, dailyGoal: v! }))}
                min={500} max={10000} step={500}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs text-muted-foreground">Limite de Perda</Label>
                <span className="text-sm font-bold font-trading text-sell">R$ {form.dailyLimit.toLocaleString("pt-BR")}</span>
              </div>
              <Slider
                value={[form.dailyLimit]}
                onValueChange={([v]) => setForm(f => ({ ...f, dailyLimit: v! }))}
                min={200} max={5000} step={200}
              />
            </div>
          </div>

          {/* Pausar após perdas */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs text-muted-foreground">Pausar após perdas consecutivas</Label>
              <span className="text-sm font-bold font-trading text-amber-400">{form.pauseAfterLosses} perdas</span>
            </div>
            <Slider
              value={[form.pauseAfterLosses]}
              onValueChange={([v]) => setForm(f => ({ ...f, pauseAfterLosses: v! }))}
              min={1} max={5} step={1}
            />
          </div>
        </CardContent>
      </Card>

      {/* Automações */}
      <Card className="border-border" style={{ background: "oklch(0.10 0.01 240)" }}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            Automações
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pb-4">
          {[
            { key: "enableAiPredictions", label: "Análise Preditiva com IA", desc: "Gerar sinais automáticos baseados em dados de mercado" },
            { key: "enableSoundAlerts", label: "Alertas Sonoros", desc: "Sons customizáveis para execução de ordens e cruzamento de VWAP" },
            { key: "enableAutoBreakeven", label: "Breakeven Automático", desc: "Mover stop para entrada ao atingir 100 pontos de lucro" },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
              <div>
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <Switch
                checked={form[key as keyof typeof form] as boolean}
                onCheckedChange={(v) => setForm(f => ({ ...f, [key]: v }))}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Simulação de resultado */}
      <Card className="border-primary/20" style={{ background: "oklch(0.10 0.01 240)" }}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            Simulação com Configuração Atual
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Ganho por Trade", value: `R$ ${potentialGain.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, color: "text-buy" },
              { label: "Perda por Trade", value: `R$ ${potentialLoss.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, color: "text-sell" },
              { label: "Risco/Retorno", value: `1:${rr}`, color: Number(rr) >= 1.5 ? "text-buy" : "text-amber-400" },
              { label: "Trades p/ Meta", value: `${tradesNeeded} trades`, color: "text-foreground" },
            ].map((m) => (
              <div key={m.label} className="rounded-lg p-3 text-center" style={{ background: "oklch(0.07 0.01 240)" }}>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{m.label}</p>
                <p className={`text-base font-bold font-trading mt-1 ${m.color}`}>{m.value}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3 text-center">
            Para atingir a meta de R$ {form.dailyGoal.toLocaleString("pt-BR")}/dia com {form.preferredContracts} contratos, são necessários {tradesNeeded} trades vencedores consecutivos.
          </p>
        </CardContent>
      </Card>

      {/* Segurança Operacional */}
      <Card className="border-amber-500/30" style={{ background: "oklch(0.10 0.01 240)" }}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-400" />
            Segurança Operacional
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pb-4">
          {/* Pausar operações (kill switch) */}
          <div className="flex items-center justify-between py-2 border-b border-border/20">
            <div>
              <p className="text-sm font-medium text-foreground flex items-center gap-2">
                <Pause className="w-3.5 h-3.5" />
                Pausar todas as operações
              </p>
              <p className="text-xs text-muted-foreground">
                Bloqueia o envio de novas ordens até que você retome manualmente.
              </p>
            </div>
            <Switch
              checked={settings?.tradingPaused ?? false}
              onCheckedChange={() => toggleTradingPause.mutate()}
              disabled={toggleTradingPause.isPending}
            />
          </div>

          {/* Confirmação dupla de ordens */}
          <div className="flex items-center justify-between py-2 border-b border-border/20">
            <div>
              <p className="text-sm font-medium text-foreground">
                Exigir confirmação dupla de ordens
              </p>
              <p className="text-xs text-muted-foreground">
                Mostra um modal de revisão (lado, contratos, preço, stop, gain, risco) antes de enviar.
              </p>
            </div>
            <Switch
              checked={form.requireOrderConfirmation}
              onCheckedChange={(v) => setForm(f => ({ ...f, requireOrderConfirmation: v }))}
            />
          </div>

          {/* Live trading */}
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-foreground flex items-center gap-2">
                <AlertOctagon className="w-3.5 h-3.5 text-loss" />
                Live Trading (ordens reais)
              </p>
              <p className="text-xs text-muted-foreground">
                Quando desligado, a plataforma opera em paper trading (simulação). Só pode ser ativado se a integração com o Banco Inter estiver com status <strong>active</strong>.
              </p>
            </div>
            <Switch
              checked={settings?.enableLiveTrading ?? false}
              onCheckedChange={(v) => toggleLiveTrading.mutate({ enabled: v })}
              disabled={toggleLiveTrading.isPending}
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saveMutation.isPending} className="w-full gap-2">
        {saveMutation.isPending ? <Save className="w-4 h-4 animate-pulse" /> : <Save className="w-4 h-4" />}
        Salvar Configurações
      </Button>
    </div>
  );
}
