import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ArrowLeft, Calendar, AlertTriangle, Clock, Globe, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface EconomicEvent {
  id: string;
  time: string;
  country: string;
  event: string;
  impact: 1 | 2 | 3;
  previous: string;
  forecast: string;
  actual?: string;
}

// Dados simulados de eventos econômicos relevantes para o mercado brasileiro
const SAMPLE_EVENTS: EconomicEvent[] = [
  { id: "1", time: "09:00", country: "BR", event: "IPCA (MoM)", impact: 3, previous: "0.38%", forecast: "0.42%", actual: "0.44%" },
  { id: "2", time: "09:30", country: "US", event: "CPI (YoY)", impact: 3, previous: "3.2%", forecast: "3.1%", actual: undefined },
  { id: "3", time: "10:00", country: "BR", event: "Ata do COPOM", impact: 3, previous: "—", forecast: "—", actual: undefined },
  { id: "4", time: "10:30", country: "US", event: "Initial Jobless Claims", impact: 2, previous: "220K", forecast: "215K", actual: undefined },
  { id: "5", time: "11:00", country: "BR", event: "Balança Comercial", impact: 2, previous: "R$ 8.2B", forecast: "R$ 7.9B", actual: undefined },
  { id: "6", time: "14:00", country: "US", event: "FOMC Minutes", impact: 3, previous: "—", forecast: "—", actual: undefined },
  { id: "7", time: "14:30", country: "US", event: "Core PCE (MoM)", impact: 3, previous: "0.2%", forecast: "0.2%", actual: undefined },
  { id: "8", time: "15:00", country: "BR", event: "IGP-M (MoM)", impact: 2, previous: "0.15%", forecast: "0.20%", actual: undefined },
  { id: "9", time: "16:00", country: "US", event: "Michigan Consumer Sentiment", impact: 2, previous: "68.2", forecast: "69.0", actual: undefined },
  { id: "10", time: "17:00", country: "BR", event: "Resultado Primário do Governo", impact: 3, previous: "-R$ 15.2B", forecast: "-R$ 12.0B", actual: undefined },
];

const IMPACT_COLORS = {
  1: { bg: "rgba(34,197,94,0.15)", text: "#22c55e", label: "Baixo" },
  2: { bg: "rgba(217,119,6,0.15)", text: "#d97706", label: "Médio" },
  3: { bg: "rgba(239,68,68,0.15)", text: "#ef4444", label: "Alto" },
};

