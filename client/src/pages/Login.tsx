import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { isAuthorizedEmail } from "@shared/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendingUp, Shield, Lock, AlertTriangle, Eye, EyeOff, Monitor, Smartphone } from "lucide-react";
import { toast } from "sonner";
import {
  getPreferredLayout,
  setPreferredLayout,
  getRouteForLayout,
  suggestLayout,
  type Layout,
} from "@/lib/layoutPreference";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [layout, setLayout] = useState<Layout | null>(getPreferredLayout());
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const { data: user, isLoading: checkingAuth } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    staleTime: 30_000,
  });

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async () => {
      // Refetch auth.me ANTES de navegar para evitar AuthGuard ver cache stale (null)
      // e chutar o usuário de volta para /login.
      await utils.auth.me.invalidate();
      await utils.auth.me.refetch();
      const chosenLayout = layout ?? getPreferredLayout() ?? suggestLayout();
      setPreferredLayout(chosenLayout);
      setLocation(getRouteForLayout(chosenLayout));
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message || "Credenciais inválidas. Verifique seu e-mail e senha.");
    },
  });

  useEffect(() => {
    if (!checkingAuth && user && isAuthorizedEmail(user.email)) {
      const target = getPreferredLayout() ?? suggestLayout();
      setLocation(getRouteForLayout(target));
    }
  }, [user, checkingAuth, setLocation]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!layout) {
      toast.error("Escolha o modo de uso (Desktop ou Smartphone) antes de entrar.");
      return;
    }
    if (!email.trim() || !password.trim()) {
      toast.error("Preencha o e-mail e a senha.");
      return;
    }
    if (!isAuthorizedEmail(email.trim().toLowerCase())) {
      toast.error("E-mail não autorizado. Esta plataforma é de uso exclusivo da equipe Iannini.");
      return;
    }
    loginMutation.mutate({ email: email.trim().toLowerCase(), password });
  };

  const handlePickLayout = (l: Layout) => {
    setLayout(l);
    setPreferredLayout(l); // persiste imediatamente
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden">
      {/* Background grid */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
          backgroundSize: "40px 40px"
        }}
      />
      {/* Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full opacity-10"
        style={{ background: "radial-gradient(ellipse, oklch(0.65 0.18 195) 0%, transparent 70%)" }}
      />

      <div className="relative z-10 w-full max-w-md px-6 py-8">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl mb-5"
            style={{ background: "linear-gradient(135deg, oklch(0.65 0.18 195), oklch(0.55 0.22 250))" }}>
            <TrendingUp className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Iannini Day Trade</h1>
          <p className="text-sm text-muted-foreground mt-1 tracking-wide">Workspace Profissional</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border p-7"
          style={{ background: "oklch(0.11 0.01 240)" }}>

          <div className="flex flex-col items-center gap-2 text-center mb-5">
            <div className="flex items-center justify-center w-10 h-10 rounded-full"
              style={{ background: "oklch(0.65 0.18 195 / 0.15)" }}>
              <Lock className="w-5 h-5" style={{ color: "oklch(0.65 0.18 195)" }} />
            </div>
            <h2 className="text-base font-semibold text-foreground">Acesso Restrito</h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              Plataforma exclusiva para operadores autorizados.
            </p>
          </div>

          {/* Seletor de modo de uso */}
          <div className="mb-5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
              Modo de Uso
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handlePickLayout("desktop")}
                disabled={loginMutation.isPending}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-xs transition-all ${
                  layout === "desktop"
                    ? "border-primary/60 bg-primary/10 text-primary"
                    : "border-border/40 bg-background/30 text-muted-foreground hover:border-border hover:text-foreground"
                }`}
                aria-pressed={layout === "desktop"}
              >
                <Monitor className="w-5 h-5" />
                <span className="font-medium">Desktop</span>
                <span className="text-[10px] opacity-70">Workspace completo</span>
              </button>
              <button
                type="button"
                onClick={() => handlePickLayout("mobile")}
                disabled={loginMutation.isPending}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-xs transition-all ${
                  layout === "mobile"
                    ? "border-primary/60 bg-primary/10 text-primary"
                    : "border-border/40 bg-background/30 text-muted-foreground hover:border-border hover:text-foreground"
                }`}
                aria-pressed={layout === "mobile"}
              >
                <Smartphone className="w-5 h-5" />
                <span className="font-medium">Smartphone</span>
                <span className="text-[10px] opacity-70">4 abas, tela cheia</span>
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email" className="text-xs text-muted-foreground uppercase tracking-wider">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="h-11 bg-background/50 border-border/60 focus:border-primary"
                disabled={loginMutation.isPending}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password" className="text-xs text-muted-foreground uppercase tracking-wider">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="h-11 bg-background/50 border-border/60 focus:border-primary pr-10"
                  disabled={loginMutation.isPending}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 font-medium tracking-wide mt-2"
              style={{ background: "linear-gradient(135deg, oklch(0.65 0.18 195), oklch(0.55 0.22 250))" }}
              disabled={loginMutation.isPending || checkingAuth || !layout}
              title={!layout ? "Escolha o modo de uso antes" : ""}
            >
              {loginMutation.isPending ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : !layout ? (
                "Escolha o modo acima"
              ) : (
                `Entrar (${layout === "desktop" ? "Desktop" : "Smartphone"})`
              )}
            </Button>
          </form>

          <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center mt-5">
            <Shield className="w-3.5 h-3.5" />
            <span>Autenticação segura · Acesso restrito</span>
          </div>
        </div>

        {/* Info box */}
        <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="text-amber-500 font-medium">Primeiro acesso?</span> Solicite ao administrador a criação de sua senha via painel de administração.
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6 opacity-50">
          © 2026 Iannini Day Trade · Uso exclusivo
        </p>
      </div>
    </div>
  );
}
