import { Tag } from 'antd'

const statusConfig: Record<string, { color: string; label: string }> = {
  // Documento
  Rascunho:          { color: 'default',   label: 'Rascunho' },
  EmElaboracao:      { color: 'default',   label: 'Em Elaboração' },
  EmRevisao:         { color: 'blue',      label: 'Em Revisão' },
  EmAprovacao:       { color: 'gold',      label: 'Em Aprovação' },
  DevolvidoAjuste:   { color: 'orange',    label: 'Devolvido p/ Ajuste' },
  Aprovado:          { color: 'green',     label: 'Aprovado' },
  Reprovado:         { color: 'red',       label: 'Reprovado' },
  Publicado:         { color: 'cyan',      label: 'Publicado' },
  Arquivado:         { color: 'purple',    label: 'Arquivado' },
  Cancelado:         { color: 'volcano',   label: 'Cancelado' },
  Vencido:           { color: 'magenta',   label: 'Vencido' },
  // Tarefa
  Pendente:          { color: 'orange',    label: 'Pendente' },
  Concluida:         { color: 'green',     label: 'Concluída' },
  Aguardando:        { color: 'default',   label: 'Aguardando' },
  Cancelada:         { color: 'volcano',   label: 'Cancelada' },
}

export function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] ?? { color: 'default', label: status }
  return <Tag color={cfg.color}>{cfg.label}</Tag>
}
