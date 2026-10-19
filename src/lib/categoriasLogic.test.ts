import { describe, expect, it } from 'vitest'
import {
  adicionar,
  itensDaCategoria,
  motivoNaoRemoverCategoria,
  mover,
  remover,
  renomearPasso1,
  renomearPasso3,
  validarNomeCategoria,
} from '@/lib/categoriasLogic'
import type { Need } from '@/lib/types'

const need = (id: string, categoria: string): Need => ({
  id, nome: id, categoria, unidade: 'un', meta: 1, reservado: 0, minPorPessoa: 1, maxPorPessoa: 1, opcoes: [],
  opcoesNorm: [], maxPorOpcao: null, reservadoPorOpcao: {}, permiteOutro: false, nota: '', tags: [], ordem: 1, ultimoUid: null,
})

const L = ['Bebidas', 'Doces', 'Frutas']

describe('validarNomeCategoria', () => {
  it('aceita nome novo; apara espaços', () => {
    expect(validarNomeCategoria('  Frios ', L)).toBeNull()
  })
  it('recusa vazio, longo demais e repetido (caixa/acento não diferenciam)', () => {
    expect(validarNomeCategoria('   ', L)).toBeTruthy()
    expect(validarNomeCategoria('x'.repeat(31), L)).toBeTruthy()
    expect(validarNomeCategoria('x'.repeat(30), L)).toBeNull()
    expect(validarNomeCategoria('doces', L)).toBeTruthy()
    expect(validarNomeCategoria('FRÚTAS', L)).toBeTruthy()
  })
  it('ao renomear, o próprio nome não conta como repetido (mudar só a caixa)', () => {
    expect(validarNomeCategoria('bebidas', L, 'Bebidas')).toBeNull()
    expect(validarNomeCategoria('doces', L, 'Bebidas')).toBeTruthy()
  })
})

describe('adicionar / mover / remover', () => {
  it('adicionar põe no fim; recusa repetida e passar de 12', () => {
    expect(adicionar(L, ' Frios ')).toEqual([...L, 'Frios'])
    expect(() => adicionar(L, 'Doces')).toThrow(/Já existe/)
    const doze = Array.from({ length: 12 }, (_, i) => `C${i}`)
    expect(() => adicionar(doze, 'Nova')).toThrow(/No máximo 12/)
  })

  it('mover troca com o vizinho; nas pontas mantém', () => {
    expect(mover(L, 'Doces', -1)).toEqual(['Doces', 'Bebidas', 'Frutas'])
    expect(mover(L, 'Doces', 1)).toEqual(['Bebidas', 'Frutas', 'Doces'])
    expect(mover(L, 'Bebidas', -1)).toEqual(L)
    expect(mover(L, 'Frutas', 1)).toEqual(L)
    expect(mover(L, 'Nenhuma', 1)).toEqual(L)
  })

  it('remover tira da lista, mas nunca deixa o evento sem categoria', () => {
    expect(remover(L, 'Doces')).toEqual(['Bebidas', 'Frutas'])
    expect(() => remover(['Única'], 'Única')).toThrow(/pelo menos uma/)
  })
})

describe('renomear em 3 passos', () => {
  it('passo 1: o nome novo entra logo depois do antigo (ordem preservada no fim)', () => {
    const p1 = renomearPasso1(L, 'Doces', 'Sobremesas')
    expect(p1).toEqual(['Bebidas', 'Doces', 'Sobremesas', 'Frutas'])
    expect(renomearPasso3(p1, 'Doces')).toEqual(['Bebidas', 'Sobremesas', 'Frutas'])
  })

  it('só a caixa muda: continua sendo um passo válido', () => {
    expect(renomearPasso1(L, 'Doces', 'DOCES')).toEqual(['Bebidas', 'Doces', 'DOCES', 'Frutas'])
  })

  it('recusa nome igual, repetido, categoria inexistente e passar de 12', () => {
    expect(() => renomearPasso1(L, 'Doces', 'Doces')).toThrow()
    expect(() => renomearPasso1(L, 'Doces', 'Frutas')).toThrow(/Já existe/)
    expect(() => renomearPasso1(L, 'Nenhuma', 'X')).toThrow(/não existe mais/)
    const doze = Array.from({ length: 12 }, (_, i) => `C${i}`)
    expect(() => renomearPasso1(doze, 'C0', 'Novo')).toThrow(/No máximo 12/)
  })

  it('cada passo, sozinho, deixa uma lista válida (1–12, sem repetição)', () => {
    const p1 = renomearPasso1(L, 'Doces', 'Sobremesas')
    for (const l of [L, p1, renomearPasso3(p1, 'Doces')]) {
      expect(new Set(l).size).toBe(l.length)
      expect(l.length).toBeGreaterThanOrEqual(1)
      expect(l.length).toBeLessThanOrEqual(12)
    }
  })
})

describe('remoção de categoria com itens', () => {
  const needs = [need('a', 'Doces'), need('b', 'Doces'), need('c', 'Bebidas')]

  it('itensDaCategoria', () => {
    expect(itensDaCategoria(needs, 'Doces').map((n) => n.id)).toEqual(['a', 'b'])
  })
  it('bloqueia quando há itens, ou quando é a última categoria', () => {
    expect(motivoNaoRemoverCategoria(needs, 'Doces', 3)).toMatch(/2 item/)
    expect(motivoNaoRemoverCategoria(needs, 'Frutas', 3)).toBeNull()
    expect(motivoNaoRemoverCategoria([], 'Única', 1)).toMatch(/pelo menos uma/)
  })
})
