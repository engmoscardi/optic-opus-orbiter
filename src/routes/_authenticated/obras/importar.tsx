import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Download, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { COLUNAS_IMPORT, MODELO_CSV, linhaParaObra, parseCsvObras, type LinhaImport } from "@/lib/csv";

export const Route = createFileRoute("/_authenticated/obras/importar")({
  head: () => ({
    meta: [
      { title: "Importar obras em massa | FiberFlow" },
      {
        name: "description",
        content:
          "Cadastre várias obras de fibra óptica de uma vez enviando uma planilha CSV com o padrão de colunas do FiberFlow.",
      },
      { property: "og:title", content: "Importar obras em massa | FiberFlow" },
      {
        property: "og:description",
        content: "Envie um arquivo CSV e cadastre dezenas de obras com as 9 etapas criadas automaticamente.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ImportarObras,
});

function ImportarObras() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState("");
  const [linhas, setLinhas] = useState<LinhaImport[]>([]);
  const [desconhecidas, setDesconhecidas] = useState<string[]>([]);
  const [importando, setImportando] = useState(false);

  const validas = linhas.filter((l) => !l.erros.length);
  const invalidas = linhas.filter((l) => l.erros.length);

  const baixarModelo = () => {
    const blob = new Blob(["\uFEFF" + MODELO_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-obras-fiberflow.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const carregar = async (file: File) => {
    const texto = await file.text();
    const { linhas, colunasDesconhecidas } = parseCsvObras(texto);
    setArquivo(file.name);
    setLinhas(linhas);
    setDesconhecidas(colunasDesconhecidas);
    if (!linhas.length) toast.error("Nenhuma linha encontrada no arquivo.");
  };

  const importar = async () => {
    if (!validas.length) return;
    setImportando(true);
    const { data: userData } = await supabase.auth.getUser();
    const registros = validas.map((l) => linhaParaObra(l, userData.user?.id ?? null));
    const { error } = await supabase.from("obras").insert(registros);
    setImportando(false);
    if (error) {
      toast.error("Falha na importação: " + error.message);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["obras"] });
    toast.success(`${registros.length} obra(s) importada(s) com as 9 etapas.`);
    navigate({ to: "/obras" });
  };

  if (!loading && !isAdmin) {
    return (
      <AppShell>
        <div className="card-vivo p-6 text-center">
          <p className="text-sm font-semibold">Acesso restrito</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Apenas administradores podem importar obras em massa.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Importar obras em massa</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Envie um arquivo CSV com o padrão de colunas abaixo. Cada obra recebe as 9 etapas automaticamente.
          </p>
        </div>

        <div className="card-vivo space-y-3 p-4">
          <p className="label-tec">Padrão de colunas</p>
          <div className="flex flex-wrap gap-1.5">
            {COLUNAS_IMPORT.map((c) => (
              <span
                key={c}
                className="rounded-full bg-secondary px-2.5 py-1 font-mono text-[11px] text-secondary-foreground"
              >
                {c}
                {c === "codigo" || c === "nome" ? "*" : ""}
              </span>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            * obrigatórios. Separador <code>;</code> ou <code>,</code>. Prazo em AAAA-MM-DD ou DD/MM/AAAA.
          </p>
          <button
            onClick={baixarModelo}
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold transition-colors hover:bg-secondary"
          >
            <Download className="size-4" /> Baixar modelo CSV
          </button>
        </div>

        <div className="card-vivo p-4">
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void carregar(f);
            }}
          />
          <button
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-border py-8 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <Upload className="size-5" />
            {arquivo || "Selecionar arquivo CSV"}
          </button>
        </div>

        {desconhecidas.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Colunas ignoradas: {desconhecidas.join(", ")}
          </p>
        )}

        {linhas.length > 0 && (
          <div className="card-vivo overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-3 text-xs">
              <span className="font-semibold">
                {validas.length} válida(s) · {invalidas.length} com erro
              </span>
              <span className="text-muted-foreground">{linhas.length} linha(s)</span>
            </div>
            <div className="max-h-80 overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-secondary text-secondary-foreground">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Código</th>
                    <th className="px-3 py-2">Nome</th>
                    <th className="px-3 py-2">Local</th>
                    <th className="px-3 py-2">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => (
                    <tr key={l.linha} className="border-t border-border">
                      <td className="px-3 py-2 text-muted-foreground">{l.linha}</td>
                      <td className="px-3 py-2 font-mono">{l.valores.codigo || "—"}</td>
                      <td className="px-3 py-2">{l.valores.nome || "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {[l.valores.cidade, l.valores.uf].filter(Boolean).join("/") || "—"}
                      </td>
                      <td className="px-3 py-2">
                        {l.erros.length ? (
                          <span className="text-destructive">{l.erros.join("; ")}</span>
                        ) : (
                          <span className="text-success">OK</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <button
          onClick={importar}
          disabled={importando || !validas.length}
          className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-dark disabled:opacity-60"
        >
          {importando ? "Importando..." : `Importar ${validas.length} obra(s)`}
        </button>
      </div>
    </AppShell>
  );
}
