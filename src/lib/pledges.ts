import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  type Firestore,
  type Transaction,
} from 'firebase/firestore'
import { eventoDe, needDe, pledgeDe } from '@/lib/converters'
import { PledgeError, codigoDoSdk, erro, traduzirErroSdk } from '@/lib/errors'
import { primeiroNome } from '@/lib/format'
import {
  diagnosticarNegado,
  planejarCancelar,
  planejarSalvar,
  type Estado,
} from '@/lib/pledgeLogic'
import type { PledgeInput } from '@/lib/types'

/**
 * Escrita de pledges. Cada operação é uma `runTransaction` que lê
 * need + pledge + participant (+ evento), calcula com `pledgeLogic` e grava
 * valores literais (sem `increment`) — exatamente o que as Security Rules
 * exigem via `getAfter`. `ABORTED` (concorrência) é repetido pelo SDK; esgotadas
 * as tentativas vira "Muita gente ao mesmo tempo". `permission-denied` relê o
 * estado e explica o motivo real.
 */

export interface Ator {
  uid: string
  /** `user.displayName` do Google (vira `primeiroNome`, igual ao token `name`). */
  nome: string | null
}

const refs = (db: Firestore, eid: string, nid: string, uid: string) => ({
  evento: doc(db, 'events', eid),
  need: doc(db, 'events', eid, 'needs', nid),
  pledge: doc(db, 'events', eid, 'pledges', `${nid}_${uid}`),
  participant: doc(db, 'events', eid, 'participants', uid),
  cancelamento: doc(db, 'events', eid, 'cancelamentos', `${nid}_${uid}`),
})

async function lerEstado(tx: Transaction, db: Firestore, eid: string, nid: string, uid: string, bloqueado: boolean) {
  const r = refs(db, eid, nid, uid)
  const [ev, nd, pl, pt] = await Promise.all([tx.get(r.evento), tx.get(r.need), tx.get(r.pledge), tx.get(r.participant)])
  if (!ev.exists() || !nd.exists()) throw erro('inexistente')
  const estado: Estado = {
    evento: eventoDe(ev),
    need: needDe(nd),
    pledge: pl.exists() ? pledgeDe(pl) : null,
    ativas: pt.exists() ? (pt.data().ativas as number) : 0,
    bloqueado,
  }
  return { r, estado }
}

/** Reler o estado fora da transação para explicar um `permission-denied`. */
async function lerEstadoSolto(db: Firestore, eid: string, nid: string, uid: string): Promise<Estado | null> {
  const r = refs(db, eid, nid, uid)
  try {
    const [ev, nd, pl, pt, bl] = await Promise.all([
      getDoc(r.evento),
      getDoc(r.need),
      getDoc(r.pledge),
      getDoc(r.participant),
      getDoc(doc(db, 'blocked', uid)).catch(() => null),
    ])
    if (!ev.exists() || !nd.exists()) return null
    return {
      evento: eventoDe(ev),
      need: needDe(nd),
      pledge: pl.exists() ? pledgeDe(pl) : null,
      ativas: pt.exists() ? (pt.data().ativas as number) : 0,
      bloqueado: bl?.exists() ?? false,
    }
  } catch {
    return null
  }
}

type Acao = { tipo: 'salvar'; input: PledgeInput } | { tipo: 'cancelar'; porAdmin?: boolean }

async function traduzir(db: Firestore, eid: string, nid: string, uid: string, acao: Acao, e: unknown) {
  if (e instanceof PledgeError) return e
  let out: PledgeError
  if (codigoDoSdk(e) === 'permission-denied') {
    const estado = await lerEstadoSolto(db, eid, nid, uid)
    out = estado ? diagnosticarNegado(estado, acao, new Date()) : erro('permissao')
  } else {
    out = traduzirErroSdk(e)
  }
  // erro original do SDK, útil para suporte/depuração
  return Object.assign(out, { cause: e })
}

/** Cria ou edita a pledge de `ator` na necessidade `needId`. */
export async function salvarPledge(
  db: Firestore,
  eventId: string,
  needId: string,
  ator: Ator,
  input: PledgeInput,
  opts: { bloqueado?: boolean } = {},
): Promise<void> {
  try {
    await runTransaction(db, async (tx) => {
      const { r, estado } = await lerEstado(tx, db, eventId, needId, ator.uid, opts.bloqueado ?? false)
      const plano = planejarSalvar(estado, input, new Date())

      let logQty: number | null = null
      if (plano.liberada !== null) {
        const c = await tx.get(r.cancelamento)
        logQty = (c.exists() ? (c.data().qty as number) : 0) + plano.liberada
      }

      if (plano.tipo === 'criar') {
        tx.set(r.pledge, {
          needId,
          uid: ator.uid,
          qty: plano.qty,
          opcao: plano.opcao,
          textoOutro: plano.textoOutro,
          primeiroNome: primeiroNome(ator.nome),
          devolverAoFinal: plano.devolverAoFinal,
          criadoEm: serverTimestamp(),
          atualizadoEm: serverTimestamp(),
        })
      } else {
        tx.update(r.pledge, {
          qty: plano.qty,
          opcao: plano.opcao,
          textoOutro: plano.textoOutro,
          devolverAoFinal: plano.devolverAoFinal,
          atualizadoEm: serverTimestamp(),
        })
      }
      if (plano.contador) tx.update(r.need, { ...plano.contador, ultimoUid: ator.uid })
      if (plano.ativas !== null) tx.set(r.participant, { ativas: plano.ativas, ultimoNeedId: needId })
      if (logQty !== null) {
        tx.set(r.cancelamento, {
          needId,
          uid: ator.uid,
          primeiroNome: primeiroNome(ator.nome),
          qty: logQty,
          em: serverTimestamp(),
        })
      }
    })
  } catch (e) {
    throw await traduzir(db, eventId, needId, ator.uid, { tipo: 'salvar', input }, e)
  }
}

/**
 * Cancela a pledge. Sem `donoUid`, a própria pessoa cancela; a organização
 * passa `donoUid` (remoção de pledge alheia: sem prazos, sem log tardio).
 */
export async function cancelarPledge(
  db: Firestore,
  eventId: string,
  needId: string,
  ator: Ator,
  opts: { donoUid?: string } = {},
): Promise<void> {
  const dono = opts.donoUid ?? ator.uid
  const porAdmin = dono !== ator.uid
  try {
    await runTransaction(db, async (tx) => {
      const { r, estado } = await lerEstado(tx, db, eventId, needId, dono, false)
      const plano = planejarCancelar(estado, new Date(), { porAdmin })

      let logQty: number | null = null
      if (plano.liberada !== null) {
        const c = await tx.get(r.cancelamento)
        logQty = (c.exists() ? (c.data().qty as number) : 0) + plano.liberada
      }

      tx.delete(r.pledge)
      tx.update(r.need, { ...plano.contador, ultimoUid: dono })
      tx.set(r.participant, { ativas: plano.ativas, ultimoNeedId: needId })
      if (logQty !== null) {
        tx.set(r.cancelamento, {
          needId,
          uid: dono,
          primeiroNome: primeiroNome(ator.nome),
          qty: logQty,
          em: serverTimestamp(),
        })
      }
    })
  } catch (e) {
    throw await traduzir(db, eventId, needId, dono, { tipo: 'cancelar', porAdmin }, e)
  }
}
