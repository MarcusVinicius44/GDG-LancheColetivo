import { doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import {
  USERS,
  dbOf,
  getEnv,
  needPath,
  partPath,
  pledgePath,
  cancelPath,
  type UserKey,
} from './harness'
import type { Firestore } from 'firebase/firestore'

type Doc = Record<string, any>

export async function readRaw(path: string): Promise<Doc | undefined> {
  let out: Doc | undefined
  await getEnv().withSecurityRulesDisabled(async (c) => {
    const s = await getDoc(doc(c.firestore() as unknown as Firestore, path))
    out = s.exists() ? (s.data() as Doc) : undefined
  })
  return out
}

export const primeiro = (k: UserKey) =>
  (USERS[k].claims as Doc).name?.split(' ')[0] ?? 'Participante'

export type Ops = {
  /** altera o commit antes de enviar (adulteração adversarial) */
  mutate?: (c: Commit) => void
  /** partes a omitir */
  omit?: Array<'need' | 'participant' | 'cancelamento' | 'pledge'>
}

export type Commit = {
  pledge?: Doc | 'delete'
  need?: Doc
  participant?: Doc
  cancelamento?: Doc
  /** o que aplicar à pledge (create=set, update=update) */
  mode: 'create' | 'update' | 'delete'
}

const por = (cur: Doc | undefined, opcao: string | null | undefined, d: number) => {
  const m = { ...(cur ?? {}) }
  if (opcao) m[opcao] = (m[opcao] ?? 0) + d
  return m
}

async function send(db: Firestore, nid: string, uid: string, c: Commit, o: Ops) {
  const omit = new Set(o.omit ?? [])
  o.mutate?.(c)
  const b = writeBatch(db)
  const pref = doc(db, pledgePath(nid, uid))
  if (!omit.has('pledge') && c.pledge) {
    if (c.pledge === 'delete') b.delete(pref)
    else if (c.mode === 'create') b.set(pref, c.pledge)
    else b.update(pref, c.pledge)
  }
  if (!omit.has('need') && c.need) b.update(doc(db, needPath(nid)), c.need)
  if (!omit.has('participant') && c.participant) {
    b.set(doc(db, partPath(c.participant.__uid ?? uid)), strip(c.participant))
  }
  if (!omit.has('cancelamento') && c.cancelamento) {
    b.set(doc(db, cancelPath(nid, uid)), c.cancelamento)
  }
  return b.commit()
}

const strip = (d: Doc) => {
  const { __uid, ...r } = d
  return r
}

export type CreateOpts = Ops & {
  opcao?: string | null
  textoOutro?: string | null
  devolverAoFinal?: boolean
  primeiroNome?: string
}

/** Monta e envia o commit correto de criação; retorna a Promise do commit. */
export async function criar(k: UserKey, nid: string, qty: number, o: CreateOpts = {}) {
  const uid = USERS[k].uid
  const need = (await readRaw(`events/evt1/needs/${nid}`)) ?? {}
  const part = await readRaw(`events/evt1/participants/${uid}`)
  const c: Commit = {
    mode: 'create',
    pledge: {
      needId: nid,
      uid,
      qty,
      opcao: o.opcao ?? null,
      textoOutro: o.textoOutro ?? null,
      primeiroNome: o.primeiroNome ?? primeiro(k),
      devolverAoFinal: o.devolverAoFinal ?? false,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    },
    need: {
      reservado: (need.reservado ?? 0) + qty,
      reservadoPorOpcao: por(need.reservadoPorOpcao, o.opcao, qty),
      ultimoUid: uid,
    },
    participant: { ativas: (part?.ativas ?? 0) + 1, ultimoNeedId: nid },
  }
  return send(dbOf(k), nid, uid, c, o)
}

export type EditOpts = Ops & {
  opcao?: string | null
  textoOutro?: string | null
  devolverAoFinal?: boolean
  /** gera o log de cancelamento tardio (redução pós-prazo) */
  log?: boolean
}

/** Edição de qty/opção da própria pledge. */
export async function editar(k: UserKey, nid: string, novaQty: number, o: EditOpts = {}) {
  const uid = USERS[k].uid
  const need = (await readRaw(`events/evt1/needs/${nid}`)) ?? {}
  const antes = (await readRaw(`events/evt1/pledges/${nid}_${uid}`))!
  const opcaoDepois = o.opcao === undefined ? antes.opcao : o.opcao
  let porOp = por(need.reservadoPorOpcao, antes.opcao, -antes.qty)
  porOp = por(porOp, opcaoDepois, novaQty)
  const c: Commit = {
    mode: 'update',
    pledge: {
      qty: novaQty,
      opcao: opcaoDepois ?? null,
      textoOutro: o.textoOutro === undefined ? antes.textoOutro ?? null : o.textoOutro,
      devolverAoFinal: o.devolverAoFinal ?? antes.devolverAoFinal,
      atualizadoEm: serverTimestamp(),
    },
    need: {
      reservado: need.reservado - antes.qty + novaQty,
      reservadoPorOpcao: porOp,
      ultimoUid: uid,
    },
  }
  if (o.log) {
    const prev = await readRaw(`events/evt1/cancelamentos/${nid}_${uid}`)
    c.cancelamento = {
      needId: nid,
      uid,
      primeiroNome: antes.primeiroNome,
      qty: (prev?.qty ?? 0) + (antes.qty - novaQty),
      em: serverTimestamp(),
    }
  }
  return send(dbOf(k), nid, uid, c, o)
}

export type CancelOpts = Ops & { log?: boolean }

/**
 * Cancela a pledge de `dono` (atuando como `k`; admin remove alheia).
 */
export async function cancelar(
  k: UserKey,
  nid: string,
  dono: UserKey = k,
  o: CancelOpts = {},
) {
  const uid = USERS[dono].uid
  const need = (await readRaw(`events/evt1/needs/${nid}`)) ?? {}
  const antes = (await readRaw(`events/evt1/pledges/${nid}_${uid}`))!
  const part = await readRaw(`events/evt1/participants/${uid}`)
  const c: Commit = {
    mode: 'delete',
    pledge: 'delete',
    need: {
      reservado: need.reservado - antes.qty,
      reservadoPorOpcao: por(need.reservadoPorOpcao, antes.opcao, -antes.qty),
      ultimoUid: uid,
    },
    participant: { ativas: (part?.ativas ?? 1) - 1, ultimoNeedId: nid, __uid: uid },
  }
  if (o.log) {
    const prev = await readRaw(`events/evt1/cancelamentos/${nid}_${uid}`)
    c.cancelamento = {
      needId: nid,
      uid,
      primeiroNome: antes.primeiroNome,
      qty: (prev?.qty ?? 0) + antes.qty,
      em: serverTimestamp(),
    }
  }
  return send(dbOf(k), nid, uid, c, o)
}

/** Atalho: pledge já existente (estado consistente) via rules desabilitadas. */
export async function seedPledge(
  uid: UserKey,
  nid: string,
  qty: number,
  o: { opcao?: string | null; textoOutro?: string | null; ativas?: number } = {},
) {
  const { setDoc, Timestamp, updateDoc } = await import('firebase/firestore')
  const u = USERS[uid].uid
  await getEnv().withSecurityRulesDisabled(async (c) => {
    const db = c.firestore() as unknown as Firestore
    const now = Timestamp.now()
    await setDoc(doc(db, pledgePath(nid, u)), {
      needId: nid,
      uid: u,
      qty,
      opcao: o.opcao ?? null,
      textoOutro: o.textoOutro ?? null,
      primeiroNome: primeiro(uid),
      devolverAoFinal: false,
      criadoEm: now,
      atualizadoEm: now,
    })
    const nd = (await getDoc(doc(db, needPath(nid)))).data() as Doc
    await updateDoc(doc(db, needPath(nid)), {
      reservado: (nd.reservado ?? 0) + qty,
      reservadoPorOpcao: por(nd.reservadoPorOpcao, o.opcao, qty),
      ultimoUid: u,
    })
    const pd = (await getDoc(doc(db, partPath(u)))).data() as Doc | undefined
    await setDoc(doc(db, partPath(u)), {
      ativas: o.ativas ?? (pd?.ativas ?? 0) + 1,
      ultimoNeedId: nid,
    })
  })
}

export { assertFails, assertSucceeds }
