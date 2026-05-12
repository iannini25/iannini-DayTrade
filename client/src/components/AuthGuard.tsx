import { useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { isAuthorizedEmail } from "@shared/const";

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const { data: user, isLoading } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    staleTime: 30_000,
  });
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      setLocation("/login");
      return;
    }
    if (!isAuthorizedEmail(user.email)) {
      setLocation("/login?error=unauthorized");
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm font-medium tracking-wide">Verificando acesso...</p>
        </div>
      </div>
    );
  }

  if (!user || !isAuthorizedEmail(user.email)) {
    return null;
  }

  return <>{children}</>;
}
