import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { cancelarPledge, salvarPledge } from '@/lib/pledges'
import {
  EVENTOS,
  USERS,
  dbOf,
  needBase,
  needComOpcoes,
  resetEnv,
  seedBasico,
  setupEnv,
  teardownEnv,
  type UserKey,
} from './harness'
import { readRaw, seedPledge } from './ops'

beforeAll(setupEnv)
afterAll(teardownEnv)
beforeEach(resetEnv)

const ator = (k: UserKey) => ({ uid: USERS[k].uid, nome: (USERS[k].claims as { name?: string }).name ?? null })
const salvar = (
  k: UserKey,
  qty: number,
  o: { opcao?: string; textoOutro?: string; devolver?: boolean; bloqueado?: boolean } = {},
) =>
  salvarPledge(
    dbOf(k),
    'evt1',
    'n1',
    ator(k),
    { qty, opcao: o.opcao ?? null, textoOutro: o.textoOutro ?? null, devolverAoFinal: o.devolver ?? false },
    { bloqueado: o.bloqueado },
  )
const cancelar = (k: UserKey, dono?: UserKey) =>
  cancelarPledge(dbOf(k), 'evt1', 'n1', ator(k), dono ? { donoUid: USERS[dono].uid } : {})
const codigo = async (p: Promise<unknown>) => {
  try {
    await p
  } catch (e) {
    return (e as { code?: string }).code
  }
  return null
}

describe('lib/pledges.ts contra as rules (caminho real do app)', () => {
  it('criar → editar (sabor/qty) → só detalhe → cancelar', async () => {
    await seedBasico({ needs: { n1: needComOpcoes(['Uva', 'Morango', 'Abacaxi', 'Laranja']) } })
    await salvar('alice', 2, { opcao: 'Uva' })
    expect((await readRaw('events/evt1/needs/n1'))?.reservadoPorOpcao.Uva).toBe(2)
    await salvar('alice', 3, { opcao: 'Morango' })
    const n = await readRaw('events/evt1/needs/n1')
    expect(n).toMatchObject({ reservado: 3, reservadoPorOpcao: { Uva: 0, Morango: 3 }, ultimoUid: 'alice' })
    await salvar('alice', 3, { opcao: 'Morango', devolver: true })
    expect((await readRaw('events/evt1/pledges/n1_alice'))?.devolverAoFinal).toBe(true)
    await cancelar('alice')
    expect(await readRaw('events/evt1/pledges/n1_alice')).toBeUndefined()
    expect(await readRaw('events/evt1/needs/n1')).toMatchObject({ reservado: 0 })
    expect(await readRaw('events/evt1/participants/alice')).toMatchObject({ ativas: 0 })
  })

  it('"Outro" com texto livre (sem opções) e edição do texto', async () => {
    await seedBasico({ needs: { n1: needBase({ permiteOutro: true, meta: 100, maxPorPessoa: 50 }) } })
    await salvar('alice', 25, { textoOutro: 'Coxinha' })
    await salvar('alice', 25, { textoOutro: 'Esfiha' })
    expect(await readRaw('events/evt1/pledges/n1_alice')).toMatchObject({ textoOutro: 'Esfiha', qty: 25 })
    expect(await readRaw('events/evt1/needs/n1')).toMatchObject({ reservado: 25 })
  })

  it('esgotado chega com o código certo; Outro livre ainda cabe fora do cap por sabor', async () => {
    await seedBasico({
      needs: {
        n1: needComOpcoes(['Uva', 'Morango', 'Abacaxi', 'Laranja'], {
          meta: 5, maxPorOpcao: 4, maxPorPessoa: 4, permiteOutro: true,
        }),
      },
    })
    await seedPledge('bob', 'n1', 4, { opcao: 'Uva' })
    expect(await codigo(salvar('alice', 2, { opcao: 'Morango' }))).toBe('esgotado')
    expect(await codigo(salvar('alice', 1, { textoOutro: 'Caju' }))).toBeNull()
  })

  it('prazo vencido: só reduzir (com log) — e o log acumula', async () => {
    await seedBasico({ evento: EVENTOS.prazoPassado(), needs: { n1: needBase({ meta: 10, maxPorPessoa: 5 }) } })
    await seedPledge('alice', 'n1', 4)
    expect(await codigo(salvar('alice', 5))).toBe('prazo')
    await salvar('alice', 3)
    await salvar('alice', 2)
    expect(await readRaw('events/evt1/cancelamentos/n1_alice')).toMatchObject({ qty: 2, uid: 'alice' })
    await cancelar('alice')
    expect(await readRaw('events/evt1/cancelamentos/n1_alice')).toMatchObject({ qty: 4 })
    expect(await readRaw('events/evt1/needs/n1')).toMatchObject({ reservado: 0 })
  })

  it('evento já iniciado: nada muda', async () => {
    await seedBasico({ evento: EVENTOS.iniciado() })
    await seedPledge('alice', 'n1', 2)
    expect(await codigo(salvar('alice', 1))).toBe('evento-encerrado')
    expect(await codigo(cancelar('alice'))).toBe('evento-encerrado')
  })

  it('limite de itens por pessoa', async () => {
    await seedBasico({ needs: { n1: needBase(), n2: needBase({ nome: 'B' }), n3: needBase({ nome: 'C' }) } })
    await seedPledge('alice', 'n1', 1)
    await seedPledge('alice', 'n2', 1)
    const r = salvarPledge(dbOf('alice'), 'evt1', 'n3', ator('alice'), {
      qty: 1, opcao: null, textoOutro: null, devolverAoFinal: false,
    })
    expect(await codigo(r)).toBe('limite-itens')
  })

  it('bloqueada: não cria (com ou sem a flag), mas reduz e cancela', async () => {
    await seedBasico({ needs: { n1: needBase({ maxPorPessoa: 5 }) } })
    expect(await codigo(salvar('bloqueada', 1, { bloqueado: true }))).toBe('bloqueado')
    // sem a flag o cliente tenta, as rules negam e o diagnóstico relê blocked/{uid}
    expect(await codigo(salvar('bloqueada', 1))).toBe('bloqueado')
    await seedPledge('bloqueada', 'n1', 3)
    await salvar('bloqueada', 1, { bloqueado: true })
    await cancelar('bloqueada')
  })

  it('admin remove pledge alheia (sem log, mesmo pós-prazo)', async () => {
    await seedBasico({ evento: EVENTOS.prazoPassado(), needs: { n1: needBase({ maxPorPessoa: 5 }) } })
    await seedPledge('alice', 'n1', 3)
    await cancelar('admin', 'alice')
    expect(await readRaw('events/evt1/pledges/n1_alice')).toBeUndefined()
    expect(await readRaw('events/evt1/cancelamentos/n1_alice')).toBeUndefined()
    expect(await readRaw('events/evt1/needs/n1')).toMatchObject({ reservado: 0, ultimoUid: 'alice' })
    expect(await readRaw('events/evt1/participants/alice')).toMatchObject({ ativas: 0 })
  })

  it('não-admin tentando remover pledge alheia é barrado e nada muda', async () => {
    await seedBasico({ needs: { n1: needBase({ maxPorPessoa: 5 }) } })
    await seedPledge('alice', 'n1', 3)
    expect(await codigo(cancelar('bob', 'alice'))).toBeTruthy()
    expect(await readRaw('events/evt1/pledges/n1_alice')).toBeDefined()
  })
})
