import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Building2, CheckCircle, XCircle, AlertTriangle, ExternalLink,
  Copy, Terminal, Shield, Zap, BarChart3, ChevronRight,
  Lock, Key, Globe, RefreshCw, Info,
} from "lucide-react";

const PROFIT_COMPARISON = [
  { feature: "Gráfico de Candlestick (5min)", profitOne: true, thisSystem: true },
  { feature: "SuperDOM (Book de Ofertas)", profitOne: true, thisSystem: true },
  { feature: "Times & Trades (Tape Reading)", profitOne: true, thisSystem: true },
  { feature: "Ordens OCO (Stop + Gain)", profitOne: true, thisSystem: true },
  { feature: "VWAP + EMA 9/21", profitOne: true, thisSystem: true },
  { feature: "Análise Preditiva com IA", profitOne: false, thisSystem: true },
  { feature: "Painel de Resumo Diário", profitOne: false, thisSystem: true },
  { feature: "Calendário Econômico", profitOne: false, thisSystem: true },
  { feature: "Alertas Sonoros Customizáveis", profitOne: false, thisSystem: true },
  { feature: "Calculadora de Risco", profitOne: false, thisSystem: true },
  { feature: "Integração Banco Inter", profitOne: false, thisSystem: true },
  { feature: "Visão de Mercado (Índices)", profitOne: false, thisSystem: true },
];

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative rounded-lg overflow-hidden border border-border/50" style={{ background: "oklch(0.07 0.01 240)" }}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-sell/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-buy/60" />
        </div>
        <button
          onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <Copy className="w-3 h-3" />
          {copied ? "Copiado!" : "Copiar"}
        </button>
      </div>
      <pre className="p-3 text-xs text-green-400 font-mono overflow-x-auto leading-relaxed">{code}</pre>
    </div>
  );
}

function StepCard({ step, title, description, url, codeExample, scopes, required, isCompleted }: any) {
  const [expanded, setExpanded] = useState(step <= 2);
  return (
    <div className={`rounded-xl border overflow-hidden transition-all ${isCompleted ? "border-buy/30" : "border-border"}`}
      style={{ background: "oklch(0.10 0.01 240)" }}>
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-4 p-4 text-left hover:bg-muted/5 transition-colors"
      >
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${isCompleted ? "bg-buy/20 text-buy" : "bg-muted/20 text-muted-foreground"}`}>
          {isCompleted ? <CheckCircle className="w-4 h-4" /> : step}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-foreground">{title}</span>
            {required && <Badge variant="outline" className="text-[10px] border-amber-400/30 text-amber-400">Obrigatório</Badge>}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{description}</p>
        </div>
        <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`} />
      </button>
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/30 pt-3">
          <p className="text-sm text-muted-foreground">{description}</p>
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
              <ExternalLink className="w-3 h-3" /> Acessar: {url}
            </a>
          )}
          {scopes && (
            <div>
              <p className="text-xs font-semibold text-foreground mb-2">Escopos necessários:</p>
              <div className="flex flex-wrap gap-1.5">
                {scopes.map((s: string) => (
                  <Badge key={s} variant="outline" className="text-[10px] font-mono">{s}</Badge>
                ))}
              </div>
            </div>
          )}
          {codeExample && <CodeBlock code={codeExample} />}
        </div>
      )}
    </div>
  );
}

