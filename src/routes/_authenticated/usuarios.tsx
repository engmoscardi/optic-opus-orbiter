import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuários e permissões | FiberFlow" },
      {
        name: "description",
        content:
          "Defina quem pode cadastrar obras de fibra óptica (administrador) e quem pode apenas atualizar as etapas.",
      },
      { property: "og:title", content: "Usuários e permissões | FiberFlow" },
      {
        property: "og:description",
        content: "Gestão de acessos do sistema de obras de fibra óptica.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Usuarios,
});

type Perfil = { id: string; nome: string; email: string | null };

function Usuarios() {
  const { isAdmin, loading, user } = useAuth();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["usuarios"],
    queryFn: async () => {
      const [{ data: perfis, error: e1 }, { data: papeis, error: e2 }] = await Promise.all([
        supabase.from("profiles").select("id, nome, email").order("nome"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      return {
        perfis: (perfis ?? []) as Perfil[],
        papeis: (papeis ?? []) as { user_id: string; role: "admin" | "atualizador" }[],
      };
    },
    enabled: isAdmin,
  });

  const alterar = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: "admin" | "atualizador" }) => {
      const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
      if (delErr) throw delErr;
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["usuarios"] });
      toast.success("Permissão atualizada.");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  if (!loading && !isAdmin) {
    return (
      <AppShell>
        <div className="card-vivo p-6 text-center">
          <p className="text-sm font-semibold">Acesso restrito</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Apenas administradores gerenciam permissões.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Usuários e permissões</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Administradores cadastram e excluem obras. Atualizadores registram o andamento das etapas.
          </p>
        </div>

        <div className="divide-y divide-border overflow-hidden card-vivo">
          {(data?.perfis ?? []).map((p) => {
            const role = data?.papeis.find((r) => r.user_id === p.id)?.role ?? "atualizador";
            return (
              <div key={p.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {p.nome} {p.id === user?.id && <span className="text-xs text-muted-foreground">(você)</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{p.email}</p>
                </div>
                <select
                  value={role}
                  onChange={(e) =>
                    alterar.mutate({ userId: p.id, role: e.target.value as "admin" | "atualizador" })
                  }
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                >
                  <option value="admin">Administrador</option>
                  <option value="atualizador">Atualizador</option>
                </select>
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
