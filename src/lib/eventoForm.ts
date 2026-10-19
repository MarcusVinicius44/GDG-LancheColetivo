import type { Evento, Pledge } from '@/lib/types'

/**
 * Formulário "Dados do evento" do admin. Valida em pt-BR o que `eventoValido` das rules
 * exige (título 1–120, descrição ≤ 2000, local ≤ 200, prazo ≤ início, público 1–1000,
 * itens por pessoa 1–20) e avisa sobre efeitos que as rules deixam passar. Puro.
 */

export const LIMITES_EVENTO = { titulo: 120, descricao: 2000, local: 200, publicoMax: 1000, itensMax: 20 } as const

export interface EventoForm {
  titulo: string
  descricao: string
  local: string
  inicio: Date | null
  prazoContribuicoes: Date | null
  inscritos: number | null
  publicoPlanejado: number | null
  maxNecessidadesPorPessoa: number | null
}

export type CampoEvento = keyof EventoForm
export type ErrosEvento = Partial<Record<CampoEvento, string>>

/** Campos do evento já validados. */
export type EventoBase = {
  titulo: string
  descricao: string
  local: string
  inicio: Date
  prazoContribuicoes: Date
  inscritos: number
  publicoPlanejado: number
  maxNecessidadesPorPessoa: number
}

export const formEventoDe = (e: Evento): EventoForm => ({
  titulo: e.titulo,
  descricao: e.descricao,
  local: e.local,
  inicio: e.inicio,
  prazoContribuicoes: e.prazoContribuicoes,
  inscritos: e.inscritos,
  publicoPlanejado: e.publicoPlanejado,
  maxNecessidadesPorPessoa: e.maxNecessidadesPorPessoa,
})

const inteiro = (v: number | null): v is number => v !== null && Number.isInteger(v)
const valida = (d: Date | null): d is Date => d !== null && !Number.isNaN(d.getTime())

/** Quantas pessoas têm contribuição em mais itens do que `max` (afeta só novas contribuições, mas vale avisar). */
export function pessoasAcimaDoLimite(pledges: readonly Pledge[], max: number): number {
  const porPessoa = new Map<string, number>()
  for (const p of pledges) porPessoa.set(p.uid, (porPessoa.get(p.uid) ?? 0) + 1)
  return [...porPessoa.values()].filter((n) => n > max).length
}

export interface ResultadoEvento {
  erros: ErrosEvento
  /** Não impedem salvar. */
  avisos: string[]
}

export function validarEvento(f: EventoForm, agora: Date, pledges: readonly Pledge[] = []): ResultadoEvento {
  const erros: ErrosEvento = {}
  const avisos: string[] = []

  const titulo = f.titulo.trim()
  if (titulo.length < 1) erros.titulo = 'Informe o título.'
  else if (titulo.length > LIMITES_EVENTO.titulo) erros.titulo = `Use no máximo ${LIMITES_EVENTO.titulo} caracteres.`

  if (f.descricao.trim().length > LIMITES_EVENTO.descricao) {
    erros.descricao = `Use no máximo ${LIMITES_EVENTO.descricao} caracteres.`
  }
  if (f.local.trim().length > LIMITES_EVENTO.local) erros.local = `Use no máximo ${LIMITES_EVENTO.local} caracteres.`

  if (!valida(f.inicio)) erros.inicio = 'Informe data e hora válidas.'
  if (!valida(f.prazoContribuicoes)) erros.prazoContribuicoes = 'Informe data e hora válidas.'
  if (valida(f.inicio) && valida(f.prazoContribuicoes) && f.prazoContribuicoes > f.inicio) {
    erros.prazoContribuicoes = 'O prazo não pode passar do início do evento.'
  }

  if (!inteiro(f.inscritos) || f.inscritos < 0) erros.inscritos = 'Informe um número inteiro, 0 ou mais.'
  if (!inteiro(f.publicoPlanejado) || f.publicoPlanejado < 1 || f.publicoPlanejado > LIMITES_EVENTO.publicoMax) {
    erros.publicoPlanejado = `Informe um número inteiro entre 1 e ${LIMITES_EVENTO.publicoMax}.`
  }
  if (
    !inteiro(f.maxNecessidadesPorPessoa) ||
    f.maxNecessidadesPorPessoa < 1 ||
    f.maxNecessidadesPorPessoa > LIMITES_EVENTO.itensMax
  ) {
    erros.maxNecessidadesPorPessoa = `Informe um número inteiro entre 1 e ${LIMITES_EVENTO.itensMax}.`
  }

  if (valida(f.prazoContribuicoes) && f.prazoContribuicoes <= agora) {
    avisos.push('O prazo já passou: novas contribuições ficam bloqueadas (só dá para reduzir ou cancelar).')
  }
  if (valida(f.inicio) && f.inicio <= agora) {
    avisos.push('O início já passou: ninguém mais consegue alterar contribuições.')
  }
  if (inteiro(f.maxNecessidadesPorPessoa) && !erros.maxNecessidadesPorPessoa) {
    const n = pessoasAcimaDoLimite(pledges, f.maxNecessidadesPorPessoa)
    if (n > 0) {
      avisos.push(`${n} pessoa(s) já contribuem em mais itens que esse limite. Elas mantêm o que escolheram; o limite vale para novas contribuições.`)
    }
  }
  return { erros, avisos }
}

export const temErrosEvento = (e: ErrosEvento) => Object.keys(e).length > 0

/** Formulário válido → campos tipados; `null` se algo faltar. */
export function paraEventoBase(f: EventoForm): EventoBase | null {
  if (!valida(f.inicio) || !valida(f.prazoContribuicoes)) return null
  if (!inteiro(f.inscritos) || !inteiro(f.publicoPlanejado) || !inteiro(f.maxNecessidadesPorPessoa)) return null
  return {
    titulo: f.titulo.trim(),
    descricao: f.descricao.trim(),
    local: f.local.trim(),
    inicio: f.inicio,
    prazoContribuicoes: f.prazoContribuicoes,
    inscritos: f.inscritos,
    publicoPlanejado: f.publicoPlanejado,
    maxNecessidadesPorPessoa: f.maxNecessidadesPorPessoa,
  }
}

/** Só o que mudou (datas comparadas pelo instante). Nunca inclui `status`, `criadoEm` nem `categorias`. */
export function camposEventoAlterados(atual: Evento, novo: EventoBase): Partial<EventoBase> {
  const out: Partial<EventoBase> = {}
  if (atual.titulo !== novo.titulo) out.titulo = novo.titulo
  if (atual.descricao !== novo.descricao) out.descricao = novo.descricao
  if (atual.local !== novo.local) out.local = novo.local
  if (atual.inicio.getTime() !== novo.inicio.getTime()) out.inicio = novo.inicio
  if (atual.prazoContribuicoes.getTime() !== novo.prazoContribuicoes.getTime()) out.prazoContribuicoes = novo.prazoContribuicoes
  if (atual.inscritos !== novo.inscritos) out.inscritos = novo.inscritos
  if (atual.publicoPlanejado !== novo.publicoPlanejado) out.publicoPlanejado = novo.publicoPlanejado
  if (atual.maxNecessidadesPorPessoa !== novo.maxNecessidadesPorPessoa) {
    out.maxNecessidadesPorPessoa = novo.maxNecessidadesPorPessoa
  }
  return out
}
