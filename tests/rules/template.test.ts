import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Timestamp, collection, doc, getDocs, setDoc } from 'firebase/firestore'
import { criarEventoHalloween, publicarEvento } from '@/lib/eventos'
import { HALLOWEEN_NEEDS } from '@/templates/halloween'
import { anonDb, dbOf, resetEnv, seed, setupEnv, teardownEnv } from './harness'
import { assertFails } from './ops'

beforeAll(setupEnv)
afterAll(teardownEnv)
beforeEach(resetEnv)

const comoAdmin = () =>
  seed(async (db) => {
    await setDoc(doc(db, 'admins/admin'), { criadoEm: Timestamp.now() })
  })

describe('template Halloween contra as rules', () => {
  it('admin cria evento (rascunho) + needs em lotes e publica', async () => {
    await comoAdmin()
    const id = await criarEventoHalloween(dbOf('admin'))
    const needs = await getDocs(collection(dbOf('admin'), 'events', id, 'needs'))
    expect(needs.size).toBe(HALLOWEEN_NEEDS.length)
    // público não vê rascunho
    await assertFails(getDocs(collection(anonDb(), 'events', id, 'needs')))
    await publicarEvento(dbOf('admin'), id)
    const publico = await getDocs(collection(anonDb(), 'events', id, 'needs'))
    expect(publico.size).toBe(HALLOWEEN_NEEDS.length)
  })

  it('não-admin não consegue criar o evento', async () => {
    await assertFails(criarEventoHalloween(dbOf('alice')))
  })
})
