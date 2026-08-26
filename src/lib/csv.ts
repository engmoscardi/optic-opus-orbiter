export const COLUNAS_IMPORT = [
  "codigo",
  "nome",
  "cidade",
  "uf",
  "extensao_km",
  "responsavel",
  "prazo",
  "observacoes",
] as const;

export type ColunaImport = (typeof COLUNAS_IMPORT)[number];

export const MODELO_CSV = [
  COLUNAS_IMPORT.join(";"),
  "2024-0892;FTTH Setor Norte - Trecho A;Campinas;SP;12.5;Ana Souza;2026-03-31;Obra prioritária",
  "2024-0893;FTTH Setor Sul - Trecho B;Sorocaba;SP;8;Carlos Lima;2026-05-15;",
].join("\n");

function detectarSeparador(linha: string) {
  const ponto = (linha.match(/;/g) ?? []).length;
  const virgula = (linha.match(/,/g) ?? []).length;
  const tab = (linha.match(/\t/g) ?? []).length;
  if (tab > ponto && tab > virgula) return "\t";
  return virgula > ponto ? "," : ";";
}

function parseLinha(linha: string, sep: string) {
  const out: string[] = [];
  let atual = "";
  let aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      if (aspas && linha[i + 1] === '"') {
        atual += '"';
        i++;
      } else aspas = !aspas;
    } else if (c === sep && !aspas) {
      out.push(atual);
      atual = "";
    } else atual += c;
  }
  out.push(atual);
  return out.map((v) => v.trim());
}

export type LinhaImport = {
  linha: number;
  valores: Record<ColunaImport, string>;
  erros: string[];
};

function normalizarData(v: string) {
  if (!v) return "";
  const br = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return v;
}

export function parseCsvObras(texto: string): { linhas: LinhaImport[]; colunasDesconhecidas: string[] } {
  const conteudo = texto.replace(/^\uFEFF/, "").trim();
  const linhasTexto = conteudo.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!linhasTexto.length) return { linhas: [], colunasDesconhecidas: [] };

  const sep = detectarSeparador(linhasTexto[0]!);
  const cabecalho = parseLinha(linhasTexto[0]!, sep).map((c) =>
    c
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "_"),
  );
  const colunasDesconhecidas = cabecalho.filter((c) => c && !COLUNAS_IMPORT.includes(c as ColunaImport));

  const vistos = new Set<string>();
  const linhas: LinhaImport[] = linhasTexto.slice(1).map((texto, idx) => {
    const celulas = parseLinha(texto, sep);
    const valores = Object.fromEntries(
      COLUNAS_IMPORT.map((col) => {
        const pos = cabecalho.indexOf(col);
        return [col, pos >= 0 ? (celulas[pos] ?? "") : ""];
      }),
    ) as Record<ColunaImport, string>;
    valores.prazo = normalizarData(valores.prazo);
    valores.uf = valores.uf.toUpperCase();

    const erros: string[] = [];
    if (!valores.codigo) erros.push("Código obrigatório");
    if (!valores.nome) erros.push("Nome obrigatório");
    if (valores.codigo && vistos.has(valores.codigo)) erros.push("Código duplicado no arquivo");
    if (valores.codigo) vistos.add(valores.codigo);
    if (valores.uf && valores.uf.length !== 2) erros.push("UF deve ter 2 letras");
    if (valores.extensao_km && Number.isNaN(Number(valores.extensao_km.replace(",", "."))))
      erros.push("Extensão inválida");
    if (valores.prazo && !/^\d{4}-\d{2}-\d{2}$/.test(valores.prazo)) erros.push("Prazo deve ser AAAA-MM-DD");

    return { linha: idx + 2, valores, erros };
  });

  return { linhas, colunasDesconhecidas };
}

export function linhaParaObra(l: LinhaImport, createdBy: string | null) {
  const v = l.valores;
  return {
    codigo: v.codigo,
    nome: v.nome,
    cidade: v.cidade || null,
    uf: v.uf || null,
    extensao_km: v.extensao_km ? Number(v.extensao_km.replace(",", ".")) : null,
    responsavel: v.responsavel || null,
    prazo: v.prazo || null,
    observacoes: v.observacoes || null,
    created_by: createdBy,
  };
}
