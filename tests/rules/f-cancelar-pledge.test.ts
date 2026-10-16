import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { deleteDoc, doc } from 'firebase/firestore'
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
import { assertFails, assertSucceeds, cancelar, readRaw, seedPledge } from './ops'

beforeAll(setupEnv)
afterAll(teardownEnv)
beforeEach(resetEnv)

const comPledge = async (evento = EVENTOS.aberto()) => {
  await seedBasico({ evento, needs: { n1: needBase({ meta: 10, maxPorPessoa: 5 }) } })
  await seedPledge('alice', 'n1', 2)
}

describe('F. Cancelar', () => {
  it('feliz (delete + need−qty + participant−1)', async () => {
    await comPledge()
    await assertSucceeds(cancelar('alice', 'n1'))
  })

  it('sem decrementar negado', async () => {
    await comPledge()
    await assertFails(cancelar('alice', 'n1', 'alice', { omit: ['need'] }))
  })

  it('decrementar sem deletar negado', async () => {
    await comPledge()
    await assertFails(cancelar('alice', 'n1', 'alice', { omit: ['pledge'] }))
  })

  it('delete cru da pledge sem contador negado', async () => {
    await comPledge()
    await assertFails(deleteDoc(doc(dbOf('alice'), pledgePath('n1', 'alice'))))
  })

  it('pledge alheia negada', async () => {
    await comPledge()
    await assertFails(cancelar('bob', 'n1', 'alice'))
  })

  it('participant sem decremento negado', async () => {
    await comPledge()
    await assertFails(cancelar('alice', 'n1', 'alice', { omit: ['participant'] }))
  })

  describe('pós-prazo', () => {
    it('com log ok', async () => {
      await comPledge(EVENTOS.prazoPassado())
      await assertSucceeds(cancelar('alice', 'n1', 'alice', { log: true }))
    })

    it('sem log negado', async () => {
      await comPledge(EVENTOS.prazoPassado())
      await assertFails(cancelar('alice', 'n1'))
    })

    it('log com qty errada negado', async () => {
      await comPledge(EVENTOS.prazoPassado())
      await assertFails(
        cancelar('alice', 'n1', 'alice', {
          log: true,
          mutate: (c) => ((c.cancelamento as any).qty = 99),
        }),
      )
    })

    it('dois cancelamentos tardios acumulam', async () => {
      await comPledge(EVENTOS.prazoPassado())
      await assertSucceeds(cancelar('alice', 'n1', 'alice', { log: true }))
      await seedPledge('alice', 'n1', 3)
      await assertSucceeds(cancelar('alice', 'n1', 'alice', { log: true }))
      const log = await readRaw('events/evt1/cancelamentos/n1_alice')
      if (log?.qty !== 5) throw new Error(`qty acumulada esperada 5, veio ${log?.qty}`)
    })
  })

  it('pós-início negado', async () => {
    await comPledge(EVENTOS.iniciado())
    await assertFails(cancelar('alice', 'n1', 'alice', { log: true }))
  })

  it('ativas nunca < 0', async () => {
    await comPledge()
    await assertFails(
      cancelar('alice', 'n1', 'alice', {
        mutate: (c) => ((c.participant as any).ativas = -1),
      }),
    )
  })
})
