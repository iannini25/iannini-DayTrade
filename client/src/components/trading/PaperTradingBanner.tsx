import { trpc } from "@/lib/trpc";
import { AlertTriangle, AlertOctagon } from "lucide-react";

export default function PaperTradingBanner() {
  const { data: settings } = trpc.userSettings.get.useQuery();
  const { data: creds } = trpc.inter.getCredentials.useQuery();

  const isLive =
    settings?.enableLiveTrading === true && creds?.status === "active";

  if (isLive) {
    return (
      <div
        className="px-4 py-1.5 flex items-center justify-center gap-2 text-[11px] font-medium shrink-0"
        style={{ background: "oklch(0.45 0.22 25)", color: "white" }}
        role="status"
      >
        <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
        <span className="font-semibold tracking-wide">OPERAÇÃO REAL</span>
        <span className="hidden sm:inline text-white/90">
          — Ordens estão sendo enviadas ao Banco Inter. Confirme cada operação
          com cuidado.
        </span>
      </div>
    );
  }

  return (
    <div
      className="px-4 py-2 flex items-center justify-center gap-2 text-[11px] font-medium border-b border-yellow-700/40 shrink-0"
      style={{ background: "oklch(0.78 0.16 85)", color: "oklch(0.15 0.05 60)" }}
      role="status"
    >
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <span className="font-semibold tracking-wide">
        MODO SIMULAÇÃO (PAPER TRADING)
      </span>
      <span className="hidden sm:inline">
        — Nenhuma ordem é enviada para corretora real. Para operar de verdade,
        configure a integração com o Banco Inter e ative Live Trading em
        Configurações.
      </span>
    </div>
  );
}
