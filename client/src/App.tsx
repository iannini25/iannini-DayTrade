import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Link, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Login from "./pages/Login";
import Workspace from "./pages/Workspace";
import Dashboard from "./pages/Dashboard";
import RiskCalculator from "./pages/RiskCalculator";
import OcoConfig from "./pages/OcoConfig";
import EconomicCalendar from "./pages/EconomicCalendar";
import Predictions from "./pages/Predictions";
import MarketOverview from "./pages/MarketOverview";
import InterIntegration from "./pages/InterIntegration";
import UserSettings from "./pages/UserSettings";
import AiTrading from "./pages/AiTrading";
import AuthGuard from "./components/AuthGuard";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, TrendingUp, BarChart3, Calculator,
  Settings2, Calendar, Brain, Globe, Building2, LogOut,
  ChevronRight, Activity, Menu, X,
} from "lucide-react";

const NAV_ITEMS = [
  { path: "/workspace",         label: "Workspace",     icon: LayoutDashboard, group: "principal" },
  { path: "/ai-trading",        label: "IA Operacional", icon: Activity,       group: "principal" },
  { path: "/predictions",       label: "Análise IA",    icon: Brain,           group: "principal" },
  { path: "/market",            label: "Mercado",       icon: Globe,           group: "principal" },
  { path: "/dashboard",         label: "Performance",   icon: BarChart3,       group: "análise" },
  { path: "/risk-calculator",   label: "Calculadora",   icon: Calculator,      group: "análise" },
  { path: "/oco-config",        label: "Config. OCO",   icon: Settings2,       group: "análise" },
  { path: "/economic-calendar", label: "Calendário",    icon: Calendar,        group: "ferramentas" },
  { path: "/inter",             label: "Banco Inter",   icon: Building2,       group: "ferramentas" },
  { path: "/settings",          label: "Configurações", icon: TrendingUp,      group: "ferramentas" },
];

const GROUP_LABELS: Record<string, string> = {
  principal: "Principal",
  análise: "Análise",
  ferramentas: "Ferramentas",
};

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const groups = ["principal", "análise", "ferramentas"];

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-border/20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Activity className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground leading-tight">Iannini</p>
            <p className="text-[10px] text-muted-foreground leading-tight">Day Trade</p>
          </div>
        </div>
      </div>

      {/* Navegação */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {groups.map((group) => {
          const items = NAV_ITEMS.filter(i => i.group === group);
          return (
            <div key={group}>
              <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest px-2 mb-1">
                {GROUP_LABELS[group]}
              </p>
              {items.map(({ path, label, icon: Icon }) => {
                const isActive = location === path || (path !== "/" && location.startsWith(path));
                return (
                  <Link key={path} href={path} onClick={onNavigate}>
                    <div className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all cursor-pointer ${
                      isActive
                        ? "bg-primary/15 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/10"
                    }`}>
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{label}</span>
                      {isActive && <ChevronRight className="w-3 h-3 ml-auto shrink-0" />}
                    </div>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Usuário */}
      <div className="border-t border-border/20 p-3">
        <div className="flex items-center gap-2 px-1 mb-2">
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
            {user?.name?.charAt(0)?.toUpperCase() ?? "T"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">{user?.name ?? "Trader"}</p>
            <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={() => logout()}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-red-400 hover:bg-red-400/5 transition-all"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sair
        </button>
      </div>
    </div>
  );
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [location] = useLocation();

  // Fechar sidebar ao navegar no mobile
  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  // Fechar sidebar ao pressionar Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="flex min-h-screen" style={{ background: "oklch(0.09 0.01 240)" }}>

      {/* ── Sidebar Desktop (lg+) ── */}
      <aside
        className="hidden lg:flex w-56 shrink-0 flex-col border-r border-border/30 h-screen sticky top-0"
        style={{ background: "oklch(0.08 0.01 240)" }}
      >
        <SidebarContent />
      </aside>

      {/* ── Overlay Mobile ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Drawer Mobile (< lg) ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 flex flex-col border-r border-border/30 transition-transform duration-300 ease-in-out lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ background: "oklch(0.08 0.01 240)" }}
        aria-label="Menu de navegação"
      >
        {/* Botão fechar dentro do drawer */}
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-3 right-3 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/10 transition-colors"
          aria-label="Fechar menu"
        >
          <X className="w-4 h-4" />
        </button>
        <SidebarContent onNavigate={() => setMobileOpen(false)} />
      </aside>

      {/* ── Conteúdo principal ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header mobile com botão de menu */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-border/20 sticky top-0 z-30"
          style={{ background: "oklch(0.08 0.01 240)" }}>
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/10 transition-colors"
            aria-label="Abrir menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-foreground">Iannini Day Trade</span>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/"       component={Login} />
      <Route path="/login"  component={Login} />
      <Route path="/workspace">
        <AuthGuard><AppLayout><Workspace /></AppLayout></AuthGuard>
      </Route>
      <Route path="/ai-trading">
        <AuthGuard><AppLayout><AiTrading /></AppLayout></AuthGuard>
      </Route>
      <Route path="/predictions">
        <AuthGuard><AppLayout><Predictions /></AppLayout></AuthGuard>
      </Route>
      <Route path="/market">
        <AuthGuard><AppLayout><MarketOverview /></AppLayout></AuthGuard>
      </Route>
      <Route path="/dashboard">
        <AuthGuard><AppLayout><Dashboard /></AppLayout></AuthGuard>
      </Route>
      <Route path="/risk-calculator">
        <AuthGuard><AppLayout><RiskCalculator /></AppLayout></AuthGuard>
      </Route>
      <Route path="/oco-config">
        <AuthGuard><AppLayout><OcoConfig /></AppLayout></AuthGuard>
      </Route>
      <Route path="/economic-calendar">
        <AuthGuard><AppLayout><EconomicCalendar /></AppLayout></AuthGuard>
      </Route>
      <Route path="/inter">
        <AuthGuard><AppLayout><InterIntegration /></AppLayout></AuthGuard>
      </Route>
      <Route path="/settings">
        <AuthGuard><AppLayout><UserSettings /></AppLayout></AuthGuard>
      </Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster theme="dark" position="top-right" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
