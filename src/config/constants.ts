export const TIMEZONE = 'America/Fortaleza'

/**
 * Categorias de um evento sem o campo `categorias` (espelha `categoriasPadrao()` das rules).
 * Cada evento pode ter a sua lista; `Need.categoria` é uma string dessa lista.
 */
export const CATEGORIAS_PADRAO: readonly string[] = [
  'Bebidas',
  'Salgados',
  'Doces',
  'Pães & Frios',
  'Café & Cia',
  'Descartáveis',
  'Diversos',
]
export const MAX_CATEGORIAS = 12
export const MAX_NOME_CATEGORIA = 30

export const TAGS = ['vegano', 'sem-gluten', 'sem-lactose', 'devolver'] as const
export type Tag = (typeof TAGS)[number]
export const MAX_TAGS = 4
export const ROTULO_TAG: Record<Tag, string> = {
  vegano: 'Vegano',
  'sem-gluten': 'Sem glúten',
  'sem-lactose': 'Sem lactose',
  devolver: 'Pode levar de volta no final',
}

export const EVENT_STATUS = ['rascunho', 'aberto', 'fechado'] as const
export type EventStatus = (typeof EVENT_STATUS)[number]

export const MAX_OPCOES = 12
export const MAX_TEXTO_OUTRO = 40
export const NOME_FALLBACK = 'Participante'
