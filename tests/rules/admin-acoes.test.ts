import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Timestamp, collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore'
import { bloquearUsuario, desbloquearUsuario, reabrirPrazo } from '@/lib/eventos'
import { cancelarPledge, salvarPledge } from '@/lib/pledges'
import { DAY, EVENTOS, USERS, anonDb, dbOf, eventoBase, needBase, nowMs, resetEnv, seed, seedBasico, setupEnv, teardownEnv, ts } from './harness'
import { assertFails, assertSucceeds, seedPledge } from './ops'

beforeAll(setupEnv)
afterAll(teardownEnv)
beforeEach(resetEnv)

const ator = (k: keyof typeof USERS) => ({ uid: USERS[k].uid, nome: (USERS[k].claims as { name?: string }).name ?? null })

describe('ações e consultas do painel admin', () => {
  it('reabrirPrazo: permite novas contribuições; passar do início é negado; não-admin negado', async () => {
    await seedBasico({ evento: EVENTOS.prazoPassado() })
    const dep = () => salvarPledge(dbOf('alice'), 'evt1', 'n1', ator('alice'), { qty: 1, opcao: null, textoOutro: null, devolverAoFinal: false })
    await expect(dep()).rejects.toMatchObject({ code: 'prazo' })
    await assertFails(reabrirPrazo(dbOf('alice'), 'evt1', new Date(nowMs() + DAY)))
    await assertFails(reabrirPrazo(dbOf('admin'), 'evt1', new Date(nowMs() + 30 * DAY)))
    await assertSucceeds(reabrirPrazo(dbOf('admin'), 'evt1', new Date(nowMs() + DAY)))
    await dep()
  })

  it('reabrir mantém os logs de cancelamento tardio', async () => {
    await seedBasico({ evento: EVENTOS.prazoPassado(), needs: { n1: needBase({ maxPorPessoa: 5 }) } })
    await seedPledge('alice', 'n1', 3)
    await cancelarPledge(dbOf('alice'), 'evt1', 'n1', ator('alice'))
    await reabrirPrazo(dbOf('admin'), 'evt1', new Date(nowMs() + DAY))
    const log = await getDoc(doc(dbOf('admin'), 'events/evt1/cancelamentos/n1_alice'))
    expect(log.data()).toMatchObject({ qty: 3 })
  })

  it('bloquear/desbloquear: bloqueada não cria, depois do desbloqueio cria', async () => {
    await seedBasico({ bloqueados: [] })
    const dep = () => salvarPledge(dbOf('bob'), 'evt1', 'n1', ator('bob'), { qty: 1, opcao: null, textoOutro: null, devolverAoFinal: false })
    await assertFails(bloquearUsuario(dbOf('bob'), 'bob', 'x'))
    await bloquearUsuario(dbOf('admin'), 'bob', '  spam  ')
    expect((await getDoc(doc(dbOf('admin'), 'blocked/bob'))).data()).toMatchObject({ motivo: 'spam' })
    await expect(dep()).rejects.toMatchObject({ code: 'bloqueado' })
    await assertFails(desbloquearUsuario(dbOf('bob'), 'bob'))
    await desbloquearUsuario(dbOf('admin'), 'bob')
    await dep()
  })

  it('admin lista users, blocked e cancelamentos; usuário comum e anônimo não', async () => {
    await seedBasico({ evento: eventoBase() })
    await seed(async (db) => {
      await setDoc(doc(db, 'users/alice'), { nome: 'Alice Souza', primeiroNome: 'Alice', email: 'alice@x.com', ultimoLogin: Timestamp.now() })
      await setDoc(doc(db, 'events/evt1/cancelamentos/n1_alice'), { needId: 'n1', uid: 'alice', primeiroNome: 'Alice', qty: 2, em: ts(nowMs()) })
    })
    const admin = dbOf('admin')
    expect((await getDocs(collection(admin, 'users'))).size).toBe(1)
    expect((await getDocs(collection(admin, 'blocked'))).size).toBe(1)
    expect((await getDocs(collection(admin, 'events/evt1/cancelamentos'))).size).toBe(1)
    await assertFails(getDocs(collection(dbOf('alice'), 'users')))
    await assertFails(getDocs(collection(dbOf('alice'), 'blocked')))
    await assertFails(getDocs(collection(dbOf('alice'), 'events/evt1/cancelamentos')))
    await assertFails(getDocs(collection(anonDb(), 'users')))
  })
})