export default function InterIntegration() {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [environment, setEnvironment] = useState<"sandbox" | "production">("sandbox");
  const [isTesting, setIsTesting] = useState(false);

  const { data: guide } = trpc.inter.getSetupGuide.useQuery();
  const { data: credentials, refetch } = trpc.inter.getCredentials.useQuery();
  const saveCredsMutation = trpc.inter.saveCredentials.useMutation();
  const testConnectionMutation = trpc.inter.testConnection.useMutation();

  const handleSave = async () => {
    if (!clientId || !clientSecret) {
      toast.error("Preencha o Client ID e o Client Secret");
      return;
    }
    try {
      await saveCredsMutation.mutateAsync({ clientId, clientSecret, environment });
      toast.success("Credenciais salvas com segurança!");
      setClientId("");
      setClientSecret("");
      refetch();
    } catch {
      toast.error("Erro ao salvar credenciais");
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    try {
      const result = await testConnectionMutation.mutateAsync();
      if (result.success) {
        toast.success("Configuração validada!", { description: result.message });
      } else {
        toast.error("Falha na validação", { description: result.error });
      }
      refetch();
    } catch {
      toast.error("Erro ao testar conexão");
    } finally {
      setIsTesting(false);
    }
  };

  const isConfigured = !!credentials;
  const isActive = credentials?.status === "active";

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" />
            Integração Banco Inter
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Conecte sua conta Inter para executar ordens diretamente do workspace
          </p>
        </div>
        <Badge
          variant="outline"
          className={`text-xs ${isActive ? "border-buy/30 text-buy" : isConfigured ? "border-amber-400/30 text-amber-400" : "border-border text-muted-foreground"}`}
        >
          {isActive ? "✓ Ativo" : isConfigured ? "⏳ Configurado" : "Não configurado"}
        </Badge>
      </div>

      {/* Status atual */}
      {isConfigured && (
        <Card className="border-buy/20" style={{ background: "oklch(0.10 0.01 240)" }}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full ${isActive ? "bg-buy animate-pulse" : "bg-amber-400"}`} />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Client ID: <span className="font-mono text-primary">{credentials.clientId}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Ambiente: {credentials.environment === "production" ? "Produção" : "Sandbox"}
                    {credentials.lastTestedAt && ` · Testado: ${new Date(credentials.lastTestedAt).toLocaleString("pt-BR")}`}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTest}
                disabled={isTesting}
                className="gap-2 h-8"
              >
                {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                Testar Conexão
              </Button>
            </div>
            {credentials.lastError && (
              <div className="mt-2 flex items-center gap-2 text-xs text-sell">
                <XCircle className="w-3.5 h-3.5" />
                {credentials.lastError}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Comparativo com Profit One */}
      <Card className="border-border" style={{ background: "oklch(0.10 0.01 240)" }}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            Este Sistema vs. Profit One (Neologica)
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="grid grid-cols-3 gap-2 mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <span>Funcionalidade</span>
            <span className="text-center">Profit One</span>
            <span className="text-center">Este Sistema</span>
          </div>
          <div className="space-y-1">
            {PROFIT_COMPARISON.map((item) => (
              <div key={item.feature} className="grid grid-cols-3 gap-2 py-1.5 border-b border-border/20 last:border-0">
                <span className="text-xs text-foreground">{item.feature}</span>
                <div className="flex justify-center">
                  {item.profitOne
                    ? <CheckCircle className="w-4 h-4 text-buy" />
                    : <XCircle className="w-4 h-4 text-muted-foreground/30" />}
                </div>
                <div className="flex justify-center">
                  {item.thisSystem
                    ? <CheckCircle className="w-4 h-4 text-buy" />
                    : <XCircle className="w-4 h-4 text-muted-foreground/30" />}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Separator className="opacity-20" />

      {/* Guia de configuração */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
          <Terminal className="w-4 h-4" /> Guia de Configuração Passo a Passo
        </h2>
        <div className="space-y-3">
          {(guide?.steps ?? []).map((step) => (
            <StepCard
              key={step.step}
              {...step}
              isCompleted={step.step < 5 && isConfigured}
            />
          ))}
        </div>
      </div>

      <Separator className="opacity-20" />

      {/* Formulário de credenciais */}
      <Card className="border-border" style={{ background: "oklch(0.10 0.01 240)" }}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Key className="w-4 h-4 text-primary" />
            {isConfigured ? "Atualizar Credenciais" : "Configurar Credenciais"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pb-4">
          <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-400/20 bg-amber-400/5">
            <Shield className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-400">
              Suas credenciais são armazenadas de forma segura (client_secret é criptografado). 
              Nunca compartilhe suas chaves com terceiros.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Client ID</Label>
              <Input
                value={clientId}
                onChange={e => setClientId(e.target.value)}
                placeholder="Seu client_id do portal Inter"
                className="font-mono text-sm h-9"
                style={{ background: "oklch(0.07 0.01 240)" }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Client Secret</Label>
              <Input
                type="password"
                value={clientSecret}
                onChange={e => setClientSecret(e.target.value)}
                placeholder="Seu client_secret"
                className="font-mono text-sm h-9"
                style={{ background: "oklch(0.07 0.01 240)" }}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Ambiente</Label>
            <div className="flex gap-2">
              {(["sandbox", "production"] as const).map((env) => (
                <button
                  key={env}
                  onClick={() => setEnvironment(env)}
                  className={`flex-1 py-2 px-3 rounded-lg border text-xs font-medium transition-all ${
                    environment === env
                      ? env === "production"
                        ? "border-buy/40 bg-buy/10 text-buy"
                        : "border-primary/40 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-border/60"
                  }`}
                >
                  {env === "sandbox" ? "🧪 Sandbox (Testes)" : "🚀 Produção"}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={handleSave}
            disabled={saveCredsMutation.isPending || !clientId || !clientSecret}
            className="w-full gap-2"
          >
            {saveCredsMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            Salvar Credenciais com Segurança
          </Button>
        </CardContent>
      </Card>

      {/* Endpoints de referência */}
      {guide && (
        <Card className="border-border" style={{ background: "oklch(0.10 0.01 240)" }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Globe className="w-4 h-4 text-primary" />
              Endpoints de Referência
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pb-4">
            {Object.entries(guide.endpoints).map(([key, value]) => (
              <div key={key} className="flex items-center gap-3 py-1.5 border-b border-border/20 last:border-0">
                <Badge variant="outline" className="text-[10px] font-mono w-24 justify-center shrink-0">{key}</Badge>
                <code className="text-xs font-mono text-muted-foreground">{value as string}</code>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Nota importante */}
      <div className="flex items-start gap-2 p-4 rounded-xl border border-border/30 bg-muted/5">
        <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="text-xs text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground">Nota sobre o Certificado mTLS</p>
          <p>A API do Banco Inter exige autenticação mútua TLS (mTLS). O certificado digital (.crt) e a chave privada (.key) gerados no portal do desenvolvedor devem ser instalados no servidor desta aplicação pelo administrador.</p>
          <p>Sem o certificado mTLS, apenas as funcionalidades de leitura (saldo, extrato, carteira) podem ser testadas. Para envio de ordens de compra/venda, o certificado é obrigatório.</p>
        </div>
      </div>
    </div>
  );
}
