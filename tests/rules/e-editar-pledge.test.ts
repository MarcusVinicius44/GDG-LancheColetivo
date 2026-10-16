import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import {
  EVENTOS,
  dbOf,
  needBase,
  needComOpcoes,
  pledgePath,
  resetEnv,
  seedBasico,
  setupEnv,
  teardownEnv,
} from './harness'
import { assertFails, assertSucceeds, editar, seedPledge } from './ops'

beforeAll(setupEnv)
afterAll(teardownEnv)
beforeEach(resetEnv)

const SUCOS = ['Uva', 'Morango', 'Abacaxi', 'Laranja']
const comPledge = async (evento = EVENTOS.aberto()) => {
  await seedBasico({ evento, needs: { n1: needBase({ meta: 10, maxPorPessoa: 5 }) } })
  await seedPledge('alice', 'n1', 2)
}

describe('E. Editar pledge', () => {
  it('aumentar qty (+delta) ok', async () => {
    await comPledge()
    await assertSucceeds(editar('alice', 'n1', 4))
  })

  it('reduzir ok', async () => {
    await comPledge()
    await assertSucceeds(editar('alice', 'n1', 1))
  })

  it('editar qty sem mexer no contador (burla) negado', async () => {
    await comPledge()
    await assertFails(editar('alice', 'n1', 4, { omit: ['need'] }))
  })

  it('contador ± sem pledge negado', async () => {
    await comPledge()
    await assertFails(editar('alice', 'n1', 4, { omit: ['pledge'] }))
    await assertFails(editar('alice', 'n1', 1, { omit: ['pledge'] }))
  })

  it('aumento acima da meta negado', async () => {
    await seedBasico({ needs: { n1: needBase({ meta: 3, maxPorPessoa: 5 }) } })
    await seedPledge('alice', 'n1', 2)
    await assertFails(editar('alice', 'n1', 4))
  })

  it('trocar sabor (2 chaves) ok; tocando 3ª chave negado', async () => {
    await seedBasico({ needs: { n1: needComOpcoes(SUCOS) } })
    await seedPledge('alice', 'n1', 2, { opcao: 'Uva' })
    await assertFails(
      editar('alice', 'n1', 2, {
        opcao: 'Morango',
        mutate: (c) => ((c.need as any).reservadoPorOpcao.Abacaxi = 1),
      }),
    )
    await assertSucceeds(editar('alice', 'n1', 2, { opcao: 'Morango' }))
  })

  it('pledge alheia negada', async () => {
    await comPledge()
    await assertFails(
      updateDoc(doc(dbOf('bob'), pledgePath('n1', 'alice')), {
        qty: 1,
        atualizadoEm: serverTimestamp(),
      }),
    )
  })

  it.each([
    ['uid', { uid: 'bob' }],
    ['needId', { needId: 'n2' }],
    ['primeiroNome', { primeiroNome: 'Outro' }],
    ['criadoEm', { criadoEm: serverTimestamp() }],
  ])('alterar %s negado', async (_n, patch) => {
    await comPledge()
    await assertFails(
      updateDoc(doc(dbOf('alice'), pledgePath('n1', 'alice')), {
        ...patch,
        atualizadoEm: serverTimestamp(),
      }),
    )
  })

  it('só devolverAoFinal (sem escrever need) ok', async () => {
    await comPledge()
    await assertSucceeds(
      updateDoc(doc(dbOf('alice'), pledgePath('n1', 'alice')), {
        devolverAoFinal: true,
        atualizadoEm: serverTimestamp(),
      }),
    )
  })

  describe('pós-prazo', () => {
    it('aumentar negado', async () => {
      await comPledge(EVENTOS.prazoPassado())
      await assertFails(editar('alice', 'n1', 4))
    })

    it('trocar opção negado', async () => {
      await seedBasico({
        evento: EVENTOS.prazoPassado(),
        needs: { n1: needComOpcoes(SUCOS) },
      })
      await seedPledge('alice', 'n1', 2, { opcao: 'Uva' })
      await assertFails(editar('alice', 'n1', 2, { opcao: 'Morango', log: true }))
    })

    it('reduzir com log ok; sem log negado', async () => {
      await comPledge(EVENTOS.prazoPassado())
      await assertFails(editar('alice', 'n1', 1))
      await assertSucceeds(editar('alice', 'n1', 1, { log: true }))
    })

    it('devolverAoFinal ok', async () => {
      await comPledge(EVENTOS.prazoPassado())
      await assertSucceeds(
        updateDoc(doc(dbOf('alice'), pledgePath('n1', 'alice')), {
          devolverAoFinal: true,
          atualizadoEm: serverTimestamp(),
        }),
      )
    })

    it('reduzir abaixo do min negado', async () => {
      await seedBasico({
        evento: EVENTOS.prazoPassado(),
        needs: { n1: needBase({ minPorPessoa: 2, meta: 10, maxPorPessoa: 5 }) },
      })
      await seedPledge('alice', 'n1', 3)
      await assertFails(editar('alice', 'n1', 1, { log: true }))
      await assertSucceeds(editar('alice', 'n1', 2, { log: true }))
    })
  })

  it('pós-início negado (reduzir, com log)', async () => {
    await comPledge(EVENTOS.iniciado())
    await assertFails(editar('alice', 'n1', 1, { log: true }))
  })

  it('evento fechado negado', async () => {
    await comPledge(EVENTOS.fechado())
    await assertFails(editar('alice', 'n1', 1))
  })

  it('bloqueado: aumentar negado, reduzir ok', async () => {
    await seedBasico({ needs: { n1: needBase({ meta: 10, maxPorPessoa: 5 }) } })
    await seedPledge('bloqueada', 'n1', 2)
    await assertFails(editar('bloqueada', 'n1', 4))
    await assertSucceeds(editar('bloqueada', 'n1', 1))
  })
})
