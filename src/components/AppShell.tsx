import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LayoutGrid, Plus, Users, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { iniciais, useAuth } from "@/hooks/useAuth";

export function AppShell({ children }: { children: ReactNode }) {
  const { nome, isAdmin } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  const sair = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const nav = [
    { to: "/obras", label: "Obras", icon: LayoutGrid },
    ...(isAdmin
      ? [
          { to: "/obras/nova", label: "Nova obra", icon: Plus },
          { to: "/usuarios", label: "Usuários", icon: Users },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <Link to="/obras" className="flex items-center gap-2">
          <div className="grid size-8 place-items-center rounded-lg bg-primary font-bold text-primary-foreground">
            F
          </div>
          <span className="text-lg font-bold tracking-tight">FiberFlow</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {nome} · {isAdmin ? "Administrador" : "Atualizador"}
          </span>
          <div className="grid size-9 place-items-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground">
            {iniciais(nome) || "??"}
          </div>
          <button
            onClick={sair}
            aria-label="Sair"
            className="grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-4 pb-28">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-around border-t border-border bg-card px-6 py-3">
        {nav.map((item) => {
          const active = path === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className="flex flex-col items-center gap-1"
              data-active={active}
            >
              <item.icon className={active ? "size-5 text-primary" : "size-5 text-muted-foreground"} />
              <span
                className={
                  active
                    ? "text-[10px] font-bold text-primary"
                    : "text-[10px] font-bold text-muted-foreground"
                }
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
