import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import {
  EID,
  EVENTOS,
  USERS,
  anonDb,
  dbOf,
  needBase,
  needPath,
  partPath,
  pledgePath,
  resetEnv,
  seed,
  seedBasico,
  setupEnv,
  teardownEnv,
  ts,
  nowMs,
} from './harness'

beforeAll(setupEnv)
afterAll(teardownEnv)
beforeEach(resetEnv)

describe('B. Leitura', () => {
  it('público (anônimo) lê evento aberto e needs', async () => {
    await seedBasico()
    const db = anonDb()
    await assertSucceeds(getDoc(doc(db, `events/${EID}`)))
    await assertSucceeds(getDoc(doc(db, needPath('n1'))))
  })

  it('público lê evento fechado', async () => {
    await seedBasico({ evento: EVENTOS.fechado() })
    await assertSucceeds(getDoc(doc(anonDb(), `events/${EID}`)))
  })

  it('rascunho: público não lê evento nem needs; admin lê', async () => {
    await seedBasico({ evento: EVENTOS.rascunho() })
    await seed(async (db) => {
      await setDoc(doc(db, pledgePath('n1', 'alice')), { needId: 'n1', uid: 'alice', qty: 1 })
    })
    await assertFails(getDoc(doc(dbOf('alice'), `events/${EID}`)))
    await assertFails(getDoc(doc(dbOf('alice'), needPath('n1'))))
    await assertFails(getDoc(doc(dbOf('alice'), pledgePath('n1', 'alice'))))
    await assertSucceeds(getDoc(doc(dbOf('admin'), `events/${EID}`)))
    await assertSucceeds(getDoc(doc(dbOf('admin'), needPath('n1'))))
  })

  it('participants: alheio negado, próprio ok, admin ok', async () => {
    await seedBasico()
    await seed(async (db) => {
      await setDoc(doc(db, partPath('alice')), { ativas: 1, ultimoNeedId: 'n1' })
    })
    await assertFails(getDoc(doc(dbOf('bob'), partPath('alice'))))
    await assertSucceeds(getDoc(doc(dbOf('alice'), partPath('alice'))))
    await assertSucceeds(getDoc(doc(dbOf('admin'), partPath('alice'))))
  })

  it('blocked/{meu uid} ok, de outro negado, admin ok', async () => {
    await seedBasico()
    await assertSucceeds(getDoc(doc(dbOf('bloqueada'), 'blocked/bloqueada')))
    await assertFails(getDoc(doc(dbOf('alice'), 'blocked/bloqueada')))
    await assertSucceeds(getDoc(doc(dbOf('admin'), 'blocked/bloqueada')))
  })

  it('admins/{uid}: próprio ok, escrita por qualquer um negada (inclusive admin)', async () => {
    await seedBasico()
    await assertSucceeds(getDoc(doc(dbOf('admin'), 'admins/admin')))
    await assertFails(getDoc(doc(dbOf('alice'), 'admins/admin')))
    const criado = { criadoEm: ts(nowMs()) }
    await assertFails(setDoc(doc(dbOf('alice'), 'admins/alice'), criado))
    await assertFails(setDoc(doc(dbOf('admin'), 'admins/alice'), criado))
    await assertFails(setDoc(doc(dbOf('admin'), 'admins/admin'), criado))
  })

  it('cancelamentos: dono lê o próprio log (existente ou não), outro não, admin sim', async () => {
    await seedBasico()
    await seed(async (db) => {
      await setDoc(doc(db, 'events/evt1/cancelamentos/n1_alice'), { needId: 'n1', uid: 'alice', primeiroNome: 'Alice', qty: 1, em: ts(nowMs()) })
    })
    await assertSucceeds(getDoc(doc(dbOf('alice'), 'events/evt1/cancelamentos/n1_alice')))
    await assertSucceeds(getDoc(doc(dbOf('alice'), 'events/evt1/cancelamentos/n2_alice')))
    await assertFails(getDoc(doc(dbOf('bob'), 'events/evt1/cancelamentos/n1_alice')))
    await assertFails(getDoc(doc(anonDb(), 'events/evt1/cancelamentos/n1_alice')))
    await assertSucceeds(getDoc(doc(dbOf('admin'), 'events/evt1/cancelamentos/n1_alice')))
  })

  it('needs seguem o evento: aberto lido por usuário comum', async () => {
    await seedBasico({ needs: { n1: needBase(), n2: needBase({ nome: 'Leite' }) } })
    await assertSucceeds(getDoc(doc(dbOf(USERS.bob.uid as 'bob'), needPath('n2'))))
  })
})
