import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, BookOpen, ChevronDown, ChevronRight, Copy, Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Step {
  id: string;
  title: string;
  content: React.ReactNode;
}

const CodeBlock = ({ code, lang = "bash" }: { code: string; lang?: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Copiado!");
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative rounded-lg overflow-hidden mt-2 mb-3">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border"
        style={{ background: "oklch(0.13 0.01 240)" }}>
        <span className="text-[10px] text-muted-foreground font-mono">{lang}</span>
        <button onClick={handleCopy} className="text-muted-foreground hover:text-foreground transition-colors">
          {copied ? <Check className="w-3 h-3 text-buy" /> : <Copy className="w-3 h-3" />}
        </button>
      </div>
      <pre className="p-3 text-[11px] font-mono text-foreground overflow-x-auto"
        style={{ background: "oklch(0.09 0.01 240)" }}>
        <code>{code}</code>
      </pre>
    </div>
  );
};

const steps: Step[] = [
  {
    id: "1",
    title: "Pré-requisitos: Conta PJ e Acesso ao Developer Portal",
    content: (
      <div className="space-y-3 text-xs text-muted-foreground">
        <p>Para acessar as APIs de investimentos do Banco Inter, você precisa de:</p>
        <ul className="space-y-1.5 ml-4">
          <li>• <strong className="text-foreground">Conta Pessoa Jurídica (PJ)</strong> ativa no Banco Inter</li>
          <li>• Acesso ao <strong className="text-foreground">Inter Developer Portal</strong>: <a href="https://developers.inter.co" target="_blank" className="underline" style={{ color: "oklch(0.65 0.18 195)" }}>developers.inter.co</a></li>
          <li>• Certificado digital <strong className="text-foreground">A1 ou A3</strong> (mTLS) para autenticação</li>
          <li>• Aprovação do Inter para acesso à API de Investimentos (solicitar via portal)</li>
        </ul>
        <div className="rounded-lg p-3 border" style={{ borderColor: "#d97706", background: "rgba(217,119,6,0.08)" }}>
          <p className="font-semibold text-foreground mb-1">⚠ Importante</p>
          <p>A API de Investimentos do Banco Inter é voltada para <strong>clientes PJ</strong>. Clientes PF têm acesso limitado. Verifique a disponibilidade com o seu gerente de conta Inter.</p>
        </div>
      </div>
    ),
  },
  {
    id: "2",
    title: "Criação da Aplicação no Developer Portal",
    content: (
      <div className="space-y-3 text-xs text-muted-foreground">
        <ol className="space-y-2 ml-4">
          <li>1. Acesse <a href="https://cdpj.partners.bancointer.com.br" target="_blank" className="underline" style={{ color: "oklch(0.65 0.18 195)" }}>cdpj.partners.bancointer.com.br</a></li>
          <li>2. Faça login com suas credenciais PJ</li>
          <li>3. Vá em <strong className="text-foreground">Minhas Aplicações → Nova Aplicação</strong></li>
          <li>4. Selecione os escopos necessários:
            <ul className="ml-4 mt-1 space-y-0.5">
              <li>• <code className="bg-secondary px-1 rounded">investment-read</code> — Leitura de posições</li>
              <li>• <code className="bg-secondary px-1 rounded">investment-write</code> — Envio de ordens</li>
              <li>• <code className="bg-secondary px-1 rounded">account-read</code> — Saldo e extrato</li>
            </ul>
          </li>
          <li>5. Anote o <strong className="text-foreground">client_id</strong> gerado</li>
          <li>6. Faça upload do seu certificado digital (.crt)</li>
        </ol>
      </div>
    ),
  },
  {
    id: "3",
    title: "Geração do Certificado mTLS",
    content: (
      <div className="space-y-3 text-xs text-muted-foreground">
        <p>O Banco Inter usa <strong className="text-foreground">mTLS (Mutual TLS)</strong> para autenticação. Gere um par de chaves:</p>
        <CodeBlock lang="bash" code={`# Gerar chave privada
openssl genrsa -out chave_privada.key 2048

# Gerar CSR (Certificate Signing Request)
openssl req -new -key chave_privada.key -out certificado.csr \\
  -subj "/C=BR/ST=SP/L=Sao Paulo/O=Iannini Day Trade/CN=ianninidaytrade.com.br"

# Gerar certificado autoassinado (para testes)
openssl x509 -req -days 365 -in certificado.csr \\
  -signkey chave_privada.key -out certificado.crt`} />
        <p>Faça upload do <code className="bg-secondary px-1 rounded">certificado.crt</code> no portal do Inter. Guarde o <code className="bg-secondary px-1 rounded">chave_privada.key</code> em local seguro.</p>
      </div>
    ),
  },
  {
    id: "4",
    title: "Autenticação OAuth 2.0 — Obtenção do Token",
    content: (
      <div className="space-y-3 text-xs text-muted-foreground">
        <p>O Inter usa <strong className="text-foreground">OAuth 2.0 com Client Credentials</strong> + mTLS:</p>
        <CodeBlock lang="bash" code={`# Obter token de acesso
curl -X POST https://cdpj.partners.bancointer.com.br/oauth/v2/token \\
  --cert certificado.crt \\
  --key chave_privada.key \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "client_id=SEU_CLIENT_ID" \\
  -d "client_secret=SEU_CLIENT_SECRET" \\
  -d "grant_type=client_credentials" \\
  -d "scope=investment-read investment-write"`} />
        <p>Resposta esperada:</p>
        <CodeBlock lang="json" code={`{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "investment-read investment-write"
}`} />
        <p>O token expira em <strong className="text-foreground">1 hora</strong>. Implemente renovação automática.</p>
      </div>
    ),
  },
  {
    id: "5",
    title: "Endpoints de Investimentos — Consultas",
    content: (
      <div className="space-y-3 text-xs text-muted-foreground">
        <p><strong className="text-foreground">Base URL:</strong> <code className="bg-secondary px-1 rounded">https://cdpj.partners.bancointer.com.br</code></p>
        <CodeBlock lang="bash" code={`# Consultar posição em renda variável
curl -X GET \\
  "https://cdpj.partners.bancointer.com.br/investimentos/v1/acoes/posicao" \\
  --cert certificado.crt --key chave_privada.key \\
  -H "Authorization: Bearer SEU_TOKEN" \\
  -H "x-conta-corrente: NUMERO_DA_CONTA"

# Consultar extrato de operações
curl -X GET \\
  "https://cdpj.partners.bancointer.com.br/investimentos/v1/acoes/extrato?dataInicio=2026-01-01&dataFim=2026-05-07" \\
  --cert certificado.crt --key chave_privada.key \\
  -H "Authorization: Bearer SEU_TOKEN" \\
  -H "x-conta-corrente: NUMERO_DA_CONTA"`} />
      </div>
    ),
  },
  {
    id: "6",
    title: "Endpoints de Ordens — Envio e Cancelamento",
    content: (
      <div className="space-y-3 text-xs text-muted-foreground">
        <p><strong className="text-foreground">Envio de Ordem de Compra/Venda:</strong></p>
        <CodeBlock lang="bash" code={`# Enviar ordem de compra (mercado futuro)
curl -X POST \\
  "https://cdpj.partners.bancointer.com.br/investimentos/v1/acoes/ordens" \\
  --cert certificado.crt --key chave_privada.key \\
  -H "Authorization: Bearer SEU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -H "x-conta-corrente: NUMERO_DA_CONTA" \\
  -d '{
    "codigoAtivo": "WINFUT",
    "tipoOrdem": "MERCADO",
    "ladoOrdem": "COMPRA",
    "quantidade": 5,
    "prazoOrdem": "DIA"
  }'`} />
        <CodeBlock lang="bash" code={`# Cancelar ordem
curl -X DELETE \\
  "https://cdpj.partners.bancointer.com.br/investimentos/v1/acoes/ordens/ID_DA_ORDEM" \\
  --cert certificado.crt --key chave_privada.key \\
  -H "Authorization: Bearer SEU_TOKEN" \\
  -H "x-conta-corrente: NUMERO_DA_CONTA"`} />
        <div className="rounded-lg p-3 border" style={{ borderColor: "#ef4444", background: "rgba(239,68,68,0.08)" }}>
          <p className="font-semibold text-foreground mb-1">⚠ Atenção</p>
          <p>A API de futuros (WIN, WDO) pode ter disponibilidade limitada. Confirme com o Inter se sua conta tem acesso a derivativos via API. Algumas operações exigem habilitação especial.</p>
        </div>
      </div>
    ),
  },
  {
    id: "7",
    title: "Integração com Node.js — Código de Exemplo",
    content: (
      <div className="space-y-3 text-xs text-muted-foreground">
        <CodeBlock lang="typescript" code={`import axios from 'axios';
import https from 'https';
import fs from 'fs';
import qs from 'querystring';

const INTER_BASE = 'https://cdpj.partners.bancointer.com.br';

// Agente HTTPS com certificado mTLS
const httpsAgent = new https.Agent({
  cert: fs.readFileSync('./certificado.crt'),
  key: fs.readFileSync('./chave_privada.key'),
});

// Obter token OAuth 2.0
async function getToken(): Promise<string> {
  const { data } = await axios.post(
    \`\${INTER_BASE}/oauth/v2/token\`,
    qs.stringify({
      client_id: process.env.INTER_CLIENT_ID,
      client_secret: process.env.INTER_CLIENT_SECRET,
      grant_type: 'client_credentials',
      scope: 'investment-read investment-write',
    }),
    { httpsAgent, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return data.access_token;
}

// Enviar ordem
async function sendOrder(side: 'COMPRA' | 'VENDA', qty: number) {
  const token = await getToken();
  const { data } = await axios.post(
    \`\${INTER_BASE}/investimentos/v1/acoes/ordens\`,
    {
      codigoAtivo: 'WINFUT',
      tipoOrdem: 'MERCADO',
      ladoOrdem: side,
      quantidade: qty,
      prazoOrdem: 'DIA',
    },
    {
      httpsAgent,
      headers: {
        Authorization: \`Bearer \${token}\`,
        'x-conta-corrente': process.env.INTER_CONTA,
        'Content-Type': 'application/json',
      },
    }
  );
  return data;
}`} />
      </div>
    ),
  },
  {
    id: "8",
    title: "Variáveis de Ambiente e Segurança",
    content: (
      <div className="space-y-3 text-xs text-muted-foreground">
        <p>Configure as seguintes variáveis de ambiente no servidor:</p>
        <CodeBlock lang="env" code={`# .env (NUNCA commitar no Git)
INTER_CLIENT_ID=seu_client_id_aqui
INTER_CLIENT_SECRET=seu_client_secret_aqui
INTER_CONTA=numero_da_conta_corrente
INTER_CERT_PATH=./certs/certificado.crt
INTER_KEY_PATH=./certs/chave_privada.key`} />
        <div className="space-y-2">
          <p className="font-semibold text-foreground">Boas práticas de segurança:</p>
          <ul className="space-y-1 ml-4">
            <li>• Nunca exponha o <code className="bg-secondary px-1 rounded">client_secret</code> no frontend</li>
            <li>• Armazene certificados fora do repositório Git</li>
            <li>• Use variáveis de ambiente para todas as credenciais</li>
            <li>• Implemente rate limiting nas chamadas à API</li>
            <li>• Registre todas as ordens enviadas em banco de dados</li>
          </ul>
        </div>
      </div>
    ),
  },
];

