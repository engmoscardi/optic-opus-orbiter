import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import {
  ETAPAS,
  STATUS_CLASS,
  STATUS_LABEL,
  STATUS_ORDER,
  etapaAtual,
  progresso,
  type Etapa,
  type EtapaStatus,
  type Obra,
} from "@/lib/obras";
import { baixarCsv } from "@/lib/csv";

export const Route = createFileRoute("/_authenticated/obras/")({
  head: () => ({
    meta: [
      { title: "Painel de obras | FiberFlow" },
      {
        name: "description",
        content:
          "Acompanhe todas as obras de fibra óptica organizadas por etapa: planejamento, licenças, materiais, execução e aceitação.",
      },
      { property: "og:title", content: "Painel de obras | FiberFlow" },
      {
        property: "og:description",
        content: "Kanban das obras de implantação de fibra óptica por etapa atual.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ObrasPage,
});

type ObraComEtapas = Obra & { obra_etapas: Etapa[] };

function ObrasPage() {
  const { isAdmin } = useAuth();
  const [busca, setBusca] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["obras"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obras")
        .select("*, obra_etapas(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ObraComEtapas[];
    },
  });

  const obras = (data ?? []).filter((o) =>
    `${o.codigo} ${o.nome} ${o.cidade ?? ""}`.toLowerCase().includes(busca.toLowerCase()),
  );

  const exportar = () => {
    const cabecalho = [
      "codigo", "nome", "cidade", "uf", "extensao_km", "responsavel", "prazo",
      "observacoes", "progresso_pct", "etapa_atual", "criado_em",
      ...ETAPAS.map((nome) => `etapa_${nome.toLowerCase().replace(/\s+/g, "_")}`),
    ];
    const linhas = obras.map((o) => {
      const etapas = [...(o.obra_etapas ?? [])].sort((a, b) => a.ordem - b.ordem);
      return [
        o.codigo, o.nome, o.cidade ?? "", o.uf ?? "",
        o.extensao_km != null ? String(o.extensao_km) : "",
        o.responsavel ?? "", o.prazo ?? "", o.observacoes ?? "",
        String(progresso(etapas)), etapaAtual(etapas)?.nome ?? "",
        o.created_at ? new Date(o.created_at).toLocaleDateString("pt-BR") : "",
        ...ETAPAS.map((nome) => {
          const e = etapas.find((x) => x.nome === nome);
          return e ? STATUS_LABEL[e.status] : "";
        }),
      ];
    });
    baixarCsv(`obras_fiberflow_${new Date().toISOString().slice(0, 10)}.csv`, cabecalho, linhas);
  };

  const colunas: { status: EtapaStatus; itens: ObraComEtapas[] }[] = STATUS_ORDER.map((status) => ({
    status,
    itens: obras.filter((o) => {
      const etapas = o.obra_etapas ?? [];
      const done = etapas.length > 0 && etapas.every((e) => e.status === "concluida");
      if (done) return status === "concluida";
      return etapaAtual(etapas)?.status === status && status !== "concluida";
    }),
  }));

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex gap-2">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar obra..."
            className="flex-1 rounded-xl border border-border bg-card px-4 py-2.5 text-sm transition-all focus:border-primary focus:outline-none"
          />
          <button
            onClick={exportar}
            disabled={!obras.length}
            className="flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-semibold transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
          >
            ↓ Baixar CSV
          </button>
          {isAdmin && (
            <Link
              to="/obras/nova"
              className="flex items-center gap-1.5 rounded-full bg-primary transition-colors hover:bg-primary-dark px-4 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              <span className="text-base leading-none">+</span> Nova Obra
            </Link>
          )}
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Carregando obras...</p>}

        {!isLoading && obras.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
            <p className="text-sm font-medium">Nenhuma obra cadastrada.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {isAdmin
                ? "Cadastre a primeira obra para começar o acompanhamento."
                : "Peça a um administrador para cadastrar a primeira obra."}
            </p>
          </div>
        )}

        {obras.length > 0 && (
          <div className="-mx-4 overflow-x-auto px-4 pb-2">
            <div className="flex min-w-max gap-3">
              {colunas.map((coluna) => (
                <section key={coluna.status} className="w-72 shrink-0 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="label-tec">{STATUS_LABEL[coluna.status]}</h2>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                      {coluna.itens.length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {coluna.itens.map((obra) => {
                      const etapas = obra.obra_etapas ?? [];
                      const pct = progresso(etapas);
                      const atual = etapaAtual(etapas);
                      return (
                        <Link
                          key={obra.id}
                          to="/obras/$obraId"
                          params={{ obraId: obra.id }}
                          className="block card-vivo p-4 shadow-sm transition-shadow hover:shadow-md"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="text-sm font-bold leading-tight">{obra.nome}</h3>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {obra.codigo}
                                {obra.cidade ? ` • ${obra.cidade}${obra.uf ? "/" + obra.uf : ""}` : ""}
                              </p>
                            </div>
                            <span
                              className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${STATUS_CLASS[coluna.status]}`}
                            >
                              {pct}%
                            </span>
                          </div>

                          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-secondary">
                            <div className="h-full bg-success" style={{ width: `${pct}%` }} />
                          </div>

                          <p className="mt-3 text-xs text-muted-foreground">
                            Etapa: <span className="font-medium text-foreground">{atual?.nome ?? "—"}</span>
                          </p>
                        </Link>
                      );
                    })}
                    {coluna.itens.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-border p-4 text-center text-[11px] text-muted-foreground">
                        Sem obras
                      </div>
                    )}
                  </div>
                </section>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
