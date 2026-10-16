import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { deleteDoc, doc, setDoc, updateDoc } from 'firebase/firestore'
import {
  DAY,
  EID,
  dbOf,
  eventoBase,
  needBase,
  needComOpcoes,
  needPath,
  nowMs,
  resetEnv,
  seedBasico,
  setupEnv,
  teardownEnv,
  ts,
} from './harness'
import { assertFails, assertSucceeds, seedPledge } from './ops'

beforeAll(setupEnv)
afterAll(teardownEnv)
beforeEach(resetEnv)

const admin = () => dbOf('admin')
const novaNeed = (nid: string, data: Record<string, unknown>, k: 'admin' | 'alice' = 'admin') =>
  setDoc(doc(dbOf(k), needPath(nid)), data)
const patchNeed = (nid: string, data: Record<string, unknown>, k: 'admin' | 'alice' = 'admin') =>
  updateDoc(doc(dbOf(k), needPath(nid)), data)

const doze = [
  'Á', 'É', 'Í', 'Ó', 'Ú', 'Ç', 'Ã', 'Õ', 'Â', 'Ê', 'Ô', 'À',
].map((l) => `Opção ${l}`)

describe('C. Evento / Need (admin)', () => {
  it('não-admin cria evento/need negado', async () => {
    await seedBasico()
    await assertFails(setDoc(doc(dbOf('alice'), 'events/novo'), eventoBase()))
    await assertFails(novaNeed('n9', needBase(), 'alice'))
  })

  it('admin cria evento e need válidos', async () => {
    await seedBasico()
    await assertSucceeds(setDoc(doc(admin(), 'events/novo'), eventoBase({ status: 'rascunho' })))
    await assertSucceeds(novaNeed('n9', needBase()))
  })

  it.each([
    ['reservado≠0', { reservado: 1 }],
    ['reservadoPorOpcao não zerado', { opcoes: ['A'], opcoesNorm: ['a'], reservadoPorOpcao: { A: 1 } }],
    ['ultimoUid preenchido', { ultimoUid: 'alice' }],
    ['categoria inválida', { categoria: 'Outra' }],
    ['tag inválida', { tags: ['kosher'] }],
    ['nome gigante', { nome: 'x'.repeat(500) }],
    ['meta string', { meta: '10' }],
    ['meta 0', { meta: 0 }],
    ['meta negativa', { meta: -3 }],
    ['meta fracionária', { meta: 2.5 }],
    ['min>max', { minPorPessoa: 5, maxPorPessoa: 2 }],
    ['campo extra', { vip: true }],
  ])('create need inválida: %s negado', async (_n, over) => {
    await seedBasico()
    await assertFails(novaNeed('n9', needBase(over)))
  })

  it('evento com status/campos inválidos negado', async () => {
    await seedBasico()
    await assertFails(setDoc(doc(admin(), 'events/e2'), eventoBase({ status: 'publicado' })))
    await assertFails(setDoc(doc(admin(), 'events/e3'), eventoBase({ titulo: 'x'.repeat(500) })))
    await assertFails(setDoc(doc(admin(), 'events/e4'), eventoBase({ publicoPlanejado: 'noventa' })))
    await assertFails(
      setDoc(doc(admin(), 'events/e5'), eventoBase({ prazoContribuicoes: ts(nowMs() + 9 * DAY) })),
    ) // prazo > início
  })

  describe('correção 3 (opções × maxPorOpcao ≥ meta)', () => {
    it('create: 2×4=8 < 12 sem permiteOutro negado', async () => {
      await seedBasico()
      await assertFails(novaNeed('n9', needComOpcoes(['A', 'B'], { meta: 12, maxPorOpcao: 4 })))
    })
    it('create: com permiteOutro ok', async () => {
      await seedBasico()
      await assertSucceeds(
        novaNeed('n9', needComOpcoes(['A', 'B'], { meta: 12, maxPorOpcao: 4, permiteOutro: true })),
      )
    })
    it('create: sem maxPorOpcao ok', async () => {
      await seedBasico()
      await assertSucceeds(novaNeed('n9', needComOpcoes(['A', 'B'], { meta: 12, maxPorOpcao: null })))
    })
    it('create: 4×4=16 ≥ 12 ok', async () => {
      await seedBasico()
      await assertSucceeds(novaNeed('n9', needComOpcoes(['A', 'B', 'C', 'D'], { meta: 12 })))
    })
    it('update: baixar maxPorOpcao abaixo do necessário negado', async () => {
      await seedBasico({ needs: { n1: needComOpcoes(['A', 'B', 'C', 'D'], { meta: 12 }) } })
      await assertFails(patchNeed('n1', { maxPorOpcao: 2 }))
      await assertSucceeds(patchNeed('n1', { maxPorOpcao: 3 }))
    })
    it('update: aumentar meta além da capacidade negado', async () => {
      await seedBasico({ needs: { n1: needComOpcoes(['A', 'B', 'C', 'D'], { meta: 12 }) } })
      await assertFails(patchNeed('n1', { meta: 20 }))
    })
  })

  it('meta < reservado negado; meta == reservado ok', async () => {
    await seedBasico({ needs: { n1: needBase({ meta: 10, maxPorPessoa: 5 }) } })
    await seedPledge('alice', 'n1', 4)
    await assertFails(patchNeed('n1', { meta: 3 }))
    await assertSucceeds(patchNeed('n1', { meta: 4 }))
  })

  it('admin alterando reservado/reservadoPorOpcao direto negado', async () => {
    await seedBasico()
    await assertFails(patchNeed('n1', { reservado: 5 }))
    await assertFails(patchNeed('n1', { reservadoPorOpcao: { X: 1 } }))
  })

  it('admin config + contador no mesmo write negado', async () => {
    await seedBasico()
    await assertFails(patchNeed('n1', { nome: 'Novo nome', reservado: 0, ultimoUid: 'admin' }))
  })

  it('remover opção com reservado>0 negado; acrescentar ok', async () => {
    await seedBasico({ needs: { n1: needComOpcoes(['Uva', 'Morango', 'Abacaxi', 'Laranja']) } })
    await seedPledge('alice', 'n1', 2, { opcao: 'Uva' })
    await assertFails(
      patchNeed('n1', {
        opcoes: ['Uva', 'Morango', 'Abacaxi'],
        opcoesNorm: ['uva', 'morango', 'abacaxi'],
        reservadoPorOpcao: { Uva: 2, Morango: 0, Abacaxi: 0 },
      }),
    )
    await assertSucceeds(
      patchNeed('n1', {
        opcoes: ['Uva', 'Morango', 'Abacaxi', 'Laranja', 'Caju'],
        opcoesNorm: ['uva', 'morango', 'abacaxi', 'laranja', 'caju'],
        reservadoPorOpcao: { Uva: 2, Morango: 0, Abacaxi: 0, Laranja: 0, Caju: 0 },
      }),
    )
  })

  it('delete need com reservado>0 negado, ==0 ok', async () => {
    await seedBasico({ needs: { n1: needBase({ maxPorPessoa: 5 }), n2: needBase() } })
    await seedPledge('alice', 'n1', 1)
    await assertFails(deleteDoc(doc(admin(), needPath('n1'))))
    await assertSucceeds(deleteDoc(doc(admin(), needPath('n2'))))
  })

  it('evento não pode ser apagado', async () => {
    await seedBasico()
    await assertFails(deleteDoc(doc(admin(), `events/${EID}`)))
  })

  it('edição de config não zera contadores', async () => {
    await seedBasico({ needs: { n1: needBase({ maxPorPessoa: 5 }) } })
    await seedPledge('alice', 'n1', 2)
    await assertSucceeds(patchNeed('n1', { nome: 'Refri 2L', nota: 'gelado' }))
    await assertFails(patchNeed('n1', { nome: 'Refri', reservado: 0 }))
  })

  describe('limite de expressões (12 opções acentuadas)', () => {
    const opcoesNorm = doze.map((o) =>
      o.toLowerCase().replace(/[áàâãä]/g, 'a').replace(/[éèêë]/g, 'e').replace(/[íìîï]/g, 'i')
        .replace(/[óòôõö]/g, 'o').replace(/[úùûü]/g, 'u').replace(/ç/g, 'c'),
    )
    const zeros = (os: string[]) => Object.fromEntries(os.map((o) => [o, 0]))

    it('create com 12 passa', async () => {
      await seedBasico()
      await assertSucceeds(
        novaNeed('n9', needBase({
          meta: 12, opcoes: doze, opcoesNorm, maxPorOpcao: 4, reservadoPorOpcao: zeros(doze),
        })),
      )
    })

    it('update com 12 passa', async () => {
      await seedBasico({ needs: { n1: needBase({ meta: 12 }) } })
      await assertSucceeds(
        patchNeed('n1', { opcoes: doze, opcoesNorm, maxPorOpcao: 4, reservadoPorOpcao: zeros(doze) }),
      )
    })

    it('13 opções negado', async () => {
      await seedBasico()
      const t = [...doze, 'Opção Z']
      await assertFails(
        novaNeed('n9', needBase({
          meta: 12, opcoes: t, opcoesNorm: [...opcoesNorm, 'opcao z'], maxPorOpcao: 4,
          reservadoPorOpcao: zeros(t),
        })),
      )
    })
  })

  it('opcoesNorm divergente de norm(opcoes) negado', async () => {
    await seedBasico()
    await assertFails(
      novaNeed('n9', needBase({
        meta: 4, opcoes: ['Guaraná'], opcoesNorm: ['guarana!'], reservadoPorOpcao: { Guaraná: 0 },
      })),
    )
    await assertFails(
      novaNeed('n9', needBase({
        meta: 4, opcoes: ['Guaraná', 'Coca'], opcoesNorm: ['guarana'], reservadoPorOpcao: { Guaraná: 0, Coca: 0 },
      })),
    )
  })

  describe('prazo ("Reabrir até…")', () => {
    it('estender ≤ início ok', async () => {
      await seedBasico({ evento: eventoBase({ prazoContribuicoes: ts(nowMs() + DAY) }) })
      await assertSucceeds(updateDoc(doc(admin(), `events/${EID}`), { prazoContribuicoes: ts(nowMs() + 4 * DAY) }))
    })
    it('estender > início negado', async () => {
      await seedBasico()
      await assertFails(updateDoc(doc(admin(), `events/${EID}`), { prazoContribuicoes: ts(nowMs() + 9 * DAY) }))
    })
    it('não-admin negado', async () => {
      await seedBasico()
      await assertFails(updateDoc(doc(dbOf('alice'), `events/${EID}`), { prazoContribuicoes: ts(nowMs() + 4 * DAY) }))
    })
  })
})
