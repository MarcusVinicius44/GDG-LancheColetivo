import { describe, expect, it } from 'vitest'
import { PledgeError, traduzirErroSdk } from '@/lib/errors'
import {
  diagnosticarNegado,
  faseDoEvento,
  novoContador,
  planejarCancelar,
  planejarSalvar,
  type Estado,
} from '@/lib/pledgeLogic'
import type { Evento, Need, Pledge, PledgeInput } from '@/lib/types'

const AGORA = new Date('2026-10-20T12:00:00Z')
const h = (n: number) => new Date(AGORA.getTime() + n * 3600_000)

const evento = (over: Partial<Evento> = {}): Evento => ({
  id: 'e1', titulo: 'x', descricao: '', local: '', inscritos: 0, publicoPlanejado: 90, margem: 0,
  maxNecessidadesPorPessoa: 2, status: 'aberto',
  inicio: h(72), prazoContribuicoes: h(48), categorias: ['Bebidas'], ...over,
})
const need = (over: Partial<Need> = {}): Need => ({
  id: 'n1', nome: 'Suco', categoria: 'Bebidas', unidade: '1L', meta: 12, reservado: 0,
  minPorPessoa: 1, maxPorPessoa: 4, opcoes: [], opcoesNorm: [], maxPorOpcao: null,
  reservadoPorOpcao: {}, permiteOutro: false, nota: '', tags: [], ordem: 1, ultimoUid: null, ...over,
})
const comOpcoes = (over: Partial<Need> = {}) =>
  need({
    opcoes: ['Uva', 'Guaraná Antarctica'], opcoesNorm: ['uva', 'guarana antarctica'],
    maxPorOpcao: 4, reservadoPorOpcao: { Uva: 0, 'Guaraná Antarctica': 0 }, ...over,
  })
const pledge = (over: Partial<Pledge> = {}): Pledge => ({
  id: 'n1_a', needId: 'n1', uid: 'a', qty: 2, opcao: null, textoOutro: null,
  primeiroNome: 'Ana', devolverAoFinal: false, ...over,
})
const estado = (over: Partial<Estado> = {}): Estado => ({
  evento: evento(), need: need(), pledge: null, ativas: 0, bloqueado: false, ...over,
})
const input = (over: Partial<PledgeInput> = {}): PledgeInput => ({
  qty: 2, opcao: null, textoOutro: null, devolverAoFinal: false, ...over,
})
const codigo = (fn: () => unknown) => {
  try {
    fn()
  } catch (e) {
    return (e as PledgeError).code
  }
  return null
}

describe('faseDoEvento', () => {
  it('antes do prazo / pós-prazo / encerrado / fechado', () => {
    expect(faseDoEvento(evento(), AGORA)).toBe('antes-prazo')
    expect(faseDoEvento(evento({ prazoContribuicoes: h(-1) }), AGORA)).toBe('pos-prazo')
    expect(faseDoEvento(evento({ prazoContribuicoes: h(-5), inicio: h(-1) }), AGORA)).toBe('encerrado')
    expect(faseDoEvento(evento({ status: 'fechado' }), AGORA)).toBe('fechado')
    expect(faseDoEvento(evento({ status: 'rascunho' }), AGORA)).toBe('fechado')
  })
})

describe('novoContador', () => {
  it('criar, aumentar, trocar sabor e remover', () => {
    const n = comOpcoes({ reservado: 3, reservadoPorOpcao: { Uva: 3, 'Guaraná Antarctica': 0 } })
    expect(novoContador(n, null, { qty: 2, opcao: 'Uva' })).toEqual({
      reservado: 5, reservadoPorOpcao: { Uva: 5, 'Guaraná Antarctica': 0 },
    })
    expect(novoContador(n, { qty: 3, opcao: 'Uva' }, { qty: 3, opcao: 'Guaraná Antarctica' })).toEqual({
      reservado: 3, reservadoPorOpcao: { Uva: 0, 'Guaraná Antarctica': 3 },
    })
    expect(novoContador(n, { qty: 3, opcao: 'Uva' }, null)).toEqual({
      reservado: 0, reservadoPorOpcao: { Uva: 0, 'Guaraná Antarctica': 0 },
    })
  })
  it('não muta a need original', () => {
    const n = comOpcoes()
    novoContador(n, null, { qty: 1, opcao: 'Uva' })
    expect(n.reservadoPorOpcao.Uva).toBe(0)
  })
})

