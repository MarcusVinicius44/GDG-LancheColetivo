import { describe, expect, it } from 'vitest'
import {
  formDe,
  formVazio,
  motivoNaoRemover,
  normalizar,
  paraBase,
  temErros,
  validarNeed,
  type ContextoNeed,
  type NeedForm,
} from '@/lib/needForm'
import type { Need, Pledge } from '@/lib/types'

const CATS = ['Bebidas', 'Frutas']

const need = (o: Partial<Need> = {}): Need => ({
  id: 'suco', nome: 'Suco', categoria: 'Bebidas', unidade: 'garrafa 1L', meta: 12, reservado: 0, minPorPessoa: 1,
  maxPorPessoa: 4, opcoes: [], opcoesNorm: [], maxPorOpcao: null, reservadoPorOpcao: {}, permiteOutro: false,
  nota: '', tags: [], ordem: 1, ultimoUid: null, ...o,
})
const pledge = (o: Partial<Pledge> = {}): Pledge => ({
  id: 'suco_a', needId: 'suco', uid: 'a', qty: 2, opcao: null, textoOutro: null, primeiroNome: 'Ana',
  devolverAoFinal: false, ...o,
})
const ctx = (o: Partial<ContextoNeed> = {}): ContextoNeed => ({
  atual: null, pledges: [], categorias: CATS, outrosNomes: [], ...o,
})
const form = (o: Partial<NeedForm> = {}): NeedForm => ({
  ...formVazio('Bebidas'), nome: 'Coca-Cola', unidade: 'garrafa 2L', meta: 10, maxPorPessoa: 4, ...o,
})

describe('validarNeed — item novo', () => {
  it('formulário válido não tem erros', () => {
    expect(validarNeed(form(), ctx())).toEqual({})
  })

  it('formulário vazio pede o essencial', () => {
    const e = validarNeed(formVazio('Bebidas'), ctx())
    expect(Object.keys(e).sort()).toEqual(['maxPorPessoa', 'meta', 'nome', 'unidade'])
  })

  it.each([
    ['nome em branco', { nome: '   ' }, 'nome'],
    ['nome com 81 caracteres', { nome: 'x'.repeat(81) }, 'nome'],
    ['unidade em branco', { unidade: ' ' }, 'unidade'],
    ['unidade com 41 caracteres', { unidade: 'x'.repeat(41) }, 'unidade'],
    ['nota com 201 caracteres', { nota: 'x'.repeat(201) }, 'nota'],
    ['categoria fora da lista do evento', { categoria: 'Salgados' }, 'categoria'],
    ['meta nula', { meta: null }, 'meta'],
    ['meta fracionária', { meta: 2.5 }, 'meta'],
    ['meta NaN', { meta: Number.NaN }, 'meta'],
    ['meta 0', { meta: 0 }, 'meta'],
    ['meta 5001', { meta: 5001 }, 'meta'],
    ['mínimo 0', { minPorPessoa: 0 }, 'minPorPessoa'],
    ['mínimo fracionário', { minPorPessoa: 1.5 }, 'minPorPessoa'],
    ['máximo nulo', { maxPorPessoa: null }, 'maxPorPessoa'],
    ['máximo menor que o mínimo', { minPorPessoa: 5, maxPorPessoa: 2 }, 'maxPorPessoa'],
    ['mínimo maior que a meta', { meta: 3, minPorPessoa: 4, maxPorPessoa: 4 }, 'minPorPessoa'],
    ['etiqueta repetida', { tags: ['vegano', 'vegano'] }, 'tags'],
    ['5 etiquetas', { tags: ['vegano', 'sem-gluten', 'sem-lactose', 'devolver', 'vegano'] }, 'tags'],
  ] as const)('%s ⇒ erro em %s', (_n, over, campo) => {
    expect(validarNeed(form(over as Partial<NeedForm>), ctx())[campo]).toBeTruthy()
  })

  it('meta 5000 e 4 etiquetas distintas passam', () => {
    expect(validarNeed(form({ meta: 5000, tags: ['vegano', 'sem-gluten', 'sem-lactose', 'devolver'] }), ctx())).toEqual({})
  })

  it('nome duplicado (sem caixa/acento) é negado; o próprio nome ao editar não conta', () => {
    expect(validarNeed(form({ nome: 'SUCO ' }), ctx({ outrosNomes: ['Suco'] })).nome).toBeTruthy()
    expect(validarNeed(form({ nome: 'Açúcar' }), ctx({ outrosNomes: ['acucar'] })).nome).toBeTruthy()
    expect(validarNeed(form({ nome: 'Suco' }), ctx({ atual: need(), outrosNomes: [] })).nome).toBeUndefined()
  })

  describe('sabores/marcas', () => {
    it('12 passam; 13 não', () => {
      const doze = Array.from({ length: 12 }, (_, i) => `Sabor ${i}`)
      expect(validarNeed(form({ opcoes: doze, maxPorOpcao: null }), ctx()).opcoes).toBeUndefined()
      expect(validarNeed(form({ opcoes: [...doze, 'Sabor 13'], maxPorOpcao: null }), ctx()).opcoes).toBeTruthy()
    })
    it('em branco, repetido (caixa/acento) ou longo demais é negado', () => {
      expect(validarNeed(form({ opcoes: ['Uva', '  '] }), ctx()).opcoes).toBeTruthy()
      expect(validarNeed(form({ opcoes: ['Guaraná', 'GUARANA '] }), ctx()).opcoes).toBeTruthy()
      expect(validarNeed(form({ opcoes: ['x'.repeat(41)] }), ctx()).opcoes).toBeTruthy()
    })
    it('sem sabores, o limite por sabor é ignorado', () => {
      expect(validarNeed(form({ opcoes: [], maxPorOpcao: 3 }), ctx())).toEqual({})
    })
  })

  describe('correção 3 (sabores × limite ≥ meta, salvo "Outro")', () => {
    it('2×4=8 < 12 sem Outro: erro com a conta; 4×4=16 ok', () => {
      const e = validarNeed(form({ meta: 12, opcoes: ['A', 'B'], maxPorOpcao: 4 }), ctx())
      expect(e.maxPorOpcao).toMatch(/2 sabor\(es\) × limite 4 = 8/)
      expect(validarNeed(form({ meta: 12, opcoes: ['A', 'B', 'C', 'D'], maxPorOpcao: 4 }), ctx()).maxPorOpcao).toBeUndefined()
    })
    it('com "Outro" ou sem limite por sabor passa', () => {
      expect(validarNeed(form({ meta: 12, opcoes: ['A', 'B'], maxPorOpcao: 4, permiteOutro: true }), ctx()).maxPorOpcao).toBeUndefined()
      expect(validarNeed(form({ meta: 12, opcoes: ['A', 'B'], maxPorOpcao: null }), ctx()).maxPorOpcao).toBeUndefined()
    })
    it('limite por sabor inválido', () => {
      expect(validarNeed(form({ opcoes: ['A'], maxPorOpcao: 0 }), ctx()).maxPorOpcao).toBeTruthy()
      expect(validarNeed(form({ opcoes: ['A'], maxPorOpcao: 1.5 }), ctx()).maxPorOpcao).toBeTruthy()
    })
  })
})

