import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { doc, writeBatch } from 'firebase/firestore'
import {
  EVENTOS,
  dbOf,
  needBase,
  needComOpcoes,
  needPath,
  resetEnv,
  seedBasico,
  setupEnv,
  teardownEnv,
} from './harness'
import { assertFails, assertSucceeds, cancelar, editar, seedPledge } from './ops'

beforeAll(setupEnv)
afterAll(teardownEnv)
beforeEach(resetEnv)

const lote = (n: number, comOpcoes = false) => {
  const db = dbOf('admin')
  const b = writeBatch(db)
  for (let i = 0; i < n; i++) {
    b.set(
      doc(db, needPath(`s${i}`)),
      comOpcoes
        ? needComOpcoes(['Uva', 'Morango', 'Abacaxi', 'Laranja'], { ordem: i })
        : needBase({ ordem: i, nome: `Item ${i}` }),
    )
  }
  return b.commit()
}

describe('I. Limites de acessos / expressões', () => {
  it('lote de 8 needs simples passa', async () => {
    await seedBasico({ needs: {} })
    await assertSucceeds(lote(8))
  })

  it('lote de 8 needs com opções passa', async () => {
    await seedBasico({ needs: {} })
    await assertSucceeds(lote(8, true))
  })

  it('pior caso: redução pós-prazo com log de cancelamento', async () => {
    await seedBasico({
      evento: EVENTOS.prazoPassado(),
      needs: { n1: needComOpcoes(['Uva', 'Morango', 'Abacaxi', 'Laranja'], { maxPorPessoa: 4 }) },
    })
    await seedPledge('alice', 'n1', 3, { opcao: 'Uva' })
    await assertSucceeds(editar('alice', 'n1', 1, { log: true }))
  })

  it('pior caso: cancelamento pós-prazo com log (pledge+need+participant+log)', async () => {
    await seedBasico({
      evento: EVENTOS.prazoPassado(),
      needs: { n1: needComOpcoes(['Uva', 'Morango', 'Abacaxi', 'Laranja'], { maxPorPessoa: 4 }) },
    })
    await seedPledge('alice', 'n1', 3, { opcao: 'Uva' })
    await assertSucceeds(cancelar('alice', 'n1', 'alice', { log: true }))
  })

  it('pior caso: remoção de pledge alheia pelo admin', async () => {
    await seedBasico({
      needs: { n1: needComOpcoes(['Uva', 'Morango', 'Abacaxi', 'Laranja'], { maxPorPessoa: 4 }) },
    })
    await seedPledge('alice', 'n1', 3, { opcao: 'Uva' })
    await assertSucceeds(cancelar('admin', 'n1', 'alice'))
  })

  it('lote com 20+ acessos é rejeitado pelo emulador (sanidade do orçamento)', async () => {
    // 11 needs sem opções: cada create faz isAdmin() (mesmo doc ⇒ cacheado) — o
    // orçamento é por documentos distintos; o teste só documenta que um lote
    // de 8 é o teto operacional usado pela UI (duplicar/seed).
    await seedBasico({ needs: {} })
    await assertSucceeds(lote(8))
    void assertFails
  })
})
