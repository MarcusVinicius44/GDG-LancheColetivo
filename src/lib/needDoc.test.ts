import { describe, expect, it } from 'vitest'
import { camposAlterados, gerarIdNeed, needDoc, planoEscritas, planoMover, proximaOrdem } from '@/lib/needDoc'
import type { NeedBase } from '@/lib/needForm'
import type { Need } from '@/lib/types'

const need = (o: Partial<Need> = {}): Need => ({
  id: 'suco', nome: 'Suco', categoria: 'Bebidas', unidade: 'garrafa 1L', meta: 12, reservado: 0, minPorPessoa: 1,
  maxPorPessoa: 4, opcoes: [], opcoesNorm: [], maxPorOpcao: null, reservadoPorOpcao: {}, permiteOutro: false,
  nota: '', tags: [], ordem: 1, ultimoUid: null, ...o,
})
const base = (n: Need, o: Partial<NeedBase> = {}): NeedBase => ({
  nome: n.nome, categoria: n.categoria, unidade: n.unidade, meta: n.meta, minPorPessoa: n.minPorPessoa,
  maxPorPessoa: n.maxPorPessoa, opcoes: [...n.opcoes], maxPorOpcao: n.maxPorOpcao, permiteOutro: n.permiteOutro,
  nota: n.nota, tags: [...n.tags], ...o,
})
const caminhos = (c: ReturnType<typeof camposAlterados>) => c.map(([k]) => k.join('.'))

describe('needDoc', () => {
  it('tem as 16 chaves exigidas pelas rules, contadores zerados e opcoesNorm', () => {
    const d = needDoc(base(need(), { opcoes: ['Guaraná Antarctica', 'Uva'], tags: ['devolver'] }), 7)
    expect(Object.keys(d)).toHaveLength(16)
    expect(d).toMatchObject({ reservado: 0, ultimoUid: null, ordem: 7, tags: ['devolver'] })
    expect(d.opcoesNorm).toEqual(['guarana antarctica', 'uva'])
    expect(d.reservadoPorOpcao).toEqual({ 'Guaraná Antarctica': 0, Uva: 0 })
  })
})

describe('gerarIdNeed', () => {
  it('slug sem acento, só a-z0-9 e hífen (sem "_", que separa needId e uid)', () => {
    expect(gerarIdNeed('Café Pronto (1L)', new Set())).toBe('cafe-pronto-1l')
    expect(gerarIdNeed('Pão_de_Queijo!', new Set())).toBe('pao-de-queijo')
    expect(/^[a-z0-9-]+$/.test(gerarIdNeed('Ñandú ★ 100%', new Set()))).toBe(true)
  })
  it('sem letras vira "item"; colisões ganham sufixo', () => {
    expect(gerarIdNeed('★★★', new Set())).toBe('item')
    expect(gerarIdNeed('Suco', new Set(['suco']))).toBe('suco-2')
    expect(gerarIdNeed('Suco', new Set(['suco', 'suco-2']))).toBe('suco-3')
  })
  it('limita o tamanho', () => {
    expect(gerarIdNeed('a'.repeat(100), new Set()).length).toBeLessThanOrEqual(30)
  })
})

describe('proximaOrdem', () => {
  it('vem depois de todos', () => {
    expect(proximaOrdem([])).toBe(1)
    expect(proximaOrdem([need({ ordem: 3 }), need({ id: 'b', ordem: 9 })])).toBe(10)
  })
})

describe('camposAlterados', () => {
  it('sem mudança ⇒ nada', () => {
    const n = need()
    expect(camposAlterados(n, base(n))).toEqual([])
  })

  it('só os campos que mudaram', () => {
    const n = need()
    const c = camposAlterados(n, base(n, { nome: 'Suco natural', meta: 20, nota: 'gelado' }))
    expect(caminhos(c).sort()).toEqual(['meta', 'nome', 'nota'])
    expect(c.find(([k]) => k[0] === 'meta')?.[1]).toBe(20)
  })

  it('etiquetas: mudar a ordem não conta; mudar o conteúdo, sim', () => {
    const n = need({ tags: ['vegano', 'devolver'] })
    expect(camposAlterados(n, base(n, { tags: ['devolver', 'vegano'] }))).toEqual([])
    expect(caminhos(camposAlterados(n, base(n, { tags: ['vegano'] })))).toEqual(['tags'])
  })

  it('NUNCA inclui reservado nem ultimoUid', () => {
    const n = need({ reservado: 4, ultimoUid: 'alice', opcoes: ['A'], opcoesNorm: ['a'], reservadoPorOpcao: { A: 4 } })
    const todos = camposAlterados(n, base(n, { nome: 'x', meta: 99, opcoes: ['A', 'B'], tags: ['vegano'], permiteOutro: true }))
    const nomes = caminhos(todos)
    expect(nomes).not.toContain('reservado')
    expect(nomes).not.toContain('ultimoUid')
  })

  describe('sabores', () => {
    it('sem reservas: regrava o mapa de contadores todo, com zeros', () => {
      const n = need({ opcoes: ['A', 'B'], opcoesNorm: ['a', 'b'], reservadoPorOpcao: { A: 0, B: 0 } })
      const c = camposAlterados(n, base(n, { opcoes: ['B', 'Çaju'] }))
      expect(caminhos(c).sort()).toEqual(['opcoes', 'opcoesNorm', 'reservadoPorOpcao'])
      expect(c.find(([k]) => k[0] === 'opcoesNorm')?.[1]).toEqual(['b', 'caju'])
      expect(c.find(([k]) => k[0] === 'reservadoPorOpcao')?.[1]).toEqual({ B: 0, Çaju: 0 })
    })

    it('com reservas: só cria a chave dos sabores novos, sem tocar nos contadores existentes', () => {
      const n = need({ reservado: 3, opcoes: ['A', 'B'], opcoesNorm: ['a', 'b'], reservadoPorOpcao: { A: 3, B: 0 } })
      const c = camposAlterados(n, base(n, { opcoes: ['A', 'B', 'C', 'D.e'] }))
      expect(caminhos(c)).toEqual(['opcoes', 'opcoesNorm', 'reservadoPorOpcao.C', 'reservadoPorOpcao.D.e'])
      // o nome com ponto continua sendo UMA chave (caminho como lista, não string pontilhada)
      expect(c.filter(([k]) => k[0] === 'reservadoPorOpcao').map(([k, v]) => [k, v])).toEqual([
        [['reservadoPorOpcao', 'C'], 0],
        [['reservadoPorOpcao', 'D.e'], 0],
      ])
    })
  })
})