describe('planejarSalvar — antes do prazo', () => {
  it('cria: contador, participant e tipo', () => {
    const p = planejarSalvar(estado(), input(), AGORA)
    expect(p).toMatchObject({ tipo: 'criar', qty: 2, ativas: 1, contador: { reservado: 2 } })
  })
  it('edita para mais: delta aplicado e participant intacto', () => {
    const p = planejarSalvar(estado({ need: need({ reservado: 2 }), pledge: pledge(), ativas: 1 }), input({ qty: 4 }), AGORA)
    expect(p).toMatchObject({ tipo: 'editar', ativas: null, contador: { reservado: 4 } })
  })
  it('só devolverAoFinal: sem escrever need', () => {
    const p = planejarSalvar(
      estado({ need: need({ reservado: 2 }), pledge: pledge(), ativas: 1 }),
      input({ devolverAoFinal: true }),
      AGORA,
    )
    expect(p).toMatchObject({ tipo: 'so-detalhe', contador: null })
  })
  it('esgotado informa quanto resta', () => {
    const e = estado({ need: need({ reservado: 11 }) })
    expect(codigo(() => planejarSalvar(e, input({ qty: 2 }), AGORA))).toBe('esgotado')
    try {
      planejarSalvar(e, input({ qty: 2 }), AGORA)
    } catch (x) {
      expect((x as PledgeError).detalhe).toBe(1)
    }
  })
  it('última unidade: 1 ok, 2 esgotado; editar considera a própria qty', () => {
    const e = estado({ need: need({ reservado: 11 }) })
    expect(planejarSalvar(e, input({ qty: 1 }), AGORA).tipo).toBe('criar')
    const meu = estado({ need: need({ reservado: 12 }), pledge: pledge({ qty: 2 }), ativas: 1 })
    expect(planejarSalvar(meu, input({ qty: 2, devolverAoFinal: true }), AGORA).tipo).toBe('so-detalhe')
    expect(codigo(() => planejarSalvar(meu, input({ qty: 3 }), AGORA))).toBe('esgotado')
  })
  it.each([
    ['0', 0], ['negativa', -1], ['fracionária', 1.5], ['acima do max', 5],
  ])('quantidade %s inválida', (_n, qty) => {
    expect(codigo(() => planejarSalvar(estado(), input({ qty }), AGORA))).toBe('quantidade-invalida')
  })
  it('respeita minPorPessoa', () => {
    const e = estado({ need: need({ minPorPessoa: 3 }) })
    expect(codigo(() => planejarSalvar(e, input({ qty: 2 }), AGORA))).toBe('quantidade-invalida')
  })
  it('limite de itens por pessoa só vale para nova pledge', () => {
    expect(codigo(() => planejarSalvar(estado({ ativas: 2 }), input(), AGORA))).toBe('limite-itens')
    const edita = estado({ ativas: 2, need: need({ reservado: 2 }), pledge: pledge() })
    expect(planejarSalvar(edita, input({ qty: 3 }), AGORA).tipo).toBe('editar')
  })
  it('bloqueado: não cria nem aumenta, pode reduzir', () => {
    expect(codigo(() => planejarSalvar(estado({ bloqueado: true }), input(), AGORA))).toBe('bloqueado')
    const base = estado({ bloqueado: true, need: need({ reservado: 3 }), pledge: pledge({ qty: 3 }), ativas: 1 })
    expect(codigo(() => planejarSalvar(base, input({ qty: 4 }), AGORA))).toBe('bloqueado')
    expect(planejarSalvar(base, input({ qty: 1 }), AGORA).tipo).toBe('editar')
  })
  it('evento fechado/encerrado', () => {
    expect(codigo(() => planejarSalvar(estado({ evento: evento({ status: 'fechado' }) }), input(), AGORA))).toBe('evento-fechado')
    const enc = evento({ prazoContribuicoes: h(-5), inicio: h(-1) })
    expect(codigo(() => planejarSalvar(estado({ evento: enc }), input(), AGORA))).toBe('evento-encerrado')
  })
})

