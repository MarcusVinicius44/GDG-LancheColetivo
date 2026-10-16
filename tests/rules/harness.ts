import { readFileSync } from 'node:fs'
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  Timestamp,
  doc,
  setDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'

export const PROJECT_ID = 'demo-lanche-coletivo'
export const EID = 'evt1'

const HOUR = 3600_000
const DAY = 24 * HOUR

export const ts = (ms: number) => Timestamp.fromMillis(ms)
export const agora = () => Date.now()

let env: RulesTestEnvironment

export async function setupEnv() {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
  return env
}

export const getEnv = () => env
export const teardownEnv = () => env.cleanup()
export const resetEnv = () => env.clearFirestore()

type Claims = Record<string, unknown>

const googleClaims = (name: string | undefined, email: string): Claims => ({
  ...(name === undefined ? {} : { name }),
  email,
  email_verified: true,
  firebase: { sign_in_provider: 'google.com' },
})

export const USERS = {
  alice: { uid: 'alice', claims: googleClaims('Alice Souza', 'alice@x.com') },
  bob: { uid: 'bob', claims: googleClaims('Bob Lima', 'bob@x.com') },
  carol: { uid: 'carol', claims: googleClaims('Carol Dias', 'carol@x.com') },
  admin: { uid: 'admin', claims: googleClaims('Admin GDG', 'admin@x.com') },
  bloqueada: { uid: 'bloqueada', claims: googleClaims('Bia Block', 'bia@x.com') },
  semNome: { uid: 'semNome', claims: googleClaims(undefined, 'sn@x.com') },
} as const

export type UserKey = keyof typeof USERS

export const ctx = (k: UserKey) =>
  env.authenticatedContext(USERS[k].uid, USERS[k].claims)

export const dbOf = (k: UserKey) => ctx(k).firestore() as unknown as Firestore

export const anonDb = () => env.unauthenticatedContext().firestore() as unknown as Firestore

export const customDb = (uid: string, claims: Claims) =>
  env.authenticatedContext(uid, claims).firestore() as unknown as Firestore

// ---------- Fixtures ----------

export const nowMs = () => Date.now()

export const eventoBase = (over: Record<string, unknown> = {}) => ({
  titulo: 'Coding Jam',
  descricao: 'Evento teste',
  local: 'UNINASSAU',
  inicio: ts(nowMs() + 5 * DAY),
  prazoContribuicoes: ts(nowMs() + 3 * DAY),
  inscritos: 0,
  publicoPlanejado: 90,
  margem: 0,
  maxNecessidadesPorPessoa: 2,
  status: 'aberto',
  criadoEm: ts(nowMs() - DAY),
  ...over,
})

export const needBase = (over: Record<string, unknown> = {}) => ({
  nome: 'Refrigerante',
  categoria: 'Bebidas',
  unidade: 'garrafa 2L',
  meta: 10,
  reservado: 0,
  minPorPessoa: 1,
  maxPorPessoa: 4,
  opcoes: [] as string[],
  opcoesNorm: [] as string[],
  maxPorOpcao: null,
  reservadoPorOpcao: {} as Record<string, number>,
  permiteOutro: false,
  nota: '',
  tags: [] as string[],
  ordem: 1,
  ultimoUid: null,
  ...over,
})

export const norm = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[áàâãä]/g, 'a')
    .replace(/[éèêë]/g, 'e')
    .replace(/[íìîï]/g, 'i')
    .replace(/[óòôõö]/g, 'o')
    .replace(/[úùûü]/g, 'u')
    .replace(/ç/g, 'c')
    .replace(/ñ/g, 'n')

/** need com opções, contadores zerados por opção. */
export const needComOpcoes = (
  opcoes: string[],
  over: Record<string, unknown> = {},
) =>
  needBase({
    nome: 'Suco',
    meta: 12,
    opcoes,
    opcoesNorm: opcoes.map(norm),
    maxPorOpcao: 4,
    reservadoPorOpcao: Object.fromEntries(opcoes.map((o) => [o, 0])),
    ...over,
  })

export type Fixture = {
  eventoId: string
  needs?: Record<string, Record<string, unknown>>
  evento?: Record<string, unknown>
}

export const EVENTOS = {
  aberto: () => eventoBase(),
  prazoPassado: () =>
    eventoBase({
      inicio: ts(nowMs() + 2 * DAY),
      prazoContribuicoes: ts(nowMs() - HOUR),
    }),
  iniciado: () =>
    eventoBase({
      inicio: ts(nowMs() - HOUR),
      prazoContribuicoes: ts(nowMs() - DAY),
    }),
  rascunho: () => eventoBase({ status: 'rascunho' }),
  fechado: () => eventoBase({ status: 'fechado' }),
}