export default function EconomicCalendar() {
  const [filter, setFilter] = useState<0 | 1 | 2 | 3>(0);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const currentHHMM = currentTime.getHours() * 60 + currentTime.getMinutes();

  const filtered = SAMPLE_EVENTS.filter(e => filter === 0 || e.impact === filter);

  const isPast = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    return (h * 60 + m) < currentHHMM;
  };

  const isNear = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    const diff = (h * 60 + m) - currentHHMM;
    return diff >= 0 && diff <= 30;
  };

  const highImpactNext = filtered.find(e => e.impact === 3 && !isPast(e.time));

  return (
    <div className="min-h-screen bg-background" style={{ fontFamily: "'Inter', sans-serif" }}>
      <header className="h-12 border-b border-border flex items-center px-4 gap-3"
        style={{ background: "oklch(0.09 0.01 240)" }}>
        <a href="/workspace" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </a>
        <div className="w-5 h-5 rounded flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, oklch(0.65 0.18 195), oklch(0.55 0.22 250))" }}>
          <Calendar className="w-3 h-3 text-white" />
        </div>
        <span className="text-sm font-semibold">Calendário Econômico</span>
        <div className="ml-auto font-trading text-xs text-muted-foreground">
          {currentTime.toLocaleTimeString("pt-BR")}
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-6 space-y-4">
        {/* Alerta de próximo evento de alto impacto */}
        {highImpactNext && isNear(highImpactNext.time) && (
          <div className="rounded-xl border p-4 flex items-start gap-3"
            style={{ borderColor: "#ef4444", background: "rgba(239,68,68,0.08)" }}>
            <AlertTriangle className="w-4 h-4 text-sell shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-sell">Evento de Alto Impacto em breve!</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                <strong>{highImpactNext.event}</strong> ({highImpactNext.country}) às {highImpactNext.time}.
                Considere reduzir ou encerrar posições antes do evento.
              </p>
            </div>
          </div>
        )}

        {/* Aviso geral */}
        <div className="rounded-xl border border-border p-4 text-xs text-muted-foreground"
          style={{ background: "oklch(0.11 0.01 240)" }}>
          <p className="font-semibold text-foreground mb-1">Regra de Ouro para Eventos de Alto Impacto (⭐⭐⭐)</p>
          <p>Não abra novas posições 15 minutos antes e 15 minutos após eventos de 3 estrelas. A volatilidade pode acionar stops inesperadamente. Se já estiver posicionado, considere reduzir contratos ou mover o stop para o breakeven.</p>
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Filtrar:</span>
          {[
            { value: 0, label: "Todos" },
            { value: 3, label: "⭐⭐⭐ Alto" },
            { value: 2, label: "⭐⭐ Médio" },
            { value: 1, label: "⭐ Baixo" },
          ].map(f => (
            <button key={f.value}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors border ${
                filter === f.value
                  ? "border-primary text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
              style={filter === f.value ? { background: "oklch(0.65 0.18 195 / 0.15)" } : { background: "oklch(0.11 0.01 240)" }}
              onClick={() => setFilter(f.value as any)}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Tabela de eventos */}
        <div className="rounded-xl border border-border overflow-hidden" style={{ background: "oklch(0.11 0.01 240)" }}>
          <div className="px-5 py-3 border-b border-border flex items-center gap-2">
            <Globe className="w-3.5 h-3.5 text-muted-foreground" />
            <h3 className="text-sm font-semibold">
              {new Date().toLocaleDateString("pt-BR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </h3>
          </div>

          <div className="divide-y divide-border/50">
            {filtered.map(event => {
              const past = isPast(event.time);
              const near = isNear(event.time);
              const impact = IMPACT_COLORS[event.impact];

              return (
                <div key={event.id}
                  className={`flex items-center gap-4 px-5 py-3 transition-colors ${
                    near ? "bg-sell/5" : past ? "opacity-50" : "hover:bg-secondary/30"
                  }`}>
                  {/* Hora */}
                  <div className="w-14 shrink-0 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span className="font-trading text-xs text-foreground">{event.time}</span>
                  </div>

                  {/* País */}
                  <div className="w-8 shrink-0">
                    <span className="text-xs font-semibold text-muted-foreground">{event.country}</span>
                  </div>

                  {/* Impacto */}
                  <div className="w-16 shrink-0">
                    <span className="flex items-center gap-0.5">
                      {[1, 2, 3].map(i => (
                        <Star key={i} className="w-2.5 h-2.5"
                          fill={i <= event.impact ? impact.text : "none"}
                          style={{ color: i <= event.impact ? impact.text : "oklch(0.30 0.01 240)" }} />
                      ))}
                    </span>
                  </div>

                  {/* Evento */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium truncate ${near ? "text-sell" : "text-foreground"}`}>
                      {event.event}
                      {near && <span className="ml-2 text-[10px] text-sell font-bold">EM BREVE</span>}
                    </p>
                  </div>

                  {/* Valores */}
                  <div className="hidden md:flex items-center gap-4 text-[11px] font-trading shrink-0">
                    <div className="text-center w-16">
                      <p className="text-muted-foreground text-[9px] mb-0.5">ANTERIOR</p>
                      <p className="text-foreground">{event.previous}</p>
                    </div>
                    <div className="text-center w-16">
                      <p className="text-muted-foreground text-[9px] mb-0.5">PREVISÃO</p>
                      <p className="text-foreground">{event.forecast}</p>
                    </div>
                    <div className="text-center w-16">
                      <p className="text-muted-foreground text-[9px] mb-0.5">REAL</p>
                      <p className={event.actual ? "text-buy font-semibold" : "text-muted-foreground"}>
                        {event.actual ?? "—"}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Legenda */}
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
          <span className="font-medium">Legenda:</span>
          {Object.entries(IMPACT_COLORS).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ background: v.text }} />
              {v.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
