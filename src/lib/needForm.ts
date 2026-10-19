import { MAX_OPCOES, MAX_TAGS, TAGS, type Tag } from '@/config/constants'
import { norm } from '@/lib/format'
import type { Need, Pledge } from '@/lib/types'

/**
 * Formulário de item (need) do admin: valida em pt-BR o que as Security Rules exigem
 * (`needValida`/`needConfigOk`) e, com contribuições, também o que as rules NÃO
 * conseguem checar por não varrerem pledges (min/máx por pessoa, máx. por sabor).
 * Puro: sem Firebase.
 */

export const LIMITES = { nome: 80, unidade: 40, nota: 200, opcao: 40, metaMax: 5000 } as const

/** Campos editáveis, como digitados (números vazios ou inválidos viram `null`/`NaN`). */
export interface NeedForm {
  nome: string
  categoria: string
  unidade: string
  meta: number | null
  minPorPessoa: number | null
  maxPorPessoa: number | null
  opcoes: string[]
  /** `null` = sem limite por sabor. */
  maxPorOpcao: number | null
  permiteOutro: boolean
  nota: string
  tags: Tag[]
}

/** Os mesmos campos já validados (números de verdade). */
export type NeedBase = Pick<
  Need,
  | 'nome'
  | 'categoria'
  | 'unidade'
  | 'meta'
  | 'minPorPessoa'
  | 'maxPorPessoa'
  | 'opcoes'
  | 'maxPorOpcao'
  | 'permiteOutro'
  | 'nota'
  | 'tags'
>

export type CampoNeed =
  | 'nome'
  | 'categoria'
  | 'unidade'
  | 'meta'
  | 'minPorPessoa'
  | 'maxPorPessoa'
  | 'opcoes'
  | 'maxPorOpcao'
  | 'nota'
  | 'tags'
export type ErrosNeed = Partial<Record<CampoNeed, string>>

export const formVazio = (categoria: string): NeedForm => ({
  nome: '',
  categoria,
  unidade: '',
  meta: null,
  minPorPessoa: 1,
  maxPorPessoa: null,
  opcoes: [],
  maxPorOpcao: null,
  permiteOutro: false,
  nota: '',
  tags: [],
})

export const formDe = (n: Need): NeedForm => ({
  nome: n.nome,
  categoria: n.categoria,
  unidade: n.unidade,
  meta: n.meta,
  minPorPessoa: n.minPorPessoa,
  maxPorPessoa: n.maxPorPessoa,
  opcoes: [...n.opcoes],
  maxPorOpcao: n.maxPorOpcao,
  permiteOutro: n.permiteOutro,
  nota: n.nota,
  tags: [...n.tags],
})

/** Tira espaços das pontas; sem sabores, o limite por sabor não faz sentido. */
export function normalizar(f: NeedForm): NeedForm {
  const opcoes = f.opcoes.map((o) => o.trim())
  return {
    ...f,
    nome: f.nome.trim(),
    unidade: f.unidade.trim(),
    nota: f.nota.trim(),
    opcoes,
    maxPorOpcao: opcoes.length === 0 ? null : f.maxPorOpcao,
  }
}

const inteiro = (v: number | null): v is number => v !== null && Number.isInteger(v)

export interface ContextoNeed {
  /** Item sendo editado; `null` ao criar. */
  atual: Need | null
  /** Contribuições deste item (vazio ao criar). */
  pledges: Pledge[]
  /** Categorias do evento. */
  categorias: readonly string[]
  /** Nomes dos OUTROS itens do evento (evita duplicata). */
  outrosNomes: readonly string[]
}

