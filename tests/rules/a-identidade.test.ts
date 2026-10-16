import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import {
  anonDb,
  customDb,
  dbOf,
  resetEnv,
  seedBasico,
  setupEnv,
  teardownEnv,
} from './harness'
import { assertFails, assertSucceeds, criar } from './ops'
import { primeiroNome } from '@/lib/format'

beforeAll(setupEnv)
afterAll(teardownEnv)
beforeEach(resetEnv)

const google = (extra: Record<string, unknown>) => ({
  email: 'u@x.com',
  email_verified: true,
  firebase: { sign_in_provider: 'google.com' },
  ...extra,
})

const userDoc = (over: Record<string, unknown> = {}) => ({
  nome: 'Alice Souza',
  primeiroNome: 'Alice',
  email: 'alice@x.com',
  ultimoLogin: serverTimestamp(),
  ...over,
})

describe('A. Identidade', () => {
  it('anônimo não escreve nada', async () => {
    await seedBasico()
    const db = anonDb()
    await assertFails(setDoc(doc(db, 'users/alice'), userDoc()))
    await assertFails(setDoc(doc(db, 'events/novo'), { titulo: 'x' }))
    await assertFails(setDoc(doc(db, 'events/evt1/needs/n9'), { nome: 'x' }))
    await assertFails(setDoc(doc(db, 'blocked/alice'), { motivo: 'x' }))
  })

  it('users: próprio doc ok', async () => {
    await assertSucceeds(setDoc(doc(dbOf('alice'), 'users/alice'), userDoc()))
  })

  it('users: doc de outro uid negado', async () => {
    await assertFails(setDoc(doc(dbOf('bob'), 'users/alice'), userDoc()))
  })

  it('provider ≠ google negado', async () => {
    const db = customDb('pw', {
      name: 'Pw User',
      email: 'u@x.com',
      email_verified: true,
      firebase: { sign_in_provider: 'password' },
    })
    await assertFails(
      setDoc(doc(db, 'users/pw'), userDoc({ nome: 'Pw User', primeiroNome: 'Pw', email: 'u@x.com' })),
    )
    await seedBasico()
    // anônimo do Firebase Auth também
    const anon = customDb('anon', { firebase: { sign_in_provider: 'anonymous' } })
    await assertFails(setDoc(doc(anon, 'users/anon'), userDoc({ email: 'x' })))
  })

  it('email_verified=false negado', async () => {
    const db = customDb('nv', google({ name: 'Nao Verif', email_verified: false }))
    await assertFails(
      setDoc(doc(db, 'users/nv'), userDoc({ nome: 'Nao Verif', primeiroNome: 'Nao', email: 'u@x.com' })),
    )
  })

  it('users com e-mail ≠ token negado', async () => {
    await assertFails(setDoc(doc(dbOf('alice'), 'users/alice'), userDoc({ email: 'outro@x.com' })))
  })

  it('ler users alheio negado; admin lê', async () => {
    await seedBasico()
    await setDoc(doc(dbOf('alice'), 'users/alice'), userDoc())
    await assertFails(getDoc(doc(dbOf('bob'), 'users/alice')))
    await assertSucceeds(getDoc(doc(dbOf('alice'), 'users/alice')))
    await assertSucceeds(getDoc(doc(dbOf('admin'), 'users/alice')))
  })

  it('users: primeiroNome forjado negado', async () => {
    await assertFails(setDoc(doc(dbOf('alice'), 'users/alice'), userDoc({ primeiroNome: 'Admin' })))
  })

  it('pledge: primeiroNome forjado negado (já em D); semNome exige "Participante"', async () => {
    await seedBasico()
    await assertFails(criar('semNome', 'n1', 1, { primeiroNome: 'Fulano' }))
    await assertSucceeds(criar('semNome', 'n1', 1))
  })

  // paridade cliente × rule: cada caso grava users/{uid}.primeiroNome com o
  // valor calculado pelo cliente (lib/format.ts) e a rule precisa aceitar,
  // e rejeitar qualquer valor diferente.
  const casos: Array<[string, Record<string, unknown>]> = [
    ['sem token.name', {}],
    ['nome vazio', { name: '' }],
    ['só espaços', { name: '    ' }],
    ['espaço inicial usa 1º token', { name: ' Maria Silva' }],
    ['1º token > 40 ⇒ Participante', { name: 'x'.repeat(41) + ' Silva' }],
    ['1º token == 40 ok', { name: 'y'.repeat(40) + ' Silva' }],
    ['nome com acento', { name: 'João Pedro' }],
  ]

  it.each(casos)('paridade primeiroNome: %s', async (_n, claims) => {
    const uid = 'p' + Math.abs(hash(_n))
    const db = customDb(uid, google(claims))
    const esperado = primeiroNome((claims.name as string | undefined) ?? undefined)
    const base = { nome: (claims.name as string) ?? '', email: 'u@x.com', ultimoLogin: serverTimestamp() }
    await assertSucceeds(setDoc(doc(db, `users/${uid}`), { ...base, primeiroNome: esperado }))
    const errado = esperado === 'Participante' ? 'Fulano' : 'Participante'
    await assertFails(setDoc(doc(db, `users/${uid}`), { ...base, primeiroNome: errado }))
  })
})

function hash(s: string) {
  let h = 0
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0
  return h
}
