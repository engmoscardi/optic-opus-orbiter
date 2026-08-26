import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/obras/nova")({
  head: () => ({
    meta: [
      { title: "Cadastrar obra | FiberFlow" },
      {
        name: "description",
        content:
          "Cadastre uma nova obra de implantação de fibra óptica com código, local, extensão e prazo. As 9 etapas são criadas automaticamente.",
      },
      { property: "og:title", content: "Cadastrar obra | FiberFlow" },
      {
        property: "og:description",
        content: "Registre uma nova obra de fibra óptica e inicie o acompanhamento das etapas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NovaObra,
});

function NovaObra() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    codigo: "",
    nome: "",
    cidade: "",
    uf: "",
    extensao_km: "",
    responsavel: "",
    prazo: "",
    observacoes: "",
  });
  const [salvando, setSalvando] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    const { data: userData } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("obras")
      .insert({
        codigo: form.codigo,
        nome: form.nome,
        cidade: form.cidade || null,
        uf: form.uf || null,
        extensao_km: form.extensao_km ? Number(form.extensao_km) : null,
        responsavel: form.responsavel || null,
        prazo: form.prazo || null,
        observacoes: form.observacoes || null,
        created_by: userData.user?.id ?? null,
      })
      .select("id")
      .single();
    setSalvando(false);
    if (error) {
      toast.error("Não foi possível cadastrar: " + error.message);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["obras"] });
    toast.success("Obra cadastrada com as 9 etapas.");
    navigate({ to: "/obras/$obraId", params: { obraId: data.id } });
  };

  if (!loading && !isAdmin) {
    return (
      <AppShell>
        <div className="card-vivo p-6 text-center">
          <p className="text-sm font-semibold">Acesso restrito</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Apenas administradores podem cadastrar obras. Você pode atualizar as etapas das obras existentes.
          </p>
        </div>
      </AppShell>
    );
  }

  const campo = "w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm focus:border-primary focus:outline-none";

  return (
    <AppShell>
      <form onSubmit={salvar} className="space-y-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Cadastrar obra</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            As 9 etapas do workflow são criadas automaticamente.
          </p>
        </div>

        <div className="space-y-4 card-vivo p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="label-tec">Código</label>
              <input required value={form.codigo} onChange={set("codigo")} placeholder="2024-0892" className={campo} />
            </div>
            <div className="space-y-1.5">
              <label className="label-tec">Responsável</label>
              <input value={form.responsavel} onChange={set("responsavel")} className={campo} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="label-tec">Nome da obra</label>
            <input
              required
              value={form.nome}
              onChange={set("nome")}
              placeholder="FTTH Setor Norte - Trecho A"
              className={campo}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="label-tec">Cidade</label>
              <input value={form.cidade} onChange={set("cidade")} className={campo} />
            </div>
            <div className="space-y-1.5">
              <label className="label-tec">UF</label>
              <input maxLength={2} value={form.uf} onChange={set("uf")} className={campo} />
            </div>
            <div className="space-y-1.5">
              <label className="label-tec">Extensão (km)</label>
              <input type="number" step="0.01" value={form.extensao_km} onChange={set("extensao_km")} className={campo} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="label-tec">Prazo</label>
            <input type="date" value={form.prazo} onChange={set("prazo")} className={campo} />
          </div>

          <div className="space-y-1.5">
            <label className="label-tec">Observações</label>
            <textarea rows={3} value={form.observacoes} onChange={set("observacoes")} className={campo} />
          </div>
        </div>

        <button
          type="submit"
          disabled={salvando}
          className="w-full rounded-full bg-primary transition-colors hover:bg-primary-dark py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {salvando ? "Salvando..." : "Cadastrar obra"}
        </button>
      </form>
    </AppShell>
  );
}
