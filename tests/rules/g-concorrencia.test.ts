import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { collection, getDocs, type Firestore } from 'firebase/firestore'
import { cancelarPledge, salvarPledge } from '@/lib/pledges'
import {
  USERS,
  dbOf,
  needBase,
  needComOpcoes,
  needPath,
  partPath,
  pledgePath,
  resetEnv,
  seedBasico,
  setupEnv,
  teardownEnv,
  type UserKey,
} from './harness'
import { readRaw } from './ops'

beforeAll(setupEnv)
afterAll(teardownEnv)
beforeEach(resetEnv)

// Usa o lib/pledges.ts real (o mesmo código do app) contra o emulador.
const ator = (k: UserKey) => ({ uid: USERS[k].uid, nome: (USERS[k].claims as { name?: string }).name ?? null })
const txPledge = (k: UserKey, nid: string, qty: number, opcao: string | null = null) =>
  salvarPledge(dbOf(k), 'evt1', nid, ator(k), { qty, opcao, textoOutro: null, devolverAoFinal: false })
const txCancel = (k: UserKey, nid: string) => cancelarPledge(dbOf(k), 'evt1', nid, ator(k))

async function invariantes(nid: string) {
  const need = (await readRaw(needPath(nid)))!
  const { getEnv } = await import('./harness')
  let soma = 0
  const somaOpcao: Record<string, number> = {}
  await getEnv().withSecurityRulesDisabled(async (c) => {
    const s = await getDocs(collection(c.firestore() as unknown as Firestore, 'events/evt1/pledges'))
    s.forEach((d) => {
      const p = d.data()
      if (p.needId !== nid) return
      soma += p.qty
      if (p.opcao) somaOpcao[p.opcao] = (somaOpcao[p.opcao] ?? 0) + p.qty
    })
  })
  expect(need.reservado).toBe(soma)
  for (const [o, v] of Object.entries(need.reservadoPorOpcao as Record<string, number>)) {
    expect(v).toBe(somaOpcao[o] ?? 0)
  }
  return need
}

describe('G. Concorrência (emulador real)', () => {
  it('duas pledges na última unidade ⇒ exatamente uma vence', async () => {
    await seedBasico({ needs: { n1: needBase({ meta: 1, maxPorPessoa: 1 }) } })
    const r = await Promise.allSettled([txPledge('alice', 'n1', 1), txPledge('bob', 'n1', 1)])
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1)
    const rej = r.find((x) => x.status === 'rejected') as PromiseRejectedResult
    // o perdedor leva permission-denied das rules; o cliente diagnostica "esgotado"
    expect(rej.reason).toMatchObject({ code: 'esgotado' })
    const need = await invariantes('n1')
    expect(need.reservado).toBe(1)
  })

  it('várias pessoas disputando poucas unidades: nunca passa da meta', async () => {
    await seedBasico({ needs: { n1: needBase({ meta: 2, maxPorPessoa: 1 }) } })
    const r = await Promise.allSettled([
      txPledge('alice', 'n1', 1),
      txPledge('bob', 'n1', 1),
      txPledge('carol', 'n1', 1),
    ])
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(2)
    const need = await invariantes('n1')
    expect(need.reservado).toBe(2)
  })

  it('2 usuários na última vaga de uma opção (maxPorOpcao)', async () => {
    await seedBasico({ needs: { n1: needComOpcoes(['Uva', 'Morango'], { meta: 8, maxPorOpcao: 1, maxPorPessoa: 1 }) } })
    const r = await Promise.allSettled([
      txPledge('alice', 'n1', 1, 'Uva'),
      txPledge('bob', 'n1', 1, 'Uva'),
    ])
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1)
    const need = await invariantes('n1')
    expect(need.reservadoPorOpcao.Uva).toBe(1)
  })

  it('mesma pessoa clica 2× ⇒ 1 pledge, contador correto', async () => {
    await seedBasico({ needs: { n1: needBase({ meta: 10, maxPorPessoa: 4 }) } })
    await Promise.allSettled([txPledge('alice', 'n1', 2), txPledge('alice', 'n1', 2)])
    const need = await invariantes('n1')
    expect(need.reservado).toBe(2)
    const part = await readRaw(partPath('alice'))
    expect(part?.ativas).toBe(1)
  })

  it('edição simultânea de qty e cancelamento ⇒ estado consistente', async () => {
    await seedBasico({ needs: { n1: needBase({ meta: 10, maxPorPessoa: 5 }) } })
    await txPledge('alice', 'n1', 2)
    await Promise.allSettled([txPledge('alice', 'n1', 4), txCancel('alice', 'n1')])
    await invariantes('n1')
    const part = await readRaw(partPath('alice'))
    const p = await readRaw(pledgePath('n1', 'alice'))
    expect(part?.ativas).toBe(p ? 1 : 0)
  })

  it('rajada mista mantém reservado == Σ qty e Σ por opção', async () => {
    await seedBasico({
      needs: { n1: needComOpcoes(['Uva', 'Morango', 'Abacaxi'], { meta: 6, maxPorOpcao: 3, maxPorPessoa: 3 }) },
    })
    await Promise.allSettled([
      txPledge('alice', 'n1', 2, 'Uva'),
      txPledge('bob', 'n1', 2, 'Uva'),
      txPledge('carol', 'n1', 3, 'Morango'),
    ])
    const need = await invariantes('n1')
    expect(need.reservado).toBeLessThanOrEqual(6)
  })
})
