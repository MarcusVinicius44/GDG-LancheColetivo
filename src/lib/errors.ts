/** Erros de domínio do fluxo de pledges, sempre com mensagem pronta em pt-BR. */
export type PledgeErrorCode =
  | 'esgotado'
  | 'opcao-esgotada'
  | 'outro-duplicado'
  | 'quantidade-invalida'
  | 'opcao-invalida'
  | 'prazo'
  | 'evento-encerrado'
  | 'evento-fechado'
  | 'limite-itens'
  | 'bloqueado'
  | 'nao-logado'
  | 'inexistente'
  | 'concorrencia'
  | 'permissao'
  | 'rede'
  | 'desconhecido'

export class PledgeError extends Error {
  readonly code: PledgeErrorCode
  /** Dica para a UI (ex.: opção existente que deve ser selecionada, ou unidades restantes). */
  readonly detalhe?: string | number

  constructor(code: PledgeErrorCode, message: string, detalhe?: string | number) {
    super(message)
    this.name = 'PledgeError'
    this.code = code
    this.detalhe = detalhe
  }

  /** Vale oferecer o botão "Tentar de novo"? */
  get podeTentarDeNovo(): boolean {
    return this.code === 'concorrencia' || this.code === 'rede' || this.code === 'desconhecido'
  }
}

export const MENSAGENS: Record<PledgeErrorCode, string> = {
  esgotado: 'Esse item já foi todo reservado. Escolha outro ou veja o que ainda falta.',
  'opcao-esgotada': 'Esse sabor já atingiu o limite. Escolha outro sabor.',
  'outro-duplicado': 'Essa opção já existe na lista. Selecione-a em vez de digitar.',
  'quantidade-invalida': 'Quantidade fora do permitido para esse item.',
  'opcao-invalida': 'Escolha uma das opções da lista.',
  prazo: 'O prazo para novas contribuições terminou. Agora só é possível reduzir ou cancelar.',
  'evento-encerrado': 'O evento já começou: as contribuições não podem mais ser alteradas.',
  'evento-fechado': 'Esse evento não está aberto para contribuições.',
  'limite-itens': 'Você atingiu o limite de itens por pessoa neste evento.',
  bloqueado: 'Sua conta não pode fazer novas contribuições. Fale com a organização.',
  'nao-logado': 'Entre com sua conta Google para contribuir.',
  inexistente: 'Não encontramos esse item. Atualize a página.',
  concorrencia: 'Muita gente ao mesmo tempo — tentar de novo.',
  permissao: 'Não foi possível salvar. Atualize a página e tente de novo.',
  rede: 'Sem conexão no momento. Verifique a internet e tente de novo.',
  desconhecido: 'Algo deu errado. Tente de novo.',
}

export const erro = (code: PledgeErrorCode, detalhe?: string | number) =>
  new PledgeError(code, MENSAGENS[code], detalhe)

/** Código do SDK (`failed-precondition`, `permission-denied`…) → código de domínio genérico. */
export function codigoDoSdk(e: unknown): string | undefined {
  const c = (e as { code?: unknown } | null)?.code
  return typeof c === 'string' ? c.replace(/^firestore\//, '') : undefined
}

/**
 * Mensagem em pt-BR para falhas das ações de organização (itens, categorias, evento).
 * Erros de domínio já escritos em pt-BR (`Error` sem código do SDK) passam como estão.
 */
export function mensagemErroAdmin(e: unknown): string {
  switch (codigoDoSdk(e)) {
    case 'permission-denied':
      return 'O servidor recusou a alteração. Isso costuma acontecer quando alguém acabou de contribuir neste item ou outro organizador mexeu nele. Atualize a página e tente de novo.'
    case 'aborted':
    case 'failed-precondition':
      return MENSAGENS.concorrencia
    case 'unavailable':
    case 'deadline-exceeded':
    case 'cancelled':
      return MENSAGENS.rede
    case 'unauthenticated':
      return MENSAGENS['nao-logado']
    case undefined:
      return e instanceof Error && e.message ? e.message : MENSAGENS.desconhecido
    default:
      return MENSAGENS.desconhecido
  }
}

/** Mapeamento sem diagnóstico (quando não dá para reler o estado). */
export function traduzirErroSdk(e: unknown): PledgeError {
  if (e instanceof PledgeError) return e
  switch (codigoDoSdk(e)) {
    case 'aborted':
    case 'failed-precondition':
    case 'resource-exhausted':
      return erro('concorrencia')
    case 'unavailable':
    case 'deadline-exceeded':
    case 'cancelled':
      return erro('rede')
    case 'permission-denied':
      return erro('permissao')
    case 'unauthenticated':
      return erro('nao-logado')
    default:
      return erro('desconhecido')
  }
}
