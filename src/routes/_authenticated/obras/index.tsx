import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import {
  ETAPAS,
  STATUS_CLASS,
  STATUS_LABEL,
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
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobreColuna, setSobreColuna] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);

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

  const colunaDaObra = (obra: ObraComEtapas): number => {
    const etapas = [...(obra.obra_etapas ?? [])].sort((a, b) => a.ordem - b.ordem);
    if (etapas.length > 0 && etapas.every((e) => e.status === "concluida")) return ETAPAS.length - 1;
    const atual = etapaAtual(etapas);
    const idx = ETAPAS.findIndex((nome) => nome === atual?.nome);
    return idx >= 0 ? idx : 0;
  };

  const moverObra = async (obraId: string, alvoIdx: number) => {
    const obra = (data ?? []).find((o) => o.id === obraId);
    if (!obra) return;
    const atualIdx = colunaDaObra(obra);
    if (atualIdx === alvoIdx) return;
    setSalvando(true);
    const etapas = [...(obra.obra_etapas ?? [])].sort((a, b) => a.ordem - b.ordem);
    const { data: userData } = await supabase.auth.getUser();
    const results = await Promise.all(
      etapas.map((e, i) => {
        const status: EtapaStatus = i < alvoIdx ? "concluida" : i === alvoIdx ? "em_andamento" : "pendente";
        if (e.status === status) return Promise.resolve({ error: null });
        return supabase
          .from("obra_etapas")
          .update({
            status,
            data_conclusao: status === "concluida" ? new Date().toISOString().slice(0, 10) : null,
            updated_by: userData.user?.id ?? null,
          })
          .eq("id", e.id);
      }),
    );
    setSalvando(false);
    const erro = results.find((r) => r.error)?.error;
    if (erro) {
      toast.error("Erro ao mover obra: " + erro.message);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["obras"] });
    toast.success(`Obra movida para "${ETAPAS[alvoIdx]}".`);
  };

  const obras = (data ?? []).filter((o) =>
    `${o.codigo} ${o.nome} ${o.cidade ?? ""}`.toLowerCase().includes(busca.toLowerCase()),
  );

  const exportar = () => {
    const cabecalho = [
      "codigo", "nome", "cidade", "uf", "extensao_km", "responsavel", "prazo",
      "observacoes", "regional", "contratada", "etp", "op", "plano_ano",
      "prioridade", "tipo_obra", "progresso_pct", "etapa_atual", "criado_em",
      ...ETAPAS.map((nome) => `etapa_${nome.toLowerCase().replace(/\s+/g, "_")}`),
    ];
    const linhas = obras.map((o) => {
      const etapas = [...(o.obra_etapas ?? [])].sort((a, b) => a.ordem - b.ordem);
      return [
        o.codigo, o.nome, o.cidade ?? "", o.uf ?? "",
        o.extensao_km != null ? String(o.extensao_km) : "",
        o.responsavel ?? "", o.prazo ?? "", o.observacoes ?? "",
        o.regional ?? "", o.contratada ?? "", o.etp ?? "", o.op ?? "",
        o.plano_ano != null ? String(o.plano_ano) : "",
        o.prioridade ?? "", o.tipo_obra ?? "",
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

  const colunas = ETAPAS.map((nome, idx) => ({
    nome,
    idx,
    itens: obras.filter((o) => colunaDaObra(o) === idx),
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
                <section
                  key={coluna.nome}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setSobreColuna(coluna.idx);
                  }}
                  onDragLeave={() => setSobreColuna((c) => (c === coluna.idx ? null : c))}
                  onDrop={(e) => {
                    e.preventDefault();
                    const obraId = e.dataTransfer.getData("text/plain");
                    setSobreColuna(null);
                    setArrastando(null);
                    if (obraId) void moverObra(obraId, coluna.idx);
                  }}
                  className={`w-72 shrink-0 space-y-3 rounded-2xl p-2 transition-colors ${
                    sobreColuna === coluna.idx && arrastando ? "bg-primary/10 ring-2 ring-primary/40" : ""
                  }`}
                >
                  <div className="flex items-center justify-between px-1">
                    <h2 className="label-tec">
                      {coluna.idx + 1}. {coluna.nome}
                    </h2>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                      {coluna.itens.length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {coluna.itens.map((obra) => {
                      const etapas = obra.obra_etapas ?? [];
                      const pct = progresso(etapas);
                      const atual = etapaAtual([...etapas].sort((a, b) => a.ordem - b.ordem));
                      return (
                        <div
                          key={obra.id}
                          draggable={!salvando}
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", obra.id);
                            e.dataTransfer.effectAllowed = "move";
                            setArrastando(obra.id);
                          }}
                          onDragEnd={() => {
                            setArrastando(null);
                            setSobreColuna(null);
                          }}
                          className={`card-vivo p-4 shadow-sm transition-all hover:shadow-md ${
                            arrastando === obra.id ? "opacity-50" : "cursor-grab active:cursor-grabbing"
                          }`}
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
                              className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${
                                atual ? STATUS_CLASS[atual.status] : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {pct}%
                            </span>
                          </div>

                          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-secondary">
                            <div className="h-full bg-success" style={{ width: `${pct}%` }} />
                          </div>

                          <div className="mt-3 flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">
                              {atual ? STATUS_LABEL[atual.status] : "—"}
                            </p>
                            <Link
                              to="/obras/$obraId"
                              params={{ obraId: obra.id }}
                              className="text-xs font-semibold text-primary hover:underline"
                            >
                              Detalhes →
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                    {coluna.itens.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-border p-4 text-center text-[11px] text-muted-foreground">
                        Arraste uma obra para cá
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