export default function BancoInterGuide() {
  const [openStep, setOpenStep] = useState<string | null>("1");

  return (
    <div className="min-h-screen bg-background" style={{ fontFamily: "'Inter', sans-serif" }}>
      <header className="h-12 border-b border-border flex items-center px-4 gap-3"
        style={{ background: "oklch(0.09 0.01 240)" }}>
        <a href="/workspace" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </a>
        <div className="w-5 h-5 rounded flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, oklch(0.65 0.18 195), oklch(0.55 0.22 250))" }}>
          <BookOpen className="w-3 h-3 text-white" />
        </div>
        <span className="text-sm font-semibold">Guia de Integração — Banco Inter API</span>
        <a href="https://developers.inter.co" target="_blank"
          className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ExternalLink className="w-3 h-3" />
          <span className="hidden sm:block">developers.inter.co</span>
        </a>
      </header>

      <div className="max-w-3xl mx-auto p-6 space-y-3">
        <div className="rounded-xl border border-border p-4 text-xs mb-5"
          style={{ background: "oklch(0.11 0.01 240)", borderColor: "oklch(0.65 0.18 195 / 0.3)" }}>
          <p className="font-semibold mb-1" style={{ color: "oklch(0.65 0.18 195)" }}>Sobre este Guia</p>
          <p className="text-muted-foreground">
            Este guia apresenta o passo a passo para integrar a plataforma com a API de Investimentos do Banco Inter,
            permitindo envio de ordens, consulta de posições e extrato diretamente do workspace.
            Siga cada etapa na ordem apresentada.
          </p>
        </div>

        {steps.map((step, idx) => (
          <div key={step.id} className="rounded-xl border border-border overflow-hidden"
            style={{ background: "oklch(0.11 0.01 240)" }}>
            <button
              className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-secondary/30 transition-colors"
              onClick={() => setOpenStep(openStep === step.id ? null : step.id)}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold"
                style={{ background: "oklch(0.65 0.18 195 / 0.2)", color: "oklch(0.65 0.18 195)" }}>
                {idx + 1}
              </div>
              <span className="text-sm font-medium flex-1">{step.title}</span>
              {openStep === step.id
                ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
            </button>
            {openStep === step.id && (
              <div className="px-5 pb-5 border-t border-border">
                <div className="pt-4">{step.content}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