describe('validarNeed — editando item COM contribuições', () => {
  const comSabores = need({
    meta: 12, reservado: 5, maxPorPessoa: 4, opcoes: ['Uva', 'Morango', 'Abacaxi', 'Laranja'],
    opcoesNorm: ['uva', 'morango', 'abacaxi', 'laranja'], maxPorOpcao: 4,
    reservadoPorOpcao: { Uva: 3, Morango: 2, Abacaxi: 0, Laranja: 0 },
  })
  const pledges = [pledge({ qty: 3, opcao: 'Uva' }), pledge({ id: 'suco_b', uid: 'b', qty: 2, opcao: 'Morango' })]
  const c = (o: Partial<ContextoNeed> = {}) => ctx({ atual: comSabores, pledges, outrosNomes: [], ...o })

  it('sem mudanças, é válido', () => {
    expect(validarNeed(formDe(comSabores), c())).toEqual({})
  })

  it('meta abaixo do reservado negada; igual ao reservado ok', () => {
    expect(validarNeed({ ...formDe(comSabores), meta: 4 }, c()).meta).toMatch(/Já há 5/)
    expect(validarNeed({ ...formDe(comSabores), meta: 5, opcoes: ['Uva', 'Morango', 'Abacaxi', 'Laranja'] }, c()).meta).toBeUndefined()
  })

  it('não remove, renomeia nem reordena sabores; acrescentar no fim passa', () => {
    const base = formDe(comSabores)
    expect(validarNeed({ ...base, opcoes: ['Uva', 'Morango', 'Abacaxi'] }, c()).opcoes).toMatch(/não podem ser removidos/)
    expect(validarNeed({ ...base, opcoes: ['Morango', 'Uva', 'Abacaxi', 'Laranja'] }, c()).opcoes).toBeTruthy()
    expect(validarNeed({ ...base, opcoes: ['Uva', 'Morangos', 'Abacaxi', 'Laranja'] }, c()).opcoes).toBeTruthy()
    expect(validarNeed({ ...base, opcoes: ['Uva', 'Morango', 'Abacaxi', 'Laranja', 'Caju'] }, c()).opcoes).toBeUndefined()
  })

  it('sem reservas, sabores podem ser removidos e reordenados livremente', () => {
    const vazio = need({ ...comSabores, reservado: 0, reservadoPorOpcao: { Uva: 0, Morango: 0, Abacaxi: 0, Laranja: 0 } })
    const e = validarNeed({ ...formDe(vazio), opcoes: ['Laranja', 'Uva'], maxPorOpcao: 6 }, ctx({ atual: vazio }))
    expect(e.opcoes).toBeUndefined()
  })

  it('limite por sabor abaixo do já reservado é negado', () => {
    const e = validarNeed({ ...formDe(comSabores), maxPorOpcao: 2 }, c())
    expect(e.maxPorOpcao).toMatch(/Já há 3 de “Uva”/)
    expect(validarNeed({ ...formDe(comSabores), maxPorOpcao: 3 }, c()).maxPorOpcao).toBeUndefined()
  })

  it('mínimo/máximo por pessoa não invalidam contribuições existentes', () => {
    expect(validarNeed({ ...formDe(comSabores), minPorPessoa: 3 }, c()).minPorPessoa).toMatch(/Já há contribuição de 2/)
    expect(validarNeed({ ...formDe(comSabores), maxPorPessoa: 2 }, c()).maxPorPessoa).toMatch(/Já há contribuição de 3/)
    expect(validarNeed({ ...formDe(comSabores), minPorPessoa: 2, maxPorPessoa: 3 }, c())).toEqual({})
  })

  it('não passa a ter sabores se já há contribuições sem sabor', () => {
    const semSabor = need({ reservado: 2 })
    const e = validarNeed({ ...formDe(semSabor), opcoes: ['Uva'] }, ctx({ atual: semSabor, pledges: [pledge()] }))
    expect(e.opcoes).toMatch(/sem sabor/)
  })

  it('não desliga "Outro" se alguém já escolheu Outro', () => {
    const atual = need({ reservado: 2, permiteOutro: true })
    const ps = [pledge({ textoOutro: 'Sprite' })]
    expect(validarNeed({ ...formDe(atual), permiteOutro: false }, ctx({ atual, pledges: ps })).opcoes).toMatch(/Outro/)
    expect(validarNeed({ ...formDe(atual), permiteOutro: true }, ctx({ atual, pledges: ps })).opcoes).toBeUndefined()
  })

  it('categoria que saiu da lista do evento precisa ser trocada para salvar', () => {
    const orfao = need({ categoria: 'Antiga' })
    expect(validarNeed(formDe(orfao), ctx({ atual: orfao })).categoria).toBeTruthy()
    expect(validarNeed({ ...formDe(orfao), categoria: 'Frutas' }, ctx({ atual: orfao })).categoria).toBeUndefined()
  })
})