/** Erros por campo (vazio = pode salvar). A entrada é normalizada antes de validar. */
export function validarNeed(entrada: NeedForm, ctx: ContextoNeed): ErrosNeed {
  const f = normalizar(entrada)
  const { atual, pledges } = ctx
  const e: ErrosNeed = {}
  const reservado = atual?.reservado ?? 0

  // --- nome, categoria, unidade, nota
  if (f.nome.length < 1) e.nome = 'Informe o nome do item.'
  else if (f.nome.length > LIMITES.nome) e.nome = `Use no máximo ${LIMITES.nome} caracteres.`
  else if (ctx.outrosNomes.some((n) => norm(n) === norm(f.nome))) e.nome = 'Já existe um item com esse nome.'

  if (!ctx.categorias.includes(f.categoria)) e.categoria = 'Escolha uma categoria que exista neste evento.'

  if (f.unidade.length < 1) e.unidade = 'Informe a unidade (ex.: garrafa 2L, pacote, unidade).'
  else if (f.unidade.length > LIMITES.unidade) e.unidade = `Use no máximo ${LIMITES.unidade} caracteres.`

  if (f.nota.length > LIMITES.nota) e.nota = `Use no máximo ${LIMITES.nota} caracteres.`

  // --- meta
  if (!inteiro(f.meta)) e.meta = 'Informe a meta como número inteiro.'
  else if (f.meta < 1 || f.meta > LIMITES.metaMax) e.meta = `A meta deve ficar entre 1 e ${LIMITES.metaMax}.`
  else if (f.meta < reservado) {
    e.meta = `Já há ${reservado} reservado(s); a meta não pode ser menor que isso.`
  }

  // --- quantidade por pessoa
  if (!inteiro(f.minPorPessoa) || f.minPorPessoa < 1) e.minPorPessoa = 'Informe um mínimo inteiro, de pelo menos 1.'
  if (!inteiro(f.maxPorPessoa) || f.maxPorPessoa < 1) e.maxPorPessoa = 'Informe um máximo inteiro, de pelo menos 1.'
  if (!e.minPorPessoa && !e.maxPorPessoa && inteiro(f.minPorPessoa) && inteiro(f.maxPorPessoa)) {
    if (f.maxPorPessoa < f.minPorPessoa) e.maxPorPessoa = 'O máximo não pode ser menor que o mínimo.'
    else if (inteiro(f.meta) && f.minPorPessoa > f.meta) {
      e.minPorPessoa = 'O mínimo por pessoa não pode passar da meta (ninguém conseguiria contribuir).'
    }
  }
  if (pledges.length > 0) {
    const qtys = pledges.map((p) => p.qty)
    const menor = Math.min(...qtys)
    const maior = Math.max(...qtys)
    if (!e.minPorPessoa && inteiro(f.minPorPessoa) && f.minPorPessoa > menor) {
      e.minPorPessoa = `Já há contribuição de ${menor}; o mínimo não pode ser maior que isso.`
    }
    if (!e.maxPorPessoa && inteiro(f.maxPorPessoa) && f.maxPorPessoa < maior) {
      e.maxPorPessoa = `Já há contribuição de ${maior}; o máximo não pode ser menor que isso.`
    }
  }

  // --- sabores/marcas
  if (f.opcoes.length > MAX_OPCOES) e.opcoes = `No máximo ${MAX_OPCOES} sabores/marcas.`
  else if (f.opcoes.some((o) => o.length < 1)) e.opcoes = 'Há um sabor/marca em branco. Preencha ou remova.'
  else if (f.opcoes.some((o) => o.length > LIMITES.opcao)) e.opcoes = `Cada sabor/marca tem no máximo ${LIMITES.opcao} caracteres.`
  else if (new Set(f.opcoes.map(norm)).size !== f.opcoes.length) {
    e.opcoes = 'Há sabores/marcas repetidos (maiúsculas e acentos não diferenciam).'
  } else if (atual && reservado > 0 && !atual.opcoes.every((o, i) => f.opcoes[i] === o)) {
    e.opcoes =
      'Este item já tem contribuições: os sabores existentes não podem ser removidos, renomeados nem reordenados. Só dá para acrescentar novos no fim.'
  } else if (atual && atual.opcoes.length === 0 && f.opcoes.length > 0 && pledges.some((p) => p.opcao === null && p.textoOutro === null)) {
    e.opcoes = 'Este item já tem contribuições sem sabor, então não dá para passar a ter sabores. Remova-as antes em “Contribuições”.'
  }

  // --- "Outro"
  if (!f.permiteOutro && pledges.some((p) => p.textoOutro !== null)) {
    const n = pledges.filter((p) => p.textoOutro !== null).length
    e.opcoes ??= `${n} pessoa(s) já escolheram “Outro”: mantenha “Aceita Outro” ligado ou remova essas contribuições antes.`
  }

  // --- limite por sabor
  if (f.maxPorOpcao !== null) {
    if (!inteiro(f.maxPorOpcao) || f.maxPorOpcao < 1) {
      e.maxPorOpcao = 'Informe o limite por sabor como número inteiro, de pelo menos 1 (ou deixe vazio para sem limite).'
    } else {
      const cheia = atual ? Object.entries(atual.reservadoPorOpcao).find(([, c]) => c > (f.maxPorOpcao as number)) : undefined
      if (cheia) e.maxPorOpcao = `Já há ${cheia[1]} de “${cheia[0]}”; o limite por sabor não pode ser menor que isso.`
      else if (!f.permiteOutro && f.opcoes.length > 0 && inteiro(f.meta) && f.opcoes.length * f.maxPorOpcao < f.meta) {
        e.maxPorOpcao =
          `${f.opcoes.length} sabor(es) × limite ${f.maxPorOpcao} = ${f.opcoes.length * f.maxPorOpcao}, ` +
          `que não comporta a meta de ${f.meta}. Aumente o limite, acrescente sabores ou ligue “Aceita Outro”.`
      }
    }
  }

  // --- etiquetas
  const tagsUnicas = new Set(f.tags)
  if (f.tags.some((t) => !(TAGS as readonly string[]).includes(t))) e.tags = 'Etiqueta desconhecida.'
  else if (tagsUnicas.size !== f.tags.length || tagsUnicas.size > MAX_TAGS) e.tags = `No máximo ${MAX_TAGS} etiquetas, sem repetir.`

  return e
}

export const temErros = (e: ErrosNeed) => Object.keys(e).length > 0

/** Formulário válido → campos com tipo numérico; `null` se faltar algum número. */
export function paraBase(entrada: NeedForm): NeedBase | null {
  const f = normalizar(entrada)
  if (!inteiro(f.meta) || !inteiro(f.minPorPessoa) || !inteiro(f.maxPorPessoa)) return null
  return {
    nome: f.nome,
    categoria: f.categoria,
    unidade: f.unidade,
    meta: f.meta,
    minPorPessoa: f.minPorPessoa,
    maxPorPessoa: f.maxPorPessoa,
    opcoes: f.opcoes,
    maxPorOpcao: f.maxPorOpcao,
    permiteOutro: f.permiteOutro,
    nota: f.nota,
    tags: f.tags,
  }
}

/** Por que um item não pode ser removido (ou `null` se pode). */
export function motivoNaoRemover(n: Need): string | null {
  return n.reservado > 0
    ? `Há ${n.reservado} unidade(s) reservada(s). Remova as contribuições em “Contribuições” para poder apagar o item.`
    : null
}
