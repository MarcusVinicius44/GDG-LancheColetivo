import type { DocumentData, DocumentSnapshot, QueryDocumentSnapshot, Timestamp } from 'firebase/firestore'
import { CATEGORIAS_PADRAO } from '@/config/constants'
import type { Evento, Need, Pledge } from '@/lib/types'

type Snap = DocumentSnapshot | QueryDocumentSnapshot

const data = (s: Snap): DocumentData => s.data() ?? {}
const data_ = (t: unknown): Date => (t as Timestamp | undefined)?.toDate?.() ?? new Date(0)

export function eventoDe(s: Snap): Evento {
  const d = data(s)
  return {
    id: s.id,
    titulo: d.titulo ?? '',
    descricao: d.descricao ?? '',
    local: d.local ?? '',
    inicio: data_(d.inicio),
    prazoContribuicoes: data_(d.prazoContribuicoes),
    inscritos: d.inscritos ?? 0,
    publicoPlanejado: d.publicoPlanejado ?? 0,
    margem: d.margem ?? 0,
    maxNecessidadesPorPessoa: d.maxNecessidadesPorPessoa ?? 1,
    status: d.status ?? 'rascunho',
    categorias: Array.isArray(d.categorias) && d.categorias.length > 0 ? d.categorias : [...CATEGORIAS_PADRAO],
  }
}

export function needDe(s: Snap): Need {
  const d = data(s)
  return {
    id: s.id,
    nome: d.nome ?? '',
    categoria: d.categoria,
    unidade: d.unidade ?? '',
    meta: d.meta ?? 0,
    reservado: d.reservado ?? 0,
    minPorPessoa: d.minPorPessoa ?? 1,
    maxPorPessoa: d.maxPorPessoa ?? 1,
    opcoes: d.opcoes ?? [],
    opcoesNorm: d.opcoesNorm ?? [],
    maxPorOpcao: d.maxPorOpcao ?? null,
    reservadoPorOpcao: d.reservadoPorOpcao ?? {},
    permiteOutro: d.permiteOutro ?? false,
    nota: d.nota ?? '',
    tags: d.tags ?? [],
    ordem: d.ordem ?? 0,
    ultimoUid: d.ultimoUid ?? null,
  }
}

export function pledgeDe(s: Snap): Pledge {
  const d = data(s)
  return {
    id: s.id,
    needId: d.needId,
    uid: d.uid,
    qty: d.qty ?? 0,
    opcao: d.opcao ?? null,
    textoOutro: d.textoOutro ?? null,
    primeiroNome: d.primeiroNome ?? 'Participante',
    devolverAoFinal: d.devolverAoFinal ?? false,
  }
}
