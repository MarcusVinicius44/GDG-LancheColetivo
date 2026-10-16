import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { doc, updateDoc, Timestamp } from 'firebase/firestore'
import {
  DAY,
  EVENTOS,
  dbOf,
  needBase,
  needComOpcoes,
  nowMs,
  resetEnv,
  seedBasico,
  setupEnv,
  teardownEnv,
  ts,
} from './harness'
import { assertFails, assertSucceeds, criar, seedPledge } from './ops'

beforeAll(setupEnv)
afterAll(teardownEnv)
beforeEach(resetEnv)

const SUCOS = ['Uva', 'Morango', 'Abacaxi', 'Laranja']
const REFRI = ['Coca', 'Guaraná Antarctica', 'Fanta']

describe('D. Criar pledge', () => {
  it('caminho feliz (pledge+need+participant)', async () => {
    await seedBasico()
    await assertSucceeds(criar('alice', 'n1', 2))
  })

  it('needId inexistente negado', async () => {
    await seedBasico()
    await assertFails(criar('alice', 'nX', 1))
  })

  it('uid ≠ auth negado', async () => {
    await seedBasico()
    await assertFails(criar('alice', 'n1', 1, { mutate: (c) => ((c.pledge as any).uid = 'bob') }))
  })

  it('id do doc errado (pledge de outro uid no id) negado', async () => {
    await seedBasico()
    // pledge id = n1_bob escrito por alice
    const { doc: d, writeBatch, serverTimestamp } = await import('firebase/firestore')
    const db = dbOf('alice')
    const b = writeBatch(db)
    b.set(d(db, 'events/evt1/pledges/n1_bob'), {
      needId: 'n1', uid: 'alice', qty: 1, opcao: null, textoOutro: null,
      primeiroNome: 'Alice', devolverAoFinal: false,
      criadoEm: serverTimestamp(), atualizadoEm: serverTimestamp(),
    })
    b.update(d(db, 'events/evt1/needs/n1'), { reservado: 1, reservadoPorOpcao: {}, ultimoUid: 'bob' })
    b.set(d(db, 'events/evt1/participants/alice'), { ativas: 1, ultimoNeedId: 'n1' })
    await assertFails(b.commit())
  })

  it('need sem atualizar (contador não bate) negado', async () => {
    await seedBasico()
    await assertFails(criar('alice', 'n1', 1, { omit: ['need'] }))
  })

  it('need atualizado sem pledge negado', async () => {
    await seedBasico()
    await assertFails(criar('alice', 'n1', 1, { omit: ['pledge'] }))
  })

  it('delta errado (+2 com qty 1) negado', async () => {
    await seedBasico()
    await assertFails(criar('alice', 'n1', 1, { mutate: (c) => ((c.need as any).reservado = 2) }))
  })

  it.each([
    ['0', 0],
    ['negativa', -1],
    ['fracionária', 1.5],
    ['string', '2' as unknown as number],
    ['abaixo do min', 1],
    ['acima do max', 5],
  ])('qty %s negada', async (nome, qty) => {
    await seedBasico({ needs: { n1: needBase({ minPorPessoa: nome === 'abaixo do min' ? 2 : 1 }) } })
    await assertFails(
      criar('alice', 'n1', qty as number, {
        mutate: (c) => {
          ;(c.need as any).reservado = typeof qty === 'number' ? qty : 2
        },
      }),
    )
  })

  it('estouro de meta negado', async () => {
    await seedBasico({ needs: { n1: needBase({ meta: 3, maxPorPessoa: 5 }) } })
    await seedPledge('bob', 'n1', 2)
    await assertFails(criar('alice', 'n1', 2))
  })

  it('última unidade: qty 1 ok, qty 2 negado', async () => {
    await seedBasico({ needs: { n1: needBase({ meta: 3, maxPorPessoa: 5 }) } })
    await seedPledge('bob', 'n1', 2)
    await assertFails(criar('alice', 'n1', 2))
    await assertSucceeds(criar('alice', 'n1', 1))
  })

  it('opção fora da lista negada', async () => {
    await seedBasico({ needs: { n1: needComOpcoes(SUCOS) } })
    await assertFails(criar('alice', 'n1', 1, { opcao: 'Caju' }))
  })

  it('sem opção quando há opções negado', async () => {
    await seedBasico({ needs: { n1: needComOpcoes(SUCOS) } })
    await assertFails(criar('alice', 'n1', 1))
  })

  it('opção válida ok', async () => {
    await seedBasico({ needs: { n1: needComOpcoes(SUCOS) } })
    await assertSucceeds(criar('alice', 'n1', 1, { opcao: 'Uva' }))
  })

  it('opcao + textoOutro juntos negado', async () => {
    await seedBasico({ needs: { n1: needComOpcoes(SUCOS, { permiteOutro: true }) } })
    await assertFails(criar('alice', 'n1', 1, { opcao: 'Uva', textoOutro: 'Caju' }))
  })

  it('textoOutro sem permiteOutro (com opções) negado', async () => {
    await seedBasico({ needs: { n1: needComOpcoes(SUCOS) } })
    await assertFails(criar('alice', 'n1', 1, { textoOutro: 'Caju' }))
  })

  it('textoOutro sem permiteOutro e sem opções negado', async () => {
    await seedBasico()
    await assertFails(criar('alice', 'n1', 1, { textoOutro: 'qualquer' }))
  })

  it('textoOutro com 41 chars negado, 40 ok', async () => {
    await seedBasico({ needs: { n1: needBase({ permiteOutro: true }) } })
    await assertFails(criar('alice', 'n1', 1, { textoOutro: 'x'.repeat(41) }))
    await assertSucceeds(criar('bob', 'n1', 1, { textoOutro: 'x'.repeat(40) }))
  })

  it('permiteOutro sem opções: textoOutro opcional (com e sem)', async () => {
    await seedBasico({ needs: { n1: needBase({ permiteOutro: true }) } })
    await assertSucceeds(criar('alice', 'n1', 1))
    await assertSucceeds(criar('bob', 'n1', 1, { textoOutro: 'coxinha' }))
  })

  it.each([
    ['guarana antarctica'],
    ['GUARANÁ ANTARCTICA'],
    ['  Guaraná Antarctica  '],
  ])('textoOutro "%s" ∈ opcoesNorm negado', async (t) => {
    await seedBasico({
      needs: { n1: needComOpcoes(REFRI, { meta: 10, permiteOutro: true }) },
    })
    await assertFails(criar('alice', 'n1', 1, { textoOutro: t }))
  })

  it('textoOutro realmente novo ok', async () => {
    await seedBasico({
      needs: { n1: needComOpcoes(REFRI, { meta: 10, permiteOutro: true }) },
    })
    await assertSucceeds(criar('alice', 'n1', 1, { textoOutro: 'Sprite' }))
  })

  it('maxPorOpcao: no limite ok, +1 negado', async () => {
    await seedBasico({ needs: { n1: needComOpcoes(SUCOS, { maxPorPessoa: 4 }) } })
    await seedPledge('bob', 'n1', 3, { opcao: 'Uva' })
    await assertSucceeds(criar('alice', 'n1', 1, { opcao: 'Uva' }))
    await assertFails(criar('carol', 'n1', 1, { opcao: 'Uva' }))
  })

  it('contador com delta 0 e pledge inalterada negado', async () => {
    await seedBasico()
    await seedPledge('alice', 'n1', 1)
    await assertFails(
      updateDoc(doc(dbOf('bob'), 'events/evt1/needs/n1'), {
        reservado: 1,
        reservadoPorOpcao: {},
        ultimoUid: 'alice',
      }),
    )
  })

  it('contadores por opção errados negado', async () => {
    await seedBasico({ needs: { n1: needComOpcoes(SUCOS) } })
    await assertFails(
      criar('alice', 'n1', 1, {
        opcao: 'Uva',
        mutate: (c) => ((c.need as any).reservadoPorOpcao.Uva = 2),
      }),
    )
  })

  it('terceira chave tocada negado', async () => {
    await seedBasico({ needs: { n1: needComOpcoes(SUCOS) } })
    await assertFails(
      criar('alice', 'n1', 1, {
        opcao: 'Uva',
        mutate: (c) => ((c.need as any).reservadoPorOpcao.Morango = 1),
      }),
    )
  })

  it('maxNecessidadesPorPessoa: 2 ok, 3ª negada', async () => {
    await seedBasico({
      needs: { n1: needBase(), n2: needBase({ nome: 'B' }), n3: needBase({ nome: 'C' }) },
    })
    await assertSucceeds(criar('alice', 'n1', 1))
    await assertSucceeds(criar('alice', 'n2', 1))
    await assertFails(criar('alice', 'n3', 1))
  })

  it('participant.ativas errado negado', async () => {
    await seedBasico()
    await assertFails(criar('alice', 'n1', 1, { mutate: (c) => ((c.participant as any).ativas = 5) }))
  })

  it('sem participant negado', async () => {
    await seedBasico()
    await assertFails(criar('alice', 'n1', 1, { omit: ['participant'] }))
  })

  it('timestamps ≠ request.time negado', async () => {
    await seedBasico()
    await assertFails(
      criar('alice', 'n1', 1, {
        mutate: (c) => ((c.pledge as any).criadoEm = Timestamp.fromMillis(nowMs() - DAY)),
      }),
    )
    await assertFails(
      criar('alice', 'n1', 1, {
        mutate: (c) => ((c.pledge as any).atualizadoEm = Timestamp.fromMillis(nowMs() + DAY)),
      }),
    )
  })

  it('campos extras negado', async () => {
    await seedBasico()
    await assertFails(criar('alice', 'n1', 1, { mutate: (c) => ((c.pledge as any).vip = true) }))
  })

  it('primeiroNome forjado negado', async () => {
    await seedBasico()
    await assertFails(criar('alice', 'n1', 1, { primeiroNome: 'Admin' }))
  })

  it('bloqueado negado', async () => {
    await seedBasico()
    await assertFails(criar('bloqueada', 'n1', 1))
  })

  it('evento rascunho/fechado negado', async () => {
    await seedBasico({ evento: EVENTOS.rascunho() })
    await assertFails(criar('alice', 'n1', 1))
    await resetEnv()
    await seedBasico({ evento: EVENTOS.fechado() })
    await assertFails(criar('alice', 'n1', 1))
  })

  it('após o prazo negado', async () => {
    await seedBasico({ evento: EVENTOS.prazoPassado() })
    await assertFails(criar('alice', 'n1', 1))
  })

  it('após "Reabrir até…" criar volta a ser permitido', async () => {
    await seedBasico({ evento: EVENTOS.prazoPassado() })
    await assertFails(criar('alice', 'n1', 1))
    await assertSucceeds(
      updateDoc(doc(dbOf('admin'), 'events/evt1'), {
        prazoContribuicoes: ts(nowMs() + DAY),
      }),
    )
    await assertSucceeds(criar('alice', 'n1', 1))
  })
})