describe('planoEscritas', () => {
  const comReservas = need({
    meta: 12, reservado: 3, opcoes: ['A', 'B'], opcoesNorm: ['a', 'b'], maxPorOpcao: 6, reservadoPorOpcao: { A: 3, B: 0 },
  })

  it('nada a gravar ⇒ nenhuma escrita', () => {
    expect(planoEscritas(comReservas, base(comReservas))).toEqual([])
  })

  it('sem sabor novo ou com 1 só: uma escrita (inclui os demais campos)', () => {
    expect(planoEscritas(comReservas, base(comReservas, { nome: 'X' }))).toHaveLength(1)
    const um = planoEscritas(comReservas, base(comReservas, { nome: 'X', opcoes: ['A', 'B', 'C'] }))
    expect(um).toHaveLength(1)
    expect(caminhos(um[0]!)).toEqual(['nome', 'opcoes', 'opcoesNorm', 'reservadoPorOpcao.C'])
  })

  it('com reservas e vários sabores novos: um por escrita; a última leva os outros campos', () => {
    const etapas = planoEscritas(comReservas, base(comReservas, { nome: 'X', meta: 20, opcoes: ['A', 'B', 'C', 'D', 'E'] }))
    expect(etapas).toHaveLength(3)
    // cada escrita acrescenta exatamente um sabor ao anterior
    expect(etapas[0]!.find(([k]) => k[0] === 'opcoes')?.[1]).toEqual(['A', 'B', 'C'])
    expect(etapas[1]!.find(([k]) => k[0] === 'opcoes')?.[1]).toEqual(['A', 'B', 'C', 'D'])
    expect(etapas[2]!.find(([k]) => k[0] === 'opcoes')?.[1]).toEqual(['A', 'B', 'C', 'D', 'E'])
    expect(caminhos(etapas[0]!)).toEqual(['opcoes', 'opcoesNorm', 'reservadoPorOpcao.C'])
    expect(caminhos(etapas[1]!)).toEqual(['opcoes', 'opcoesNorm', 'reservadoPorOpcao.D'])
    // os campos escalares só vão na última (estados intermediários = item antigo + mais sabores, sempre válido)
    expect(caminhos(etapas[2]!).sort()).toEqual(['meta', 'nome', 'opcoes', 'opcoesNorm', 'reservadoPorOpcao.E'])
    // nunca tocam em contadores existentes
    for (const e of etapas) expect(caminhos(e)).not.toContain('reservado')
  })

  it('sem reservas, vários sabores novos continuam sendo uma escrita só', () => {
    const livre = need({ opcoes: ['A'], opcoesNorm: ['a'], reservadoPorOpcao: { A: 0 }, reservado: 0 })
    expect(planoEscritas(livre, base(livre, { opcoes: ['A', 'B', 'C', 'D'] }))).toHaveLength(1)
  })
})

describe('planoMover', () => {
  const lista = [need({ id: 'a', ordem: 1 }), need({ id: 'b', ordem: 5 }), need({ id: 'c', ordem: 9 })]

  it('troca a ordem com o vizinho', () => {
    expect(planoMover(lista, 'b', -1)).toEqual([{ id: 'b', ordem: 1 }, { id: 'a', ordem: 5 }])
    expect(planoMover(lista, 'b', 1)).toEqual([{ id: 'b', ordem: 9 }, { id: 'c', ordem: 5 }])
  })
  it('na ponta não faz nada; id inexistente também não', () => {
    expect(planoMover(lista, 'a', -1)).toEqual([])
    expect(planoMover(lista, 'c', 1)).toEqual([])
    expect(planoMover(lista, 'zzz', 1)).toEqual([])
  })
  it('independe da ordem em que a lista chega', () => {
    expect(planoMover([lista[2]!, lista[0]!, lista[1]!], 'b', -1)).toEqual([{ id: 'b', ordem: 1 }, { id: 'a', ordem: 5 }])
  })
  it('ordem repetida: desempata em vez de não fazer nada', () => {
    const r = planoMover([need({ id: 'a', ordem: 2 }), need({ id: 'b', ordem: 2 })], 'b', -1)
    expect(r).toHaveLength(1)
  })
})
