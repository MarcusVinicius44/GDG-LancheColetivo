export const TIMEZONE = 'America/Fortaleza'

export const CATEGORIAS = [
  'Bebidas',
  'Salgados',
  'Doces',
  'Pães & Frios',
  'Café & Cia',
  'Descartáveis',
  'Diversos',
] as const
export type Categoria = (typeof CATEGORIAS)[number]

export const TAGS = ['vegano', 'sem-gluten', 'sem-lactose'] as const
export type Tag = (typeof TAGS)[number]

export const EVENT_STATUS = ['rascunho', 'aberto', 'fechado'] as const
export type EventStatus = (typeof EVENT_STATUS)[number]

export const MAX_OPCOES = 12
export const MAX_TEXTO_OUTRO = 40
export const NOME_FALLBACK = 'Participante'
