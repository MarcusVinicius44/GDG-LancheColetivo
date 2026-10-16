import { faseDoEvento } from '@/lib/pledgeLogic'
import { formatDataHora } from '@/lib/format'
import type { Evento } from '@/lib/types'

export function rotuloFase(ev: Evento, agora: Date): { texto: string; cor: string } {
  if (ev.status === 'rascunho') return { texto: 'Rascunho', cor: 'bg-gdg-yellow/25 text-ink' }
  switch (faseDoEvento(ev, agora)) {
    case 'antes-prazo':
      return { texto: 'Contribuições abertas', cor: 'bg-gdg-green/15 text-gdg-green' }
    case 'pos-prazo':
      return { texto: 'Prazo encerrado', cor: 'bg-gdg-yellow/25 text-ink' }
    case 'encerrado':
      return { texto: 'Em andamento', cor: 'bg-line text-muted' }
    default:
      return { texto: 'Encerrado', cor: 'bg-line text-muted' }
  }
}

/** Frase que explica ao participante o que ainda pode fazer. */
export function explicarFase(ev: Evento, agora: Date): string {
  if (ev.status === 'rascunho') return 'Este evento ainda é um rascunho e não está visível ao público.'
  switch (faseDoEvento(ev, agora)) {
    case 'antes-prazo':
      return `Você pode escolher, editar ou cancelar até ${formatDataHora(ev.prazoContribuicoes)}.`
    case 'pos-prazo':
      return `O prazo (${formatDataHora(ev.prazoContribuicoes)}) terminou. Agora só é possível reduzir ou cancelar o que você já reservou.`
    case 'encerrado':
      return 'O evento já começou. As contribuições não podem mais ser alteradas.'
    default:
      return 'Este evento está encerrado para contribuições.'
  }
}
