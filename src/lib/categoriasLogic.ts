import { MAX_CATEGORIAS, MAX_NOME_CATEGORIA } from '@/config/constants'
import { norm } from '@/lib/format'
import type { Need } from '@/lib/types'

/**
 * Operações puras sobre a lista de categorias de um evento (`Evento.categorias`).
 * Espelham `categoriasOk` das rules: 1–12 nomes únicos de 1–30 caracteres.
 */

/** Mensagem de erro para um nome de categoria, ou `null` se serve. `ignorar` = nome atual ao renomear. */
export function validarNomeCategoria(nome: string, existentes: readonly string[], ignorar?: string): string | null {
  const n = nome.trim()
  if (n.length < 1) return 'Informe o nome da categoria.'
  if (n.length > MAX_NOME_CATEGORIA) return `Use no máximo ${MAX_NOME_CATEGORIA} caracteres.`
  if (existentes.some((c) => c !== ignorar && norm(c) === norm(n))) return 'Já existe uma categoria com esse nome.'
  return null
}

export function adicionar(lista: readonly string[], nome: string): string[] {
  const n = nome.trim()
  const erro = validarNomeCategoria(n, lista)
  if (erro) throw new Error(erro)
  if (lista.length >= MAX_CATEGORIAS) throw new Error(`No máximo ${MAX_CATEGORIAS} categorias por evento.`)
  return [...lista, n]
}

export function mover(lista: readonly string[], nome: string, dir: -1 | 1): string[] {
  const i = lista.indexOf(nome)
  const j = i + dir
  if (i < 0 || j < 0 || j >= lista.length) return [...lista]
  const nova = [...lista]
  ;[nova[i], nova[j]] = [nova[j]!, nova[i]!]
  return nova
}

export function remover(lista: readonly string[], nome: string): string[] {
  if (lista.length <= 1) throw new Error('O evento precisa ter pelo menos uma categoria.')
  return lista.filter((c) => c !== nome)
}

/** Renomear em 3 passos seguros: (1) o nome novo entra logo depois do antigo; (2) migram os itens; (3) o antigo sai. */
export function renomearPasso1(lista: readonly string[], de: string, para: string): string[] {
  const novo = para.trim()
  const erro = validarNomeCategoria(novo, lista, de)
  if (erro) throw new Error(erro)
  if (novo === de) throw new Error('O nome novo é igual ao atual.')
  if (lista.includes(novo)) throw new Error('Já existe uma categoria com esse nome.')
  const i = lista.indexOf(de)
  if (i < 0) throw new Error('Essa categoria não existe mais. Atualize a página.')
  if (lista.length >= MAX_CATEGORIAS) throw new Error(`No máximo ${MAX_CATEGORIAS} categorias por evento.`)
  return [...lista.slice(0, i + 1), novo, ...lista.slice(i + 1)]
}

export const renomearPasso3 = (lista: readonly string[], de: string): string[] => lista.filter((c) => c !== de)

export const itensDaCategoria = (needs: readonly Need[], nome: string): Need[] => needs.filter((n) => n.categoria === nome)

/** Por que a categoria não pode ser removida (ou `null`). Rules recusariam editar itens de categoria que saiu da lista. */
export function motivoNaoRemoverCategoria(needs: readonly Need[], nome: string, total: number): string | null {
  if (total <= 1) return 'O evento precisa ter pelo menos uma categoria.'
  const n = itensDaCategoria(needs, nome).length
  return n > 0 ? `Há ${n} item(ns) nesta categoria. Mova-os para outra categoria ou remova-os antes.` : null
}
