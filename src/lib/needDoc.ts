import { normOpcoes, norm } from '@/lib/format'
import type { NeedBase } from '@/lib/needForm'
import type { Need } from '@/lib/types'

/** Construção pura dos documentos de need (sem Firebase): fácil de testar contra o que as rules esperam. */

/** Documento exato que as rules esperam para uma need nova (contadores zerados). */
export function needDoc(t: NeedBase, ordem: number) {
  return {
    nome: t.nome,
    categoria: t.categoria,
    unidade: t.unidade,
    meta: t.meta,
    reservado: 0,
    minPorPessoa: t.minPorPessoa,
    maxPorPessoa: t.maxPorPessoa,
    opcoes: t.opcoes,
    opcoesNorm: normOpcoes(t.opcoes),
    maxPorOpcao: t.maxPorOpcao,
    reservadoPorOpcao: Object.fromEntries(t.opcoes.map((o) => [o, 0])),
    permiteOutro: t.permiteOutro,
    nota: t.nota,
    tags: t.tags,
    ordem,
    ultimoUid: null,
  }
}

/** Id da need: slug do nome (só `a-z0-9-`, sem `_`, que separa needId e uid no id da pledge). */
export function gerarIdNeed(nome: string, existentes: ReadonlySet<string>): string {
  const base =
    norm(nome)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 30)
      .replace(/-+$/g, '') || 'item'
  if (!existentes.has(base)) return base
  for (let i = 2; ; i++) {
    const id = `${base}-${i}`
    if (!existentes.has(id)) return id
  }
}

/** `ordem` de um item novo: depois de todos os existentes. */
export const proximaOrdem = (needs: readonly Need[]): number => needs.reduce((m, n) => Math.max(m, n.ordem), 0) + 1

/** Um campo a gravar: caminho (`['nota']` ou `['reservadoPorOpcao', 'Caju']`) e valor. */
export type Campo = [caminho: string[], valor: unknown]

const mesmaLista = (a: readonly unknown[], b: readonly unknown[]) => a.length === b.length && a.every((x, i) => x === b[i])

/**
 * Só o que mudou, para não sobrescrever o trabalho de outro admin. **Nunca** inclui
 * `reservado` nem `ultimoUid`. Sabores:
 * - sem reservas (`reservado == 0`): regrava o mapa de contadores todo (tudo zero);
 * - com reservas: só cria a chave dos sabores novos (caminho aninhado), sem tocar nos contadores existentes.
 */
export function camposAlterados(atual: Need, novo: NeedBase): Campo[] {
  const campos: Campo[] = []
  const escalares = [
    'nome',
    'categoria',
    'unidade',
    'meta',
    'minPorPessoa',
    'maxPorPessoa',
    'maxPorOpcao',
    'permiteOutro',
    'nota',
  ] as const
  for (const k of escalares) if (atual[k] !== novo[k]) campos.push([[k], novo[k]])

  if (!mesmaLista([...atual.tags].sort(), [...novo.tags].sort())) campos.push([['tags'], novo.tags])

  if (!mesmaLista(atual.opcoes, novo.opcoes)) {
    campos.push([['opcoes'], novo.opcoes], [['opcoesNorm'], normOpcoes(novo.opcoes)])
    if (atual.reservado === 0) {
      campos.push([['reservadoPorOpcao'], Object.fromEntries(novo.opcoes.map((o) => [o, 0]))])
    } else {
      for (const o of novo.opcoes.slice(atual.opcoes.length)) campos.push([['reservadoPorOpcao', o], 0])
    }
  }
  return campos
}

/**
 * Divide a edição em escritas na ordem certa. Com reservas, as rules aceitam **uma opção nova por
 * escrita** (limite de expressões); então cada sabor novo, menos o último, vira uma escrita só com o
 * acréscimo (item continua válido: só cresce o nº de sabores), e a última leva o último sabor
 * junto com os demais campos. Sem reservas, ou com no máximo 1 sabor novo, é uma escrita só.
 */
export function planoEscritas(atual: Need, novo: NeedBase): Campo[][] {
  const novas = Math.max(novo.opcoes.length - atual.opcoes.length, 0)
  const etapas: Campo[][] = []
  let parcial: Need = atual
  if (atual.reservado > 0 && novas > 1) {
    for (let i = 0; i < novas - 1; i++) {
      const opcao = novo.opcoes[atual.opcoes.length + i]!
      const opcoes = [...parcial.opcoes, opcao]
      etapas.push(camposAlterados(parcial, { ...parcial, opcoes }))
      parcial = { ...parcial, opcoes, opcoesNorm: normOpcoes(opcoes), reservadoPorOpcao: { ...parcial.reservadoPorOpcao, [opcao]: 0 } }
    }
  }
  const final = camposAlterados(parcial, novo)
  if (final.length > 0) etapas.push(final)
  return etapas
}

export interface TrocaOrdem {
  id: string
  ordem: number
}

/**
 * Sobe (`-1`) ou desce (`+1`) um item dentro da sua categoria trocando `ordem` com o vizinho.
 * Devolve as duas gravações (ou `[]` se já está na ponta). `daCategoria` = itens da mesma categoria.
 */
export function planoMover(daCategoria: readonly Need[], id: string, dir: -1 | 1): TrocaOrdem[] {
  const lista = [...daCategoria].sort((a, b) => a.ordem - b.ordem || a.id.localeCompare(b.id))
  const i = lista.findIndex((n) => n.id === id)
  const j = i + dir
  const a = lista[i]
  const b = lista[j]
  if (!a || !b) return []
  // `ordem` repetida (não deveria acontecer): só desempata, para a troca ter efeito
  if (a.ordem === b.ordem) return [{ id: a.id, ordem: b.ordem + dir }]
  return [
    { id: a.id, ordem: b.ordem },
    { id: b.id, ordem: a.ordem },
  ]
}
