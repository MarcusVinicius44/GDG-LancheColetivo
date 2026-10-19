import { deleteDoc, doc, serverTimestamp, setDoc, Timestamp, updateDoc, writeBatch, type Firestore } from 'firebase/firestore'
import type { EventoBase } from '@/lib/eventoForm'
import { HALLOWEEN_EVENT, HALLOWEEN_NEEDS, needDoc } from '@/templates/halloween'

/** Lotes de needs pequenos: cada escrita gasta acessos das rules (limite de 20 por lote). */
const LOTE = 8

/**
 * Cria o evento do Halloween como **rascunho** (passa pelas rules como admin).
 * Só para um evento novo: se o id já existir, as rules negam (criadoEm é imutável).
 */
export async function criarEventoHalloween(db: Firestore, variante?: { id: string; titulo: string }): Promise<string> {
  const e = { ...HALLOWEEN_EVENT, ...variante }
  await setDoc(doc(db, 'events', e.id), {
    titulo: e.titulo,
    descricao: e.descricao,
    local: e.local,
    inicio: Timestamp.fromDate(e.inicio),
    prazoContribuicoes: Timestamp.fromDate(e.prazoContribuicoes),
    inscritos: e.inscritos,
    publicoPlanejado: e.publicoPlanejado,
    margem: e.margem,
    maxNecessidadesPorPessoa: e.maxNecessidadesPorPessoa,
    categorias: e.categorias,
    status: 'rascunho',
    criadoEm: serverTimestamp(),
  })
  for (let i = 0; i < HALLOWEEN_NEEDS.length; i += LOTE) {
    const b = writeBatch(db)
    HALLOWEEN_NEEDS.slice(i, i + LOTE).forEach((t, j) => {
      b.set(doc(db, 'events', e.id, 'needs', t.id), needDoc(t, i + j + 1))
    })
    await b.commit()
  }
  return e.id
}

/** Cópia do Halloween para testar em produção sem sujar o evento real. */
export const EVENTO_TESTE = { id: 'teste-halloween', titulo: '[TESTE] Coding Jam de Halloween' }

export const criarEventoTeste = (db: Firestore) => criarEventoHalloween(db, EVENTO_TESTE)

export const publicarEvento = (db: Firestore, eventId: string) =>
  updateDoc(doc(db, 'events', eventId), { status: 'aberto' })

export const fecharEvento = (db: Firestore, eventId: string) =>
  updateDoc(doc(db, 'events', eventId), { status: 'fechado' })

/** "Reabrir até…": estende o prazo (as rules exigem novo prazo ≤ início do evento). Logs de cancelamento tardio permanecem. */
export const reabrirPrazo = (db: Firestore, eventId: string, novoPrazo: Date) =>
  updateDoc(doc(db, 'events', eventId), { prazoContribuicoes: Timestamp.fromDate(novoPrazo) })

/** Grava só os campos alterados dos dados do evento (datas viram `Timestamp`). `false` = nada a gravar. */
export async function salvarEvento(db: Firestore, eventId: string, campos: Partial<EventoBase>): Promise<boolean> {
  const dados = Object.fromEntries(
    Object.entries(campos).map(([k, v]) => [k, v instanceof Date ? Timestamp.fromDate(v) : v]),
  )
  if (Object.keys(dados).length === 0) return false
  await updateDoc(doc(db, 'events', eventId), dados)
  return true
}

/** Bloqueado não cria nem aumenta contribuições, mas pode reduzir/cancelar. */
export const bloquearUsuario = (db: Firestore, uid: string, motivo: string) =>
  setDoc(doc(db, 'blocked', uid), { motivo: motivo.trim().slice(0, 200), em: serverTimestamp() })

export const desbloquearUsuario = (db: Firestore, uid: string) => deleteDoc(doc(db, 'blocked', uid))