describe('normalizar, paraBase e motivoNaoRemover', () => {
  it('normalizar apara textos e zera o limite por sabor quando não há sabores', () => {
    const n = normalizar(form({ nome: '  Coca  ', unidade: ' 2L ', nota: ' x ', opcoes: [], maxPorOpcao: 4 }))
    expect([n.nome, n.unidade, n.nota, n.maxPorOpcao]).toEqual(['Coca', '2L', 'x', null])
    expect(normalizar(form({ opcoes: [' Uva ', 'Fanta'] })).opcoes).toEqual(['Uva', 'Fanta'])
  })

  it('paraBase: números de verdade, ou null se faltar algum', () => {
    expect(paraBase(form({ nome: ' Coca ' }))).toMatchObject({ nome: 'Coca', meta: 10, minPorPessoa: 1, maxPorPessoa: 4 })
    expect(paraBase(form({ meta: null }))).toBeNull()
    expect(paraBase(form({ maxPorPessoa: 2.5 }))).toBeNull()
  })

  it('temErros', () => {
    expect(temErros({})).toBe(false)
    expect(temErros({ nome: 'x' })).toBe(true)
  })

  it('motivoNaoRemover só quando há reservas', () => {
    expect(motivoNaoRemover(need({ reservado: 0 }))).toBeNull()
    expect(motivoNaoRemover(need({ reservado: 3 }))).toMatch(/3 unidade/)
  })
})
