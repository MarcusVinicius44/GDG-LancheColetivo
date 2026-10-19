import { CATEGORIAS_PADRAO } from '@/config/constants'
import type { Need, Pledge } from '@/lib/types'

/** Funções puras de apresentação das necessidades (sem Firebase). */

export const restante = (n: Need) => Math.max(n.meta - n.reservado, 0)
export const completa = (n: Need) => n.reservado >= n.meta
export const percentual = (n: Need) => (n.meta > 0 ? Math.min(Math.round((n.reservado / n.meta) * 100), 100) : 0)

/** Quanto ainda cabe numa opção (∞ ⇒ `null`, sem `maxPorOpcao`). */
export function restanteDaOpcao(n: Need, opcao: string): number | null {
  if (n.maxPorOpcao === null) return null
  return Math.max(n.maxPorOpcao - (n.reservadoPorOpcao[opcao] ?? 0), 0)
}

/**
 * Máximo que esta pessoa pode escolher agora, considerando meta, limite por
 * pessoa e (se houver) a opção; `minha` é a pledge atual dela, que "devolve"
 * suas unidades ao editar.
 */
export function maxParaMim(n: Need, minha: Pledge | null, opcao: string | null): number {
  const livreMeta = restante(n) + (minha?.qty ?? 0)
  let teto = Math.min(n.maxPorPessoa, livreMeta)
  if (opcao && n.maxPorOpcao !== null) {
    const naOpcao = (n.reservadoPorOpcao[opcao] ?? 0) - (minha?.opcao === opcao ? minha.qty : 0)
    teto = Math.min(teto, Math.max(n.maxPorOpcao - naOpcao, 0))
  }
  return Math.max(teto, 0)
}

export interface Grupo {
  categoria: string
  needs: Need[]
}

/**
 * Agrupa na ordem das categorias do evento; dentro, pela `ordem`. Categorias vazias somem.
 * Itens de uma categoria que não está na lista (órfãos) aparecem no fim, nunca somem.
 */
export function agruparPorCategoria(needs: Need[], categorias: readonly string[] = CATEGORIAS_PADRAO): Grupo[] {
  const orfas = [...new Set(needs.map((n) => n.categoria).filter((c) => !categorias.includes(c)))]
  return [...categorias, ...orfas]
    .map((categoria) => ({
      categoria,
      needs: needs.filter((n) => n.categoria === categoria).sort((a, b) => a.ordem - b.ordem),
    }))
    .filter((g) => g.needs.length > 0)
}

export const pledgesDaNeed = (pledges: Pledge[], needId: string) =>
  pledges.filter((p) => p.needId === needId).sort((a, b) => a.primeiroNome.localeCompare(b.primeiroNome, 'pt-BR'))

/** "Alice ×2 · Fanta" */
export function descreverPledge(p: Pledge): string {
  const detalhe = p.opcao ?? p.textoOutro
  return `${p.primeiroNome} ×${p.qty}${detalhe ? ` · ${detalhe}` : ''}`
}

export interface Resumo {
  total: number
  completas: number
  faltando: number
  percentual: number
}

/** Visão geral do evento: quantos itens fecharam a meta e % global (por unidades). */
export function resumir(needs: Need[]): Resumo {
  const metaTotal = needs.reduce((s, n) => s + n.meta, 0)
  const reservado = needs.reduce((s, n) => s + Math.min(n.reservado, n.meta), 0)
  const completas = needs.filter(completa).length
  return {
    total: needs.length,
    completas,
    faltando: needs.length - completas,
    percentual: metaTotal > 0 ? Math.round((reservado / metaTotal) * 100) : 0,
  }
}

/** Itens que a pessoa pode levar de volta no final (tag `devolver`, definida pela organização). */
export const permiteDevolver = (n: Need) => n.tags.includes('devolver')
