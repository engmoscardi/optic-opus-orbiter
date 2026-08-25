export const ETAPAS = [
  "Planejamento",
  "Projetos",
  "Protocolos de Licenças",
  "Licenças para Obras",
  "Fornecimento de Materiais",
  "Dependência Extra",
  "Execução",
  "Baixa da Obra",
  "Aceitação",
] as const;

export type EtapaStatus = "pendente" | "em_andamento" | "concluida" | "bloqueada";

export const STATUS_LABEL: Record<EtapaStatus, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  bloqueada: "Bloqueada",
};

export const STATUS_ORDER: EtapaStatus[] = ["pendente", "em_andamento", "bloqueada", "concluida"];

export const STATUS_CLASS: Record<EtapaStatus, string> = {
  pendente: "bg-muted text-muted-foreground",
  em_andamento: "bg-primary/10 text-primary",
  concluida: "bg-success/15 text-success",
  bloqueada: "bg-destructive/10 text-destructive",
};

export type Obra = {
  id: string;
  codigo: string;
  nome: string;
  cidade: string | null;
  uf: string | null;
  extensao_km: number | null;
  responsavel: string | null;
  prazo: string | null;
  observacoes: string | null;
  created_at: string;
};

export type Etapa = {
  id: string;
  obra_id: string;
  ordem: number;
  nome: string;
  status: EtapaStatus;
  responsavel: string | null;
  observacao: string | null;
  data_conclusao: string | null;
  updated_at: string;
};

export function progresso(etapas: Pick<Etapa, "status">[]) {
  if (!etapas.length) return 0;
  const done = etapas.filter((e) => e.status === "concluida").length;
  return Math.round((done / etapas.length) * 100);
}

export function etapaAtual(etapas: Etapa[]) {
  const ordered = [...etapas].sort((a, b) => a.ordem - b.ordem);
  return (
    ordered.find((e) => e.status === "em_andamento") ??
    ordered.find((e) => e.status === "bloqueada") ??
    ordered.find((e) => e.status === "pendente") ??
    ordered[ordered.length - 1]
  );
}
