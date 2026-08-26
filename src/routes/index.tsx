import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ETAPAS } from "@/lib/obras";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FiberFlow — Workflow de obras de fibra óptica" },
      {
        name: "description",
        content:
          "Cadastre obras de implantação de fibra óptica e acompanhe as 9 etapas: planejamento, projetos, licenças, materiais, execução, baixa e aceitação.",
      },
      { property: "og:title", content: "FiberFlow — Workflow de obras de fibra óptica" },
      {
        property: "og:description",
        content: "Controle completo das etapas das suas obras de fibra óptica, do planejamento à aceitação.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/obras", replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="grid size-8 place-items-center rounded-lg bg-primary font-bold text-primary-foreground">
            F
          </div>
          <span className="text-lg font-bold tracking-tight">FiberFlow</span>
        </div>
        <Link
          to="/auth"
          className="rounded-full bg-primary transition-colors hover:bg-primary-dark px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Entrar
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-bold leading-tight tracking-tight">
          Workflow de obras de fibra óptica
        </h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          Cadastre cada obra de implantação e atualize o andamento das nove etapas previstas — do planejamento
          à aceitação — com responsáveis, datas e observações.
        </p>

        <div className="mt-8 space-y-2">
          {ETAPAS.map((etapa, i) => (
            <div
              key={etapa}
              className="flex items-center gap-3 card-vivo px-4 py-3"
            >
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-[11px] font-bold text-muted-foreground">
                {i + 1}
              </span>
              <span className="text-sm font-medium">{etapa}</span>
            </div>
          ))}
        </div>

        <div className="mt-8 card-vivo p-4">
          <h2 className="label-tec">Perfis de acesso</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Administrador</span> cadastra, edita e exclui obras.{" "}
            <span className="font-semibold text-foreground">Atualizador</span> registra o andamento das etapas.
          </p>
        </div>
      </main>
    </div>
  );
}
