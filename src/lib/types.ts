import type { EventStatus, Tag } from '@/config/constants'

/** Modelo de dados (docs/PLANO.md). Datas já convertidas para `Date`. */
export interface Evento {
  id: string
  titulo: string
  descricao: string
  local: string
  inicio: Date
  prazoContribuicoes: Date
  inscritos: number
  publicoPlanejado: number
  margem: number
  maxNecessidadesPorPessoa: number
  status: EventStatus
  /** Categorias do evento, na ordem de exibição (padrão das 7 quando o doc não tem o campo). */
  categorias: string[]
}

export interface Need {
  id: string
  nome: string
  categoria: string
  unidade: string
  meta: number
  reservado: number
  minPorPessoa: number
  maxPorPessoa: number
  opcoes: string[]
  opcoesNorm: string[]
  maxPorOpcao: number | null
  reservadoPorOpcao: Record<string, number>
  permiteOutro: boolean
  nota: string
  tags: Tag[]
  ordem: number
  ultimoUid: string | null
}

export interface Pledge {
  id: string
  needId: string
  uid: string
  qty: number
  opcao: string | null
  textoOutro: string | null
  primeiroNome: string
  devolverAoFinal: boolean
}

/** O que a pessoa escolhe no modal "Quero levar". */
export interface PledgeInput {
  qty: number
  opcao: string | null
  textoOutro: string | null
  devolverAoFinal: boolean
}

export type Contador = Pick<Need, 'reservado' | 'reservadoPorOpcao'>