describe('planejarSalvar — opções e "Outro"', () => {
  const e = (over: Partial<Need> = {}) => estado({ need: comOpcoes(over) })
  it('exige exatamente uma escolha', () => {
    expect(codigo(() => planejarSalvar(e(), input(), AGORA))).toBe('opcao-invalida')
    expect(codigo(() => planejarSalvar(e({ permiteOutro: true }), input({ opcao: 'Uva', textoOutro: 'Caju' }), AGORA))).toBe('opcao-invalida')
  })
  it('opção fora da lista inválida; válida ok', () => {
    expect(codigo(() => planejarSalvar(e(), input({ opcao: 'Caju' }), AGORA))).toBe('opcao-invalida')
    expect(planejarSalvar(e(), input({ opcao: 'Uva' }), AGORA).contador?.reservadoPorOpcao.Uva).toBe(2)
  })
  it('Outro só com permiteOutro', () => {
    expect(codigo(() => planejarSalvar(e(), input({ textoOutro: 'Caju' }), AGORA))).toBe('opcao-invalida')
    expect(planejarSalvar(e({ permiteOutro: true }), input({ textoOutro: 'Caju' }), AGORA).opcao).toBeNull()
  })
  it.each(['guarana antarctica', 'GUARANÁ ANTARCTICA', '  Guaraná Antarctica  '])(
    'Outro duplicado "%s" sugere a opção existente',
    (t) => {
      try {
        planejarSalvar(e({ permiteOutro: true }), input({ textoOutro: t }), AGORA)
        expect.unreachable()
      } catch (x) {
        expect((x as PledgeError).code).toBe('outro-duplicado')
        expect((x as PledgeError).detalhe).toBe('Guaraná Antarctica')
      }
    },
  )
  it('textoOutro: máx. 40 caracteres e é aparado', () => {
    const n = e({ permiteOutro: true })
    expect(codigo(() => planejarSalvar(n, input({ textoOutro: 'x'.repeat(41) }), AGORA))).toBe('opcao-invalida')
    expect(planejarSalvar(n, input({ textoOutro: '  Caju  ' }), AGORA).textoOutro).toBe('Caju')
  })
  it('sem opções: opção negada; texto opcional só com permiteOutro', () => {
    expect(codigo(() => planejarSalvar(estado(), input({ opcao: 'Uva' }), AGORA))).toBe('opcao-invalida')
    expect(codigo(() => planejarSalvar(estado(), input({ textoOutro: 'x' }), AGORA))).toBe('opcao-invalida')
    expect(planejarSalvar(estado({ need: need({ permiteOutro: true }) }), input({ textoOutro: 'coxinha' }), AGORA).tipo).toBe('criar')
  })
  it('maxPorOpcao: no limite ok, +1 vira opcao-esgotada; trocar sabor desconta o próprio', () => {
    const cheio = e({ reservado: 3, reservadoPorOpcao: { Uva: 3, 'Guaraná Antarctica': 0 } })
    expect(planejarSalvar(cheio, input({ qty: 1, opcao: 'Uva' }), AGORA).tipo).toBe('criar')
    expect(codigo(() => planejarSalvar(cheio, input({ qty: 2, opcao: 'Uva' }), AGORA))).toBe('opcao-esgotada')
    const meu = estado({
      need: comOpcoes({ reservado: 4, reservadoPorOpcao: { Uva: 4, 'Guaraná Antarctica': 0 } }),
      pledge: pledge({ qty: 4, opcao: 'Uva' }), ativas: 1,
    })
    expect(planejarSalvar(meu, input({ qty: 4, opcao: 'Guaraná Antarctica' }), AGORA).contador).toEqual({
      reservado: 4, reservadoPorOpcao: { Uva: 0, 'Guaraná Antarctica': 4 },
    })
    expect(planejarSalvar(meu, input({ qty: 3, opcao: 'Uva' }), AGORA).tipo).toBe('editar')
  })
})

describe('planejarSalvar — pós-prazo', () => {
  const pos = evento({ prazoContribuicoes: h(-1) })
  const meu = (over: Partial<Pledge> = {}) =>
    estado({ evento: pos, need: need({ reservado: 3 }), pledge: pledge({ qty: 3, ...over }), ativas: 1 })
  it('nova pledge e aumento negados', () => {
    expect(codigo(() => planejarSalvar(estado({ evento: pos }), input(), AGORA))).toBe('prazo')
    expect(codigo(() => planejarSalvar(meu(), input({ qty: 4 }), AGORA))).toBe('prazo')
  })
  it('trocar opção/texto negado', () => {
    expect(codigo(() => planejarSalvar(meu(), input({ qty: 2, opcao: 'Uva' }), AGORA))).toBe('prazo')
  })
  it('reduzir devolve unidades liberadas (log) e não mexe no participant', () => {
    const p = planejarSalvar(meu(), input({ qty: 1 }), AGORA)
    expect(p).toMatchObject({ tipo: 'reduzir-tardio', liberada: 2, ativas: null, contador: { reservado: 1 } })
  })
  it('reduzir abaixo do mínimo negado', () => {
    const e = estado({ evento: pos, need: need({ reservado: 3, minPorPessoa: 2 }), pledge: pledge({ qty: 3 }), ativas: 1 })
    expect(codigo(() => planejarSalvar(e, input({ qty: 1 }), AGORA))).toBe('quantidade-invalida')
  })
  it('devolverAoFinal segue permitido', () => {
    expect(planejarSalvar(meu(), input({ qty: 3, devolverAoFinal: true }), AGORA).tipo).toBe('so-detalhe')
  })
})

