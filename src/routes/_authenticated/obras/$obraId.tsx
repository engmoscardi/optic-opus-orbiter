import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Check, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import {
  STATUS_CLASS,
  STATUS_LABEL,
  STATUS_ORDER,
  progresso,
  type Etapa,
  type EtapaStatus,
  type Obra,
} from "@/lib/obras";

export const Route = createFileRoute("/_authenticated/obras/$obraId")({
  head: () => ({
    meta: [
      { title: "Detalhe da obra | FiberFlow" },
      {
        name: "description",
        content:
          "Atualize as etapas da obra de fibra óptica: situação, responsável, data de conclusão e observações de cada fase.",
      },
      { property: "og:title", content: "Detalhe da obra | FiberFlow" },
      {
        property: "og:description",
        content: "Workflow completo de uma obra de implantação de fibra óptica.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DetalheObra,
});

function DetalheObra() {
  const { obraId } = Route.useParams();
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [aberta, setAberta] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["obra", obraId],
    queryFn: async () => {
      const [{ data: obra, error: e1 }, { data: etapas, error: e2 }] = await Promise.all([
        supabase.from("obras").select("*").eq("id", obraId).single(),
        supabase.from("obra_etapas").select("*").eq("obra_id", obraId).order("ordem"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      return { obra: obra as unknown as Obra, etapas: (etapas ?? []) as unknown as Etapa[] };
    },
  });

  const [editando, setEditando] = useState(false);

  const salvarObra = useMutation({
    mutationFn: async (patch: TablesUpdate<"obras">) => {
      const { error } = await supabase.from("obras").update(patch).eq("id", obraId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["obra", obraId] });
      await qc.invalidateQueries({ queryKey: ["obras"] });
      setEditando(false);
      toast.success("Obra atualizada.");
    },
    onError: (e: Error) => toast.error("Erro ao salvar: " + e.message),
  });

  const atualizar = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Etapa> }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("obra_etapas")
        .update({ ...patch, updated_by: userData.user?.id ?? null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["obra", obraId] });
      await qc.invalidateQueries({ queryKey: ["obras"] });
      toast.success("Etapa atualizada.");
    },
    onError: (e: Error) => toast.error("Erro ao atualizar: " + e.message),
  });

  const excluir = async () => {
    if (!window.confirm("Excluir esta obra e todas as etapas?")) return;
    const { error } = await supabase.from("obras").delete().eq("id", obraId);
    if (error) {
      toast.error("Erro ao excluir: " + error.message);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["obras"] });
    toast.success("Obra excluída.");
    window.history.back();
  };

  if (isLoading || !data) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Carregando obra...</p>
      </AppShell>
    );
  }

  const { obra, etapas } = data;
  const pct = progresso(etapas);
  const concluidas = etapas.filter((e) => e.status === "concluida").length;

  return (
    <AppShell>
      <div className="space-y-6">
        <Link to="/obras" className="text-xs font-semibold text-primary">
          ← Voltar ao painel
        </Link>

        <section className="card-vivo p-4 shadow-sm">
          {editando ? (
            <EditarObraForm
              obra={obra}
              salvando={salvarObra.isPending}
              onCancel={() => setEditando(false)}
              onSave={(patch) => salvarObra.mutate(patch)}
            />
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-lg font-bold leading-tight">{obra.nome}</h1>
                  <p className="text-sm text-muted-foreground">
                    Cód: {obra.codigo}
                    {obra.cidade ? ` • ${obra.cidade}${obra.uf ? "/" + obra.uf : ""}` : ""}
                  </p>
                </div>
                <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase text-primary">
                  {concluidas}/{etapas.length} etapas
                </span>
              </div>

              <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div className="h-full bg-success" style={{ width: `${pct}%` }} />
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-secondary p-2 text-center">
                  <p className="label-tec">Progresso</p>
                  <p className="font-bold">{pct}%</p>
                </div>
                <div className="rounded-lg bg-secondary p-2 text-center">
                  <p className="label-tec">Extensão</p>
                  <p className="font-bold">{obra.extensao_km ?? "—"} km</p>
                </div>
                <div className="rounded-lg bg-secondary p-2 text-center">
                  <p className="label-tec">Prazo</p>
                  <p className="font-bold">
                    {obra.prazo ? new Date(obra.prazo + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                  </p>
                </div>
              </div>

              <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
                {(
                  [
                    ["Responsável", obra.responsavel],
                    ["Regional", obra.regional],
                    ["Contratada", obra.contratada],
                    ["ETP", obra.etp],
                    ["OP", obra.op],
                    ["Plano Ano", obra.plano_ano != null ? String(obra.plano_ano) : null],
                    ["Prioridade", obra.prioridade],
                    ["Tipo da Obra", obra.tipo_obra],
                  ] as [string, string | null][]
                ).map(
                  ([rotulo, valor]) =>
                    valor && (
                      <div key={rotulo} className="flex gap-1">
                        <dt className="font-semibold text-foreground">{rotulo}:</dt>
                        <dd>{valor}</dd>
                      </div>
                    ),
                )}
                {obra.responsavel && null}
                {obra.observacoes && (
                  <div className="flex gap-1">
                    <dt className="font-semibold text-foreground">Observações:</dt>
                    <dd>{obra.observacoes}</dd>
                  </div>
                )}
                <div className="flex gap-1">
                  <dt className="font-semibold text-foreground">Cadastrada em:</dt>
                  <dd>{new Date(obra.created_at).toLocaleDateString("pt-BR")}</dd>
                </div>
              </dl>

              {isAdmin && (
                <button
                  onClick={() => setEditando(true)}
                  className="mt-4 w-full rounded-full border border-border py-2 text-sm font-semibold transition-colors hover:border-primary hover:text-primary"
                >
                  Editar dados da obra
                </button>
              )}
            </>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="label-tec">Etapas do Workflow</h2>
          <div className="space-y-2">
            {etapas.map((etapa) => (
              <EtapaItem
                key={etapa.id}
                etapa={etapa}
                aberta={aberta === etapa.id}
                onToggle={() => setAberta(aberta === etapa.id ? null : etapa.id)}
                onSave={(patch) => atualizar.mutate({ id: etapa.id, patch })}
                salvando={atualizar.isPending}
              />
            ))}
          </div>
        </section>

        {isAdmin && (
          <button
            onClick={excluir}
            className="w-full rounded-xl border border-destructive/30 py-2.5 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/5"
          >
            Excluir obra
          </button>
        )}
      </div>
    </AppShell>
  );
}

function EtapaItem({
  etapa,
  aberta,
  onToggle,
  onSave,
  salvando,
}: {
  etapa: Etapa;
  aberta: boolean;
  onToggle: () => void;
  onSave: (patch: Partial<Etapa>) => void;
  salvando: boolean;
}) {
  const [status, setStatus] = useState<EtapaStatus>(etapa.status);
  const [responsavel, setResponsavel] = useState(etapa.responsavel ?? "");
  const [observacao, setObservacao] = useState(etapa.observacao ?? "");
  const [dataConclusao, setDataConclusao] = useState(etapa.data_conclusao ?? "");

  const campo =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none";

  return (
    <div className="overflow-hidden card-vivo">
      <button onClick={onToggle} className="flex w-full items-center gap-3 p-4 text-left">
        <div
          className={
            etapa.status === "concluida"
              ? "grid size-6 shrink-0 place-items-center rounded-full bg-success text-success-foreground"
              : etapa.status === "em_andamento"
                ? "grid size-6 shrink-0 place-items-center rounded-full border-2 border-primary bg-card"
                : etapa.status === "bloqueada"
                  ? "grid size-6 shrink-0 place-items-center rounded-full border-2 border-destructive bg-card"
                  : "grid size-6 shrink-0 place-items-center rounded-full border-2 border-border bg-card"
          }
        >
          {etapa.status === "concluida" && <Check className="size-3.5" />}
          {etapa.status === "em_andamento" && <div className="size-2 animate-pulse rounded-full bg-primary" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {etapa.ordem}. {etapa.nome}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {etapa.observacao || (etapa.responsavel ? `Responsável: ${etapa.responsavel}` : "Sem atualizações")}
          </p>
        </div>
        <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${STATUS_CLASS[etapa.status]}`}>
          {STATUS_LABEL[etapa.status]}
        </span>
        <ChevronDown className={aberta ? "size-4 rotate-180 text-muted-foreground" : "size-4 text-muted-foreground"} />
      </button>

      {aberta && (
        <div className="space-y-3 border-t border-border bg-secondary/40 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="label-tec">Situação</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as EtapaStatus)} className={campo}>
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="label-tec">Responsável</label>
              <input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className={campo} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="label-tec">Data de conclusão</label>
            <input
              type="date"
              value={dataConclusao}
              onChange={(e) => setDataConclusao(e.target.value)}
              className={campo}
            />
          </div>
          <div className="space-y-1.5">
            <label className="label-tec">Observação</label>
            <textarea rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} className={campo} />
          </div>
          <button
            disabled={salvando}
            onClick={() =>
              onSave({
                status,
                responsavel: responsavel || null,
                observacao: observacao || null,
                data_conclusao: dataConclusao || null,
              })
            }
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            Atualizar etapa
          </button>
        </div>
      )}
    </div>
  );
}

function EditarObraForm({
  obra,
  salvando,
  onCancel,
  onSave,
}: {
  obra: Obra;
  salvando: boolean;
  onCancel: () => void;
  onSave: (patch: TablesUpdate<"obras">) => void;
}) {
  const [nome, setNome] = useState(obra.nome);
  const [codigo, setCodigo] = useState(obra.codigo);
  const [cidade, setCidade] = useState(obra.cidade ?? "");
  const [uf, setUf] = useState(obra.uf ?? "");
  const [extensao, setExtensao] = useState(obra.extensao_km != null ? String(obra.extensao_km) : "");
  const [responsavel, setResponsavel] = useState(obra.responsavel ?? "");
  const [prazo, setPrazo] = useState(obra.prazo ?? "");
  const [observacoes, setObservacoes] = useState(obra.observacoes ?? "");

  const campo =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none";

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-bold">Editar obra</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="label-tec">Nome da obra</label>
          <input value={nome} onChange={(e) => setNome(e.target.value)} className={campo} />
        </div>
        <div className="space-y-1.5">
          <label className="label-tec">Código</label>
          <input value={codigo} onChange={(e) => setCodigo(e.target.value)} className={campo} />
        </div>
        <div className="space-y-1.5">
          <label className="label-tec">Cidade</label>
          <input value={cidade} onChange={(e) => setCidade(e.target.value)} className={campo} />
        </div>
        <div className="space-y-1.5">
          <label className="label-tec">UF</label>
          <input value={uf} onChange={(e) => setUf(e.target.value)} maxLength={2} className={campo} />
        </div>
        <div className="space-y-1.5">
          <label className="label-tec">Extensão (km)</label>
          <input
            type="number"
            step="0.01"
            value={extensao}
            onChange={(e) => setExtensao(e.target.value)}
            className={campo}
          />
        </div>
        <div className="space-y-1.5">
          <label className="label-tec">Prazo</label>
          <input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} className={campo} />
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="label-tec">Responsável</label>
        <input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className={campo} />
      </div>
      <div className="space-y-1.5">
        <label className="label-tec">Observações</label>
        <textarea rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} className={campo} />
      </div>
      <div className="flex gap-2">
        <button
          disabled={salvando || !nome.trim() || !codigo.trim()}
          onClick={() =>
            onSave({
              nome: nome.trim(),
              codigo: codigo.trim(),
              cidade: cidade.trim() || null,
              uf: uf.trim().toUpperCase() || null,
              extensao_km: extensao ? Number(extensao) : null,
              responsavel: responsavel.trim() || null,
              prazo: prazo || null,
              observacoes: observacoes.trim() || null,
            })
          }
          className="flex-1 rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-dark disabled:opacity-60"
        >
          Salvar alterações
        </button>
        <button
          onClick={onCancel}
          className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-secondary"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
