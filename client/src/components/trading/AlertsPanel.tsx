import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Bell, Volume2, VolumeX, Play, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  ALERT_LABELS,
  ALERT_COLORS,
  type AlertType,
  type AlertSettings,
} from "@/lib/tradingAudio";

const ALERT_TYPES: AlertType[] = [
  "order_buy",
  "order_sell",
  "vwap_cross_up",
  "vwap_cross_down",
  "stop_loss",
  "take_profit",
  "alert_generic",
];

const WAVEFORM_LABELS: Record<OscillatorType, string> = {
  sine: "Senoidal (suave)",
  triangle: "Triangular (médio)",
  square: "Quadrada (nítido)",
  sawtooth: "Dente-de-serra (agressivo)",
  custom: "Custom",
};

interface AlertsPanelProps {
  settings: AlertSettings;
  onToggle: (type: AlertType, enabled: boolean) => void;
  onUpdateConfig: (type: AlertType, patch: Partial<AlertSettings["alerts"][AlertType]>) => void;
  onUpdateMasterVolume: (v: number) => void;
  onReset: () => void;
  onTest: (type: AlertType) => void;
}

export default function AlertsPanel({
  settings,
  onToggle,
  onUpdateConfig,
  onUpdateMasterVolume,
  onReset,
  onTest,
}: AlertsPanelProps) {
  const [open, setOpen] = useState(false);

  const handleTest = useCallback((type: AlertType) => {
    onTest(type);
    toast.info(`Testando: ${ALERT_LABELS[type]}`, { duration: 1500 });
  }, [onTest]);

  const enabledCount = ALERT_TYPES.filter(t => settings.alerts[t]?.enabled).length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="relative flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-secondary"
          title="Configurar alertas sonoros">
          <Bell className="w-3.5 h-3.5" />
          <span className="hidden sm:block">Alertas</span>
          {enabledCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary" />
          )}
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto"
        style={{ background: "oklch(0.10 0.01 240)", border: "1px solid oklch(0.20 0.01 240)" }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
            <Bell className="w-4 h-4 text-primary" />
            Alertas Sonoros
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* Volume Master */}
          <div className="rounded-lg p-3 space-y-3" style={{ background: "oklch(0.13 0.01 240)" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {settings.masterVolume > 0
                  ? <Volume2 className="w-3.5 h-3.5 text-primary" />
                  : <VolumeX className="w-3.5 h-3.5 text-muted-foreground" />}
                <span className="text-xs font-medium">Volume Geral</span>
              </div>
              <span className="font-trading text-xs text-muted-foreground">
                {Math.round(settings.masterVolume * 100)}%
              </span>
            </div>
            <Slider
              min={0} max={1} step={0.05}
              value={[settings.masterVolume]}
              onValueChange={([v]) => onUpdateMasterVolume(v ?? 0)}
              className="w-full"
            />
          </div>

          {/* Lista de alertas */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Tipos de Alerta
              </span>
              <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-muted-foreground"
                onClick={() => { onReset(); toast.success("Configurações restauradas"); }}>
                <RotateCcw className="w-3 h-3" />
                Restaurar padrões
              </Button>
            </div>

            {ALERT_TYPES.map((type) => {
              const config = settings.alerts[type];
              if (!config) return null;
              const color = ALERT_COLORS[type];

              return (
                <div key={type} className="rounded-lg border overflow-hidden"
                  style={{ borderColor: "oklch(0.20 0.01 240)", background: "oklch(0.12 0.01 240)" }}>
                  {/* Linha principal */}
                  <div className="flex items-center justify-between px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                      <span className="text-xs font-medium truncate">{ALERT_LABELS[type]}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleTest(type)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        title="Testar som">
                        <Play className="w-3 h-3" />
                      </button>
                      <Switch
                        checked={config.enabled}
                        onCheckedChange={(v) => onToggle(type, v)}
                        className="scale-75"
                      />
                    </div>
                  </div>

                  {/* Configurações expandidas (só se ativo) */}
                  {config.enabled && (
                    <div className="px-3 pb-3 space-y-2 border-t"
                      style={{ borderColor: "oklch(0.18 0.01 240)" }}>
                      {/* Volume individual */}
                      <div className="flex items-center gap-3 pt-2">
                        <Label className="text-[10px] text-muted-foreground w-14 shrink-0">Volume</Label>
                        <Slider
                          min={0} max={1} step={0.05}
                          value={[config.volume]}
                          onValueChange={([v]) => onUpdateConfig(type, { volume: v ?? 0 })}
                          className="flex-1"
                        />
                        <span className="font-trading text-[10px] text-muted-foreground w-8 text-right">
                          {Math.round(config.volume * 100)}%
                        </span>
                      </div>

                      {/* Frequência */}
                      <div className="flex items-center gap-3">
                        <Label className="text-[10px] text-muted-foreground w-14 shrink-0">Tom</Label>
                        <Slider
                          min={110} max={2093} step={10}
                          value={[config.frequency]}
                          onValueChange={([v]) => onUpdateConfig(type, { frequency: v ?? 440 })}
                          className="flex-1"
                        />
                        <span className="font-trading text-[10px] text-muted-foreground w-14 text-right">
                          {config.frequency} Hz
                        </span>
                      </div>

                      {/* Forma de onda */}
                      <div className="flex items-center gap-3">
                        <Label className="text-[10px] text-muted-foreground w-14 shrink-0">Timbre</Label>
                        <Select
                          value={config.waveform}
                          onValueChange={(v) => onUpdateConfig(type, { waveform: v as OscillatorType })}>
                          <SelectTrigger className="h-6 text-[10px] flex-1"
                            style={{ background: "oklch(0.15 0.01 240)", border: "1px solid oklch(0.22 0.01 240)" }}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent style={{ background: "oklch(0.13 0.01 240)" }}>
                            {(["sine", "triangle", "square", "sawtooth"] as OscillatorType[]).map(w => (
                              <SelectItem key={w} value={w} className="text-[10px]">
                                {WAVEFORM_LABELS[w]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Nota de uso */}
          <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
            Os alertas são gerados sinteticamente via Web Audio API.<br />
            Clique em <Play className="w-2.5 h-2.5 inline" /> para testar cada som individualmente.
            As configurações são salvas automaticamente no navegador.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
