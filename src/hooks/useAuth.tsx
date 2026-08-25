import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Papel = "admin" | "atualizador" | null;

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [papel, setPapel] = useState<Papel>(null);
  const [nome, setNome] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async (s: Session | null) => {
      if (!active) return;
      setSession(s);
      setUser(s?.user ?? null);
      if (!s?.user) {
        setPapel(null);
        setNome("");
        setLoading(false);
        return;
      }
      const [{ data: roles }, { data: profile }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", s.user.id),
        supabase.from("profiles").select("nome").eq("id", s.user.id).maybeSingle(),
      ]);
      if (!active) return;
      const isAdmin = (roles ?? []).some((r) => r.role === "admin");
      setPapel(isAdmin ? "admin" : "atualizador");
      setNome(profile?.nome ?? s.user.email ?? "");
      setLoading(false);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      void load(s);
    });
    void supabase.auth.getSession().then(({ data }) => load(data.session));

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, user, papel, nome, loading, isAdmin: papel === "admin" };
}

export function iniciais(nome: string) {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
