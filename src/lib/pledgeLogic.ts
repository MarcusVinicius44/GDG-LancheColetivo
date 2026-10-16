import { MAX_TEXTO_OUTRO } from '@/config/constants'
import { erro } from '@/lib/errors'
import { norm } from '@/lib/format'
import type { Contador, Evento, Need, Pledge, PledgeInput } from '@/lib/types'

/**
 * Lógica pura (sem Firebase) que espelha as Security Rules: decide o que a
 * transação deve gravar ou explica, em pt-BR, por que seria negado. As rules
 * continuam sendo a verdade — aqui é só UX e o cálculo dos valores literais.
 */

export interface Estado {
  evento: Evento
  need: Need
  /** pledge atual desta pessoa nesta necessidade, se houver. */
  pledge: Pledge | null
  /** `participants/{uid}.ativas` (0 se não existe). */
  ativas: number
  bloqueado: boolean
}

export type Fase = 'antes-prazo' | 'pos-prazo' | 'encerrado' | 'fechado'

export function faseDoEvento(ev: Evento, agora: Date): Fase {
  if (ev.status !== 'aberto') return 'fechado'
  if (agora >= ev.inicio) return 'encerrado'
  if (agora >= ev.prazoContribuicoes) return 'pos-prazo'
  return 'antes-prazo'
}

interface Posicao {
  qty: number
  opcao: string | null
}

export interface PlanoSalvar {
  tipo: 'criar' | 'editar' | 'reduzir-tardio' | 'so-detalhe'
  qty: number
  opcao: string | null
  textoOutro: string | null
  devolverAoFinal: boolean
  /** `null` ⇒ não escrever a need (contador inalterado). */
  contador: Contador | null
  /** `null` ⇒ não escrever participant. */
  ativas: number | null
  /** unidades liberadas (log de cancelamento tardio), se houver. */
  liberada: number | null
}

export interface PlanoCancelar {
  contador: Contador
  ativas: number
  liberada: number | null
}

/** Valores literais do contador depois de trocar `antes` por `depois`. */
export function novoContador(need: Need, antes: Posicao | null, depois: Posicao | null): Contador {
  const porOpcao = { ...need.reservadoPorOpcao }
  if (antes?.opcao) porOpcao[antes.opcao] = (porOpcao[antes.opcao] ?? 0) - antes.qty
  if (depois?.opcao) porOpcao[depois.opcao] = (porOpcao[depois.opcao] ?? 0) + depois.qty
  return {
    reservado: need.reservado - (antes?.qty ?? 0) + (depois?.qty ?? 0),
    reservadoPorOpcao: porOpcao,
  }
}

function validarEscolha(need: Need, input: PledgeInput): { opcao: string | null; textoOutro: string | null } {
  const { qty } = input
  if (!Number.isInteger(qty) || qty < need.minPorPessoa || qty > need.maxPorPessoa) {
    throw erro('quantidade-invalida')
  }
  const texto = input.textoOutro?.trim() || null
  const opcao = input.opcao || null

  if (texto !== null && (texto.length < 1 || texto.length > MAX_TEXTO_OUTRO)) throw erro('opcao-invalida')

  if (need.opcoes.length > 0) {
    if ((opcao === null) === (texto === null)) throw erro('opcao-invalida') // exatamente um
    if (opcao !== null) {
      if (!need.opcoes.includes(opcao)) throw erro('opcao-invalida')
    } else {
      if (!need.permiteOutro) throw erro('opcao-invalida')
      const i = need.opcoesNorm.indexOf(norm(texto as string))
      if (i >= 0) throw erro('outro-duplicado', need.opcoes[i])
    }
  } else {
    if (opcao !== null) throw erro('opcao-invalida')
    if (texto !== null && !need.permiteOutro) throw erro('opcao-invalida')
  }
  return { opcao, textoOutro: texto }
}

