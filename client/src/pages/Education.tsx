import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  GraduationCap, TrendingUp, ListChecks, BookOpen,
  ChevronDown, ChevronUp, RefreshCw, Wrench,
} from "lucide-react";

export default function Education() {
  const { data: narrative, refetch, isFetching } =
    trpc.education.getMarketNarrative.useQuery(undefined, {
      refetchInterval: 5 * 60 * 1000, // 5 min
    });
  const { data: content } = trpc.education.getContent.useQuery();
  const { data: guide } = trpc.integration.getProfitGuide.useQuery();

  const [openTopic, setOpenTopic] = useState<string | null>(null);
  const [openGuide, setOpenGuide] = useState<number | null>(0);

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-primary" />
            Educação
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Aprenda com o mercado em tempo real
          </p>
        </div>
        <Button onClick={() => refetch()} disabled={isFetching} size="sm" variant="outline" className="gap-2">
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Seção 1 — O Mercado Agora */}
      <Card className="border-primary/20" style={{ background: "oklch(0.10 0.01 240)" }}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            O Mercado Agora
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: (narrative?.narrative ?? "Carregando análise do mercado…")
                .replace(/\*\*(.+?)\*\*/g, '<strong class="text-foreground">$1</strong>'),
            }}
          />
          {narrative?.generatedAt && (
            <p className="text-[10px] text-muted-foreground mt-2">
              Atualizado às {new Date(narrative.generatedAt).toLocaleTimeString("pt-BR")} · atualiza a cada 5 min
            </p>
          )}
        </CardContent>
      </Card>

      {/* Seção 2 — O Que Fazer Agora */}
      {narrative?.steps && narrative.steps.length > 0 && (
        <Card className="border-border" style={{ background: "oklch(0.10 0.01 240)" }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-primary" />
              O Que Fazer Agora
            </CardTitle>
          </CardHeader>
          <CardContent>
            {narrative.signal && (
              <div className="mb-3 flex items-center gap-2 text-xs">
                <Badge variant="outline" className={
                  narrative.signal.signalType === "buy" ? "text-buy border-buy/40" :
                  narrative.signal.signalType === "sell" ? "text-sell border-sell/40" :
                  "text-amber-400 border-amber-400/40"
                }>
                  {narrative.signal.signalType === "buy" ? "COMPRA" :
                   narrative.signal.signalType === "sell" ? "VENDA" :
                   narrative.signal.signalType === "avoid" ? "EVITAR" : "NEUTRO"}
                </Badge>
                <span className="text-muted-foreground">Confiança: {narrative.signal.confidence}%</span>
              </div>
            )}
            <ol className="space-y-2 text-sm">
              {narrative.steps.map((step: string, i: number) => (
                <li key={i} className="flex gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-muted-foreground leading-relaxed"
                    dangerouslySetInnerHTML={{
                      __html: step.replace(/\*\*(.+?)\*\*/g, '<strong class="text-foreground">$1</strong>'),
                    }}
                  />
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* Seção 3 — Aprenda com o Mercado */}
      <Card className="border-border" style={{ background: "oklch(0.10 0.01 240)" }}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            Aprenda com o Mercado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {content?.topics?.map((t: any) => {
            const open = openTopic === t.topic;
            return (
              <div key={t.topic} className="rounded-lg border border-border/30 overflow-hidden">
                <button
                  onClick={() => setOpenTopic(open ? null : t.topic)}
                  className="w-full px-3 py-2.5 flex items-center justify-between text-sm text-foreground hover:bg-muted/10 transition-colors"
                >
                  <span className="font-medium">{t.title}</span>
                  {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>
                {open && (
                  <div className="px-3 pb-3 text-sm text-muted-foreground leading-relaxed whitespace-pre-line border-t border-border/20 pt-2"
                    dangerouslySetInnerHTML={{
                      __html: t.content.replace(/\*\*(.+?)\*\*/g, '<strong class="text-foreground">$1</strong>'),
                    }}
                  />
                )}
              </div>
            );
          }) ?? <p className="text-sm text-muted-foreground">Carregando conteúdo…</p>}
        </CardContent>
      </Card>

      {/* Guia de Integração Profit One Pro (P6) */}
      <Card className="border-border" style={{ background: "oklch(0.10 0.01 240)" }}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Wrench className="w-4 h-4 text-primary" />
            Guia: Integração com Profit One Pro
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {guide?.sections?.map((s: any, i: number) => {
            const open = openGuide === i;
            return (
              <div key={i} className="rounded-lg border border-border/30 overflow-hidden">
                <button
                  onClick={() => setOpenGuide(open ? null : i)}
                  className="w-full px-3 py-2.5 flex items-center justify-between text-sm text-foreground hover:bg-muted/10 transition-colors"
                >
                  <span className="font-medium">{s.title}</span>
                  {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>
                {open && (
                  <div className="px-3 pb-3 text-sm text-muted-foreground leading-relaxed whitespace-pre-line border-t border-border/20 pt-2">
                    {s.content}
                  </div>
                )}
              </div>
            );
          }) ?? <p className="text-sm text-muted-foreground">Carregando guia…</p>}
        </CardContent>
      </Card>
    </div>
  );
}
