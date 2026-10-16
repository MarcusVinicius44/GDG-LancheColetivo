import { describe, expect, it } from 'vitest'
import {
  agruparPorCategoria,
  completa,
  descreverPledge,
  maxParaMim,
  percentual,
  permiteDevolver,
  pledgesDaNeed,
  restante,
  restanteDaOpcao,
  resumir,
} from '@/lib/needView'
import type { Need, Pledge } from '@/lib/types'

const need = (o: Partial<Need> = {}): Need => ({
  id: 'n1', nome: 'Suco', categoria: 'Bebidas', unidade: '1L', meta: 12, reservado: 0, minPorPessoa: 1,
  maxPorPessoa: 4, opcoes: [], opcoesNorm: [], maxPorOpcao: null, reservadoPorOpcao: {}, permiteOutro: false,
  nota: '', tags: [], ordem: 1, ultimoUid: null, ...o,
})
const pledge = (o: Partial<Pledge> = {}): Pledge => ({
  id: 'n1_a', needId: 'n1', uid: 'a', qty: 2, opcao: null, textoOutro: null, primeiroNome: 'Ana',
  devolverAoFinal: false, ...o,
})

describe('needView', () => {
  it('restante, completa e percentual', () => {
    expect(restante(need({ reservado: 5 }))).toBe(7)
    expect(restante(need({ reservado: 15 }))).toBe(0)
    expect(completa(need({ reservado: 12 }))).toBe(true)
    expect(percentual(need({ reservado: 3 }))).toBe(25)
    expect(percentual(need({ meta: 0 }))).toBe(0)
  })

  it('restanteDaOpcao: null sem cap; nunca negativo', () => {
    expect(restanteDaOpcao(need(), 'Uva')).toBeNull()
    const n = need({ maxPorOpcao: 4, reservadoPorOpcao: { Uva: 3, Fanta: 4 } })
    expect(restanteDaOpcao(n, 'Uva')).toBe(1)
    expect(restanteDaOpcao(n, 'Fanta')).toBe(0)
    expect(restanteDaOpcao(n, 'Nova')).toBe(4)
  })

  it('maxParaMim: respeita meta, max por pessoa e cap da opção, devolvendo a própria qty', () => {
    expect(maxParaMim(need(), null, null)).toBe(4)
    expect(maxParaMim(need({ reservado: 10 }), null, null)).toBe(2)
    expect(maxParaMim(need({ reservado: 12 }), pledge({ qty: 3 }), null)).toBe(3)
    const n = need({ maxPorOpcao: 4, reservadoPorOpcao: { Uva: 3 } })
    expect(maxParaMim(n, null, 'Uva')).toBe(1)
    expect(maxParaMim(n, pledge({ qty: 3, opcao: 'Uva' }), 'Uva')).toBe(4)
    expect(maxParaMim(n, pledge({ qty: 3, opcao: 'Uva' }), 'Morango')).toBe(4)
    expect(maxParaMim(need({ reservado: 12 }), null, null)).toBe(0)
  })

  it('agruparPorCategoria: ordem fixa das categorias, ordena e omite vazias', () => {
    const g = agruparPorCategoria([
      need({ id: 'a', categoria: 'Doces', ordem: 2 }),
      need({ id: 'b', categoria: 'Bebidas', ordem: 9 }),
      need({ id: 'c', categoria: 'Doces', ordem: 1 }),
    ])
    expect(g.map((x) => x.categoria)).toEqual(['Bebidas', 'Doces'])
    expect(g[1]?.needs.map((n) => n.id)).toEqual(['c', 'a'])
  })

  it('pledgesDaNeed e descreverPledge', () => {
    const ps = [
      pledge({ primeiroNome: 'Zé', needId: 'n1' }),
      pledge({ primeiroNome: 'Ana', needId: 'n1', opcao: 'Fanta' }),
      pledge({ needId: 'n2' }),
    ]
    expect(pledgesDaNeed(ps, 'n1').map((p) => p.primeiroNome)).toEqual(['Ana', 'Zé'])
    expect(descreverPledge(ps[1]!)).toBe('Ana ×2 · Fanta')
    expect(descreverPledge(pledge({ textoOutro: 'Sprite' }))).toBe('Ana ×2 · Sprite')
    expect(descreverPledge(pledge())).toBe('Ana ×2')
  })

  it('resumir: itens completos e % por unidades (sem passar de 100% por item)', () => {
    const r = resumir([
      need({ meta: 10, reservado: 10 }),
      need({ meta: 10, reservado: 5 }),
      need({ meta: 20, reservado: 25 }),
    ])
    expect(r).toEqual({ total: 3, completas: 2, faltando: 1, percentual: 88 })
    expect(resumir([])).toEqual({ total: 0, completas: 0, faltando: 0, percentual: 0 })
  })

  it('permiteDevolver só em Café & Cia, Diversos e Descartáveis', () => {
    expect(permiteDevolver(need({ categoria: 'Café & Cia' }))).toBe(true)
    expect(permiteDevolver(need({ categoria: 'Diversos' }))).toBe(true)
    expect(permiteDevolver(need({ categoria: 'Salgados' }))).toBe(false)
  })
})