export function planejarSalvar(estado: Estado, input: PledgeInput, agora: Date): PlanoSalvar {
  const { evento, need, pledge, ativas, bloqueado } = estado
  const fase = faseDoEvento(evento, agora)
  if (fase === 'fechado') throw erro('evento-fechado')
  if (fase === 'encerrado') throw erro('evento-encerrado')

  if (fase === 'pos-prazo') {
    // Só reduzir (com log) ou mexer em "devolver ao final".
    if (!pledge) throw erro('prazo')
    const mesmaEscolha =
      (input.opcao || null) === pledge.opcao && (input.textoOutro?.trim() || null) === pledge.textoOutro
    if (!mesmaEscolha || input.qty > pledge.qty) throw erro('prazo')
    if (input.qty === pledge.qty) {
      return {
        tipo: 'so-detalhe',
        qty: pledge.qty,
        opcao: pledge.opcao,
        textoOutro: pledge.textoOutro,
        devolverAoFinal: input.devolverAoFinal,
        contador: null,
        ativas: null,
        liberada: null,
      }
    }
    if (!Number.isInteger(input.qty) || input.qty < need.minPorPessoa) throw erro('quantidade-invalida')
    return {
      tipo: 'reduzir-tardio',
      qty: input.qty,
      opcao: pledge.opcao,
      textoOutro: pledge.textoOutro,
      devolverAoFinal: input.devolverAoFinal,
      contador: novoContador(need, pledge, { qty: input.qty, opcao: pledge.opcao }),
      ativas: null,
      liberada: pledge.qty - input.qty,
    }
  }

  // antes do prazo
  const { opcao, textoOutro } = validarEscolha(need, input)
  const antes: Posicao | null = pledge ? { qty: pledge.qty, opcao: pledge.opcao } : null
  const depois: Posicao = { qty: input.qty, opcao }

  // bloqueado só pode reduzir (mesma opção)
  const reduzSo = antes !== null && depois.qty < antes.qty && depois.opcao === antes.opcao
  if (bloqueado && !reduzSo) throw erro('bloqueado')

  const livre = need.meta - need.reservado + (antes?.qty ?? 0)
  if (depois.qty > livre) throw erro('esgotado', Math.max(livre, 0))

  if (opcao && need.maxPorOpcao !== null) {
    const atual = (need.reservadoPorOpcao[opcao] ?? 0) - (antes?.opcao === opcao ? antes.qty : 0)
    if (atual + depois.qty > need.maxPorOpcao) throw erro('opcao-esgotada', Math.max(need.maxPorOpcao - atual, 0))
  }

  if (!pledge && ativas + 1 > evento.maxNecessidadesPorPessoa) throw erro('limite-itens')

  const escolhaIgual = antes !== null && antes.qty === depois.qty && antes.opcao === depois.opcao
  return {
    tipo: !pledge ? 'criar' : escolhaIgual && textoOutro === pledge.textoOutro ? 'so-detalhe' : 'editar',
    qty: depois.qty,
    opcao,
    textoOutro,
    devolverAoFinal: input.devolverAoFinal,
    // trocar só o texto "Outro" não muda contador: a need não é escrita
    contador: escolhaIgual ? null : novoContador(need, antes, depois),
    ativas: pledge ? null : ativas + 1,
    liberada: null,
  }
}

/** `porAdmin`: remoção de pledge alheia — sem prazos e sem log de cancelamento tardio. */
export function planejarCancelar(
  estado: Estado,
  agora: Date,
  opts: { porAdmin?: boolean } = {},
): PlanoCancelar {
  const { evento, need, pledge, ativas } = estado
  if (!pledge) throw erro('inexistente')
  const fase = faseDoEvento(evento, agora)
  if (!opts.porAdmin) {
    if (fase === 'fechado') throw erro('evento-fechado')
    if (fase === 'encerrado') throw erro('evento-encerrado')
  }
  return {
    contador: novoContador(need, pledge, null),
    ativas: Math.max(ativas - 1, 0),
    liberada: !opts.porAdmin && fase === 'pos-prazo' ? pledge.qty : null,
  }
}

/**
 * Chamado após um `permission-denied`, com o estado relido do servidor:
 * devolve o motivo mais provável (esgotou, prazo, limite, bloqueado…).
 */
export function diagnosticarNegado(
  estado: Estado,
  acao: { tipo: 'salvar'; input: PledgeInput } | { tipo: 'cancelar'; porAdmin?: boolean },
  agora: Date,
) {
  try {
    if (acao.tipo === 'salvar') planejarSalvar(estado, acao.input, agora)
    else planejarCancelar(estado, agora, { porAdmin: acao.porAdmin })
  } catch (e) {
    return e as ReturnType<typeof erro>
  }
  return estado.bloqueado ? erro('bloqueado') : erro('permissao')
}
