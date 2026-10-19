import { describe, expect, it } from 'vitest'
import {
  camposEventoAlterados,
  formEventoDe,
  paraEventoBase,
  pessoasAcimaDoLimite,
  temErrosEvento,
  validarEvento,
  type EventoForm,
} from '@/lib/eventoForm'
import type { Evento, Pledge } from '@/lib/types'

const AGORA = new Date('2026-10-20T12:00:00Z')
const h = (n: number) => new Date(AGORA.getTime() + n * 3600_000)

const evento = (o: Partial<Evento> = {}): Evento => ({
  id: 'e1', titulo: 'Coding Jam', descricao: 'desc', local: 'UNINASSAU', inscritos: 10, publicoPlanejado: 90, margem: 0,
  maxNecessidadesPorPessoa: 2, status: 'aberto', inicio: h(72), prazoContribuicoes: h(48), categorias: ['Bebidas'], ...o,
})
const pledge = (uid: string, needId: string): Pledge => ({
  id: `${needId}_${uid}`, needId, uid, qty: 1, opcao: null, textoOutro: null, primeiroNome: uid, devolverAoFinal: false,
})
const form = (o: Partial<EventoForm> = {}): EventoForm => ({ ...formEventoDe(evento()), ...o })

describe('validarEvento', () => {
  it('evento atual é válido e sem avisos', () => {
    const r = validarEvento(form(), AGORA)
    expect(r.erros).toEqual({})
    expect(r.avisos).toEqual([])
  })

  it.each([
    ['título vazio', { titulo: '  ' }, 'titulo'],
    ['título com 121 caracteres', { titulo: 'x'.repeat(121) }, 'titulo'],
    ['descrição com 2001 caracteres', { descricao: 'x'.repeat(2001) }, 'descricao'],
    ['local com 201 caracteres', { local: 'x'.repeat(201) }, 'local'],
    ['início inválido', { inicio: new Date('lixo') }, 'inicio'],
    ['início nulo', { inicio: null }, 'inicio'],
    ['prazo nulo', { prazoContribuicoes: null }, 'prazoContribuicoes'],
    ['prazo depois do início', { prazoContribuicoes: h(100) }, 'prazoContribuicoes'],
    ['inscritos negativo', { inscritos: -1 }, 'inscritos'],
    ['inscritos fracionário', { inscritos: 1.5 }, 'inscritos'],
    ['público 0', { publicoPlanejado: 0 }, 'publicoPlanejado'],
    ['público 1001', { publicoPlanejado: 1001 }, 'publicoPlanejado'],
    ['itens por pessoa 0', { maxNecessidadesPorPessoa: 0 }, 'maxNecessidadesPorPessoa'],
    ['itens por pessoa 21', { maxNecessidadesPorPessoa: 21 }, 'maxNecessidadesPorPessoa'],
    ['itens por pessoa nulo', { maxNecessidadesPorPessoa: null }, 'maxNecessidadesPorPessoa'],
  ] as const)('%s ⇒ erro em %s', (_n, over, campo) => {
    expect(validarEvento(form(over as Partial<EventoForm>), AGORA).erros[campo]).toBeTruthy()
  })

  it('limites: prazo == início, público 1 e 1000, itens 1 e 20 passam', () => {
    expect(validarEvento(form({ prazoContribuicoes: h(72) }), AGORA).erros).toEqual({})
    for (const publicoPlanejado of [1, 1000]) expect(validarEvento(form({ publicoPlanejado }), AGORA).erros).toEqual({})
    for (const maxNecessidadesPorPessoa of [1, 20]) {
      expect(validarEvento(form({ maxNecessidadesPorPessoa }), AGORA).erros).toEqual({})
    }
  })

  it('avisa (sem impedir) de prazo e início no passado', () => {
    const r = validarEvento(form({ prazoContribuicoes: h(-5), inicio: h(-1) }), AGORA)
    expect(temErrosEvento(r.erros)).toBe(false)
    expect(r.avisos).toHaveLength(2)
  })

  it('avisa de pessoas acima do novo limite de itens', () => {
    const ps = [pledge('a', 'n1'), pledge('a', 'n2'), pledge('a', 'n3'), pledge('b', 'n1')]
    const r = validarEvento(form({ maxNecessidadesPorPessoa: 2 }), AGORA, ps)
    expect(r.avisos.join(' ')).toMatch(/1 pessoa/)
    expect(validarEvento(form({ maxNecessidadesPorPessoa: 3 }), AGORA, ps).avisos).toEqual([])
  })
})

describe('pessoasAcimaDoLimite', () => {
  it('conta pessoas (não contribuições) com mais itens que o máximo', () => {
    const ps = [pledge('a', 'n1'), pledge('a', 'n2'), pledge('b', 'n1'), pledge('b', 'n2'), pledge('c', 'n1')]
    expect(pessoasAcimaDoLimite(ps, 1)).toBe(2)
    expect(pessoasAcimaDoLimite(ps, 2)).toBe(0)
    expect(pessoasAcimaDoLimite([], 1)).toBe(0)
  })
})

describe('paraEventoBase / camposEventoAlterados', () => {
  it('paraEventoBase apara textos; null se faltar algo', () => {
    expect(paraEventoBase(form({ titulo: '  Novo  ', local: ' X ' }))).toMatchObject({ titulo: 'Novo', local: 'X' })
    expect(paraEventoBase(form({ inicio: null }))).toBeNull()
    expect(paraEventoBase(form({ inscritos: null }))).toBeNull()
  })

  it('sem mudança ⇒ nada; datas comparadas pelo instante', () => {
    const e = evento()
    expect(camposEventoAlterados(e, paraEventoBase(form())!)).toEqual({})
    const copia = new Date(e.inicio.getTime())
    expect(camposEventoAlterados(e, paraEventoBase(form({ inicio: copia }))!)).toEqual({})
  })

  it('só o que mudou; nunca status, criadoEm nem categorias', () => {
    const e = evento()
    const campos = camposEventoAlterados(e, paraEventoBase(form({ titulo: 'Outro', publicoPlanejado: 120, prazoContribuicoes: h(60) }))!)
    expect(Object.keys(campos).sort()).toEqual(['prazoContribuicoes', 'publicoPlanejado', 'titulo'])
    expect(campos).not.toHaveProperty('status')
    expect(campos).not.toHaveProperty('categorias')
  })
})
