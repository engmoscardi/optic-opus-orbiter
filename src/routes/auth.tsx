import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar | FiberFlow — Gestão de obras de fibra óptica" },
      {
        name: "description",
        content:
          "Acesse o FiberFlow para cadastrar obras de fibra óptica e atualizar as etapas de planejamento, licenças, execução e aceitação.",
      },
      { property: "og:title", content: "Entrar no FiberFlow" },
      {
        property: "og:description",
        content: "Painel de controle das obras de implantação de fibra óptica.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [modo, setModo] = useState<"entrar" | "criar">("entrar");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/obras", replace: true });
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/obras", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    if (modo === "entrar") {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) toast.error("Não foi possível entrar: " + error.message);
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: { emailRedirectTo: window.location.origin, data: { nome } },
      });
      if (error) toast.error("Não foi possível criar a conta: " + error.message);
      else if (!data.session) toast.success("Confira seu e-mail para confirmar o cadastro.");
    }
    setCarregando(false);
  };

  const google = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) toast.error("Falha no login com Google.");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <div className="grid size-9 place-items-center rounded-lg bg-primary font-bold text-primary-foreground">
            F
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">FiberFlow</h1>
            <p className="text-xs text-muted-foreground">Obras de fibra óptica</p>
          </div>
        </div>

        <div className="card-vivo p-5 shadow-sm">
          <div className="mb-4 flex gap-1 rounded-xl bg-secondary p-1">
            {(["entrar", "criar"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setModo(m)}
                className={
                  modo === m
                    ? "flex-1 rounded-lg bg-card py-2 text-sm font-semibold shadow-sm"
                    : "flex-1 rounded-lg py-2 text-sm font-medium text-muted-foreground"
                }
              >
                {m === "entrar" ? "Entrar" : "Criar conta"}
              </button>
            ))}
          </div>

          <form onSubmit={enviar} className="space-y-3">
            {modo === "criar" && (
              <div className="space-y-1.5">
                <label className="label-tec">Nome</label>
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <label className="label-tec">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="label-tec">Senha</label>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                minLength={6}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={carregando}
              className="w-full rounded-full bg-primary transition-colors hover:bg-primary-dark py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {modo === "entrar" ? "Entrar" : "Criar conta"}
            </button>
          </form>

          <div className="my-4 flex items-center gap-3 text-[10px] uppercase tracking-widest text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> ou <div className="h-px flex-1 bg-border" />
          </div>

          <button
            onClick={google}
            className="w-full rounded-xl border border-border bg-card py-2.5 text-sm font-semibold transition-colors hover:bg-secondary"
          >
            Continuar com Google
          </button>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          O primeiro usuário cadastrado recebe o perfil de administrador.
        </p>
      </div>
    </div>
  );
}
