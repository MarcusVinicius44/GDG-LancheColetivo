import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { deleteDoc, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import {
  EVENTOS,
  dbOf,
  needBase,
  pledgePath,
  resetEnv,
  seedBasico,
  setupEnv,
  teardownEnv,
} from './harness'
import { assertFails, assertSucceeds, cancelar, criar, seedPledge } from './ops'

beforeAll(setupEnv)
afterAll(teardownEnv)
beforeEach(resetEnv)

const comPledge = async (evento = EVENTOS.aberto()) => {
  await seedBasico({ evento, needs: { n1: needBase({ meta: 10, maxPorPessoa: 5 }) } })
  await seedPledge('alice', 'n1', 2)
}

describe('H. Admin', () => {
  it('remove pledge alheia (delete + need−qty ultimoUid=dono + participant−1) ok', async () => {
    await comPledge()
    await assertSucceeds(cancelar('admin', 'n1', 'alice'))
  })

  it('remoção sem atualizar contador negada', async () => {
    await comPledge()
    await assertFails(deleteDoc(doc(dbOf('admin'), pledgePath('n1', 'alice'))))
    await assertFails(cancelar('admin', 'n1', 'alice', { omit: ['need', 'participant'] }))
  })

  it('ultimoUid errado negado', async () => {
    await comPledge()
    await assertFails(
      cancelar('admin', 'n1', 'alice', {
        mutate: (c) => ((c.need as any).ultimoUid = 'admin'),
      }),
    )
  })

  it('participant do dono sem decremento negado', async () => {
    await comPledge()
    await assertFails(cancelar('admin', 'n1', 'alice', { omit: ['participant'] }))
  })

  it('admin criar/editar pledge alheia negado', async () => {
    await seedBasico()
    await assertFails(
      setDoc(doc(dbOf('admin'), pledgePath('n1', 'alice')), {
        needId: 'n1', uid: 'alice', qty: 1, opcao: null, textoOutro: null,
        primeiroNome: 'Alice', devolverAoFinal: false,
        criadoEm: serverTimestamp(), atualizadoEm: serverTimestamp(),
      }),
    )
    await seedPledge('alice', 'n1', 2)
    await assertFails(
      updateDoc(doc(dbOf('admin'), pledgePath('n1', 'alice')), {
        qty: 1,
        atualizadoEm: serverTimestamp(),
      }),
    )
  })

  it('admin decrementar need sem deletar pledge negado', async () => {
    await comPledge()
    await assertFails(
      updateDoc(doc(dbOf('admin'), 'events/evt1/needs/n1'), {
        reservado: 0,
        reservadoPorOpcao: {},
        ultimoUid: 'alice',
      }),
    )
  })

  it('admin altera reservado direto negado', async () => {
    await seedBasico()
    await assertFails(updateDoc(doc(dbOf('admin'), 'events/evt1/needs/n1'), { reservado: 3 }))
  })

  it('remoção pós-prazo sem log ok', async () => {
    await comPledge(EVENTOS.prazoPassado())
    await assertSucceeds(cancelar('admin', 'n1', 'alice'))
  })

  it('admin também pode criar a própria pledge (sem atalho)', async () => {
    await seedBasico()
    await assertSucceeds(criar('admin', 'n1', 1))
  })

  it('admin bloqueia/desbloqueia; não-admin negado', async () => {
    await seedBasico()
    await assertSucceeds(
      setDoc(doc(dbOf('admin'), 'blocked/bob'), { motivo: 'spam', em: serverTimestamp() }),
    )
    await assertSucceeds(deleteDoc(doc(dbOf('admin'), 'blocked/bob')))
    await assertFails(
      setDoc(doc(dbOf('alice'), 'blocked/bob'), { motivo: 'x', em: serverTimestamp() }),
    )
    await assertFails(deleteDoc(doc(dbOf('alice'), 'blocked/bloqueada')))
  })
})