/** Escreve dados sem passar pelas rules. */
export async function seed(
  fn: (db: Firestore) => Promise<void>,
) {
  await env.withSecurityRulesDisabled(async (c) => {
    await fn(c.firestore() as unknown as Firestore)
  })
}

export const evPath = (eid = EID) => `events/${eid}`
export const needPath = (nid: string, eid = EID) => `events/${eid}/needs/${nid}`
export const pledgePath = (nid: string, uid: string, eid = EID) =>
  `events/${eid}/pledges/${nid}_${uid}`
export const partPath = (uid: string, eid = EID) =>
  `events/${eid}/participants/${uid}`
export const cancelPath = (nid: string, uid: string, eid = EID) =>
  `events/${eid}/cancelamentos/${nid}_${uid}`

export async function seedBasico(opts: {
  evento?: Record<string, unknown>
  needs?: Record<string, Record<string, unknown>>
  admin?: boolean
  bloqueados?: string[]
} = {}) {
  await seed(async (db) => {
    await setDoc(doc(db, evPath()), opts.evento ?? eventoBase())
    const needs = opts.needs ?? { n1: needBase() }
    for (const [nid, n] of Object.entries(needs)) {
      await setDoc(doc(db, needPath(nid)), n)
    }
    if (opts.admin !== false) {
      await setDoc(doc(db, 'admins/admin'), { criadoEm: ts(nowMs()) })
    }
    for (const uid of opts.bloqueados ?? ['bloqueada']) {
      await setDoc(doc(db, `blocked/${uid}`), { motivo: 'teste', em: ts(nowMs()) })
    }
  })
}

// ---------- Escritas cruas (casos adversariais) ----------

export type PledgeInput = {
  nid: string
  uid: string
  qty: number
  opcao?: string | null
  textoOutro?: string | null
  primeiroNome?: string
  devolverAoFinal?: boolean
  criadoEm?: unknown
  atualizadoEm?: unknown
  extra?: Record<string, unknown>
}

export const pledgeDoc = (p: PledgeInput, serverTime: unknown) => ({
  needId: p.nid,
  uid: p.uid,
  qty: p.qty,
  opcao: p.opcao ?? null,
  textoOutro: p.textoOutro ?? null,
  primeiroNome: p.primeiroNome ?? 'Alice',
  devolverAoFinal: p.devolverAoFinal ?? false,
  criadoEm: p.criadoEm ?? serverTime,
  atualizadoEm: p.atualizadoEm ?? serverTime,
  ...(p.extra ?? {}),
})

export type NeedCounter = {
  reservado: number
  reservadoPorOpcao?: Record<string, number>
  ultimoUid: string
}

export type CommitInput = {
  db: Firestore
  pledge?: PledgeInput | 'delete'
  pledgeId?: { nid: string; uid: string }
  need?: { nid: string; data: NeedCounter }
  participant?: { uid: string; data: { ativas: number; ultimoNeedId: string } }
  cancelamento?: { nid: string; uid: string; data: Record<string, unknown> }
  serverTime: unknown
}

/**
 * Batch de 3–4 documentos como o cliente real faria; cada parte pode ser
 * adulterada pelo teste. `merge` de need/participant usa update.
 */
export function buildBatch(i: CommitInput, mode: 'create' | 'update') {
  const b = writeBatch(i.db)
  if (i.pledge && i.pledge !== 'delete') {
    const ref = doc(i.db, pledgePath(i.pledge.nid, i.pledge.uid))
    if (mode === 'create') b.set(ref, pledgeDoc(i.pledge, i.serverTime))
    else b.update(ref, pledgeUpdate(i.pledge, i.serverTime))
  } else if (i.pledge === 'delete' && i.pledgeId) {
    b.delete(doc(i.db, pledgePath(i.pledgeId.nid, i.pledgeId.uid)))
  }
  if (i.need) {
    b.update(doc(i.db, needPath(i.need.nid)), { ...i.need.data })
  }
  if (i.participant) {
    b.set(doc(i.db, partPath(i.participant.uid)), i.participant.data)
  }
  if (i.cancelamento) {
    b.set(
      doc(i.db, cancelPath(i.cancelamento.nid, i.cancelamento.uid)),
      i.cancelamento.data,
    )
  }
  return b
}

const pledgeUpdate = (p: PledgeInput, serverTime: unknown) => ({
  qty: p.qty,
  opcao: p.opcao ?? null,
  textoOutro: p.textoOutro ?? null,
  devolverAoFinal: p.devolverAoFinal ?? false,
  atualizadoEm: p.atualizadoEm ?? serverTime,
  ...(p.extra ?? {}),
})

export { HOUR, DAY }