describe('planejarCancelar', () => {
  const base = estado({ need: need({ reservado: 5 }), pledge: pledge({ qty: 2 }), ativas: 2 })
  it('antes do prazo: sem log', () => {
    expect(planejarCancelar(base, AGORA)).toMatchObject({ contador: { reservado: 3 }, ativas: 1, liberada: null })
  })
  it('pós-prazo: log com a qty liberada', () => {
    const e = { ...base, evento: evento({ prazoContribuicoes: h(-1) }) }
    expect(planejarCancelar(e, AGORA).liberada).toBe(2)
  })
  it('admin: sem prazos nem log, mesmo pós-início', () => {
    const e = { ...base, evento: evento({ prazoContribuicoes: h(-5), inicio: h(-1) }) }
    expect(planejarCancelar(e, AGORA, { porAdmin: true })).toMatchObject({ liberada: null, ativas: 1 })
    expect(codigo(() => planejarCancelar(e, AGORA))).toBe('evento-encerrado')
  })
  it('sem pledge ⇒ inexistente; ativas nunca < 0', () => {
    expect(codigo(() => planejarCancelar(estado(), AGORA))).toBe('inexistente')
    expect(planejarCancelar({ ...base, ativas: 0 }, AGORA).ativas).toBe(0)
  })
})

describe('diagnosticarNegado (após permission-denied)', () => {
  it('esgotou enquanto a pessoa decidia', () => {
    const e = estado({ need: need({ reservado: 12 }) })
    expect(diagnosticarNegado(e, { tipo: 'salvar', input: input() }, AGORA).code).toBe('esgotado')
  })
  it('prazo venceu', () => {
    const e = estado({ evento: evento({ prazoContribuicoes: h(-1) }) })
    expect(diagnosticarNegado(e, { tipo: 'salvar', input: input() }, AGORA).code).toBe('prazo')
  })
  it('limite de itens', () => {
    expect(diagnosticarNegado(estado({ ativas: 2 }), { tipo: 'salvar', input: input() }, AGORA).code).toBe('limite-itens')
  })
  it('bloqueado', () => {
    expect(diagnosticarNegado(estado({ bloqueado: true }), { tipo: 'salvar', input: input() }, AGORA).code).toBe('bloqueado')
  })
  it('estado ok mas negado ⇒ permissao genérica', () => {
    expect(diagnosticarNegado(estado(), { tipo: 'salvar', input: input() }, AGORA).code).toBe('permissao')
  })
  it('cancelar após início', () => {
    const e = estado({ pledge: pledge(), evento: evento({ prazoContribuicoes: h(-5), inicio: h(-1) }) })
    expect(diagnosticarNegado(e, { tipo: 'cancelar' }, AGORA).code).toBe('evento-encerrado')
  })
})

describe('traduzirErroSdk', () => {
  const sdk = (code: string) => traduzirErroSdk({ code })
  it('concorrência → mensagem da correção 9', () => {
    for (const c of ['aborted', 'failed-precondition', 'firestore/aborted']) {
      expect(sdk(c).code).toBe('concorrencia')
    }
    expect(sdk('aborted').message).toBe('Muita gente ao mesmo tempo — tentar de novo.')
    expect(sdk('aborted').podeTentarDeNovo).toBe(true)
  })
  it('rede, auth, permissão e desconhecido', () => {
    expect(sdk('unavailable').code).toBe('rede')
    expect(sdk('unauthenticated').code).toBe('nao-logado')
    expect(sdk('permission-denied').code).toBe('permissao')
    expect(traduzirErroSdk(new Error('x')).code).toBe('desconhecido')
    expect(traduzirErroSdk(null).code).toBe('desconhecido')
  })
  it('PledgeError passa direto', () => {
    const e = new PledgeError('prazo', 'x')
    expect(traduzirErroSdk(e)).toBe(e)
  })
})
