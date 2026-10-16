import { MAX_OPCOES, NOME_FALLBACK, TIMEZONE } from '@/config/constants'

/**
 * Espelha `nomeEsperado()` das Security Rules: 1º token do nome do Google
 * (trim), 1–40 caracteres; senão "Participante". Mantida em paridade por teste.
 */
export function primeiroNome(nome: string | null | undefined): string {
  const n = (nome ?? '').trim().split(' ')[0] ?? ''
  return n.length >= 1 && n.length <= 40 ? n : NOME_FALLBACK
}

/**
 * Espelha `norm()` das rules: lower + trim + acentos pt-BR removidos.
 * Pontuação e espaços internos NÃO são normalizados (limite conhecido).
 */
export function norm(texto: string): string {
  return texto
    .toLowerCase()
    .trim()
    .replace(/[áàâãä]/g, 'a')
    .replace(/[éèêë]/g, 'e')
    .replace(/[íìîï]/g, 'i')
    .replace(/[óòôõö]/g, 'o')
    .replace(/[úùûü]/g, 'u')
    .replace(/ç/g, 'c')
    .replace(/ñ/g, 'n')
}

export function normOpcoes(opcoes: string[]): string[] {
  return opcoes.slice(0, MAX_OPCOES).map(norm)
}

const dataHora = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TIMEZONE,
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export function formatDataHora(d: Date): string {
  return dataHora.format(d)
}

// Fortaleza não tem horário de verão: UTC−3 fixo. Os inputs `datetime-local` do
// admin são sempre interpretados nesse fuso, qualquer que seja o do navegador.
const OFFSET_FORTALEZA_MS = 3 * 3600_000

/** `Date` → valor de `<input type="datetime-local">` (AAAA-MM-DDTHH:mm) em Fortaleza. */
export function paraInputFortaleza(d: Date): string {
  return new Date(d.getTime() - OFFSET_FORTALEZA_MS).toISOString().slice(0, 16)
}

/** Valor de `<input type="datetime-local">` (interpretado em Fortaleza) → `Date`; `null` se inválido. */
export function deInputFortaleza(valor: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(valor)) return null
  const d = new Date(`${valor}:00Z`)
  if (Number.isNaN(d.getTime())) return null
  return new Date(d.getTime() + OFFSET_FORTALEZA_MS)
}
