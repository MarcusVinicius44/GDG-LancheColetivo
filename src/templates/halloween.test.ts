import { describe, expect, it } from 'vitest'
import { CATEGORIAS_PADRAO, MAX_OPCOES, TAGS } from '@/config/constants'
import { norm } from '@/lib/format'
import { HALLOWEEN_EVENT, HALLOWEEN_NEEDS, needDoc } from '@/templates/halloween'

describe('template Halloween', () => {
  it('ids únicos, sem "_" (o id da pledge é {needId}_{uid})', () => {
    const ids = HALLOWEEN_NEEDS.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every((id) => /^[a-z0-9-]+$/.test(id))).toBe(true)
  })

  it('correção 3: sem "outro", opções × maxPorOpcao comportam a meta', () => {
    for (const t of HALLOWEEN_NEEDS) {
      if (!t.permiteOutro && t.opcoes.length > 0 && t.maxPorOpcao !== null) {
        expect(t.opcoes.length * t.maxPorOpcao, t.nome).toBeGreaterThanOrEqual(t.meta)
      }
    }
    const suco = HALLOWEEN_NEEDS.find((t) => t.id === 'suco')!
    expect(suco.opcoes.length * (suco.maxPorOpcao ?? 0)).toBe(16)
  })

  it('metas do seed e sem água/gelo', () => {
    const meta = (id: string) => HALLOWEEN_NEEDS.find((t) => t.id === id)?.meta
    expect(meta('refrigerante')).toBe(10)
    expect(meta('suco')).toBe(12)
    expect(meta('salgados')).toBe(330)
    expect(meta('copos')).toBe(300)
    expect(meta('pao')).toBe(140)
    expect(HALLOWEEN_NEEDS.some((t) => /água|agua|gelo/i.test(t.nome))).toBe(false)
    expect(HALLOWEEN_NEEDS).toHaveLength(25)
  })

  it('limites coerentes e dentro do que as rules aceitam', () => {
    for (const t of HALLOWEEN_NEEDS) {
      expect(HALLOWEEN_EVENT.categorias).toContain(t.categoria)
      expect(t.minPorPessoa, t.nome).toBeGreaterThanOrEqual(1)
      expect(t.maxPorPessoa, t.nome).toBeGreaterThanOrEqual(t.minPorPessoa)
      expect(t.minPorPessoa, t.nome).toBeLessThanOrEqual(t.meta)
      expect(t.opcoes.length).toBeLessThanOrEqual(MAX_OPCOES)
      expect(new Set(t.opcoes.map(norm)).size).toBe(t.opcoes.length)
      t.tags.forEach((tag) => expect(TAGS).toContain(tag))
    }
  })

  it('categorias do evento = as 7 padrão; "devolver" só em Café & Cia, Descartáveis e Diversos', () => {
    expect(HALLOWEEN_EVENT.categorias).toEqual([...CATEGORIAS_PADRAO])
    for (const t of HALLOWEEN_NEEDS) {
      const esperado = ['Café & Cia', 'Descartáveis', 'Diversos'].includes(t.categoria)
      expect(t.tags.includes('devolver'), t.nome).toBe(esperado)
    }
  })

  it('needDoc: contadores zerados, opcoesNorm e as 16 chaves exigidas pelas rules', () => {
    const d = needDoc(HALLOWEEN_NEEDS.find((t) => t.id === 'refrigerante')!, 1)
    expect(Object.keys(d)).toHaveLength(16)
    expect(d.reservado).toBe(0)
    expect(d.ultimoUid).toBeNull()
    expect(d.opcoesNorm).toEqual(['coca-cola', 'guarana antarctica', 'fanta'])
    expect(d.reservadoPorOpcao).toEqual({ 'Coca-Cola': 0, 'Guaraná Antarctica': 0, Fanta: 0 })
  })

  it('datas em horário de Fortaleza: prazo 29/10 18h e início 31/10 08h30', () => {
    const f = (d: Date) => d.toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' })
    expect(f(HALLOWEEN_EVENT.prazoContribuicoes)).toBe('29/10/2026, 18:00:00')
    expect(f(HALLOWEEN_EVENT.inicio)).toBe('31/10/2026, 08:30:00')
    expect(HALLOWEEN_EVENT.prazoContribuicoes < HALLOWEEN_EVENT.inicio).toBe(true)
  })
})
