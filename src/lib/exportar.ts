import { formatDataHora } from '@/lib/format'
import { agruparPorCategoria, completa, descreverPledge, pledgesDaNeed, restante } from '@/lib/needView'
import type { Evento, Need, Pledge } from '@/lib/types'

/** Textos para o grupo do WhatsApp e CSV para a organização. Tudo puro e testável. */

export interface Usuario {
  nome: string
  email: string
}

export interface Cancelamento {
  id: string
  needId: string
  uid: string
  primeiroNome: string
  qty: number
}

/** `*negrito*` do WhatsApp. */
const b = (s: string) => `*${s}*`

function cabecalho(ev: Evento, titulo: string): string[] {
  return [`${b(titulo)} — ${ev.titulo}`, `📅 ${formatDataHora(ev.inicio)} · 📍 ${ev.local}`, '']
}

/** "Quem leva o quê", agrupado por categoria; itens sem ninguém aparecem como lacuna. */
export function textoQuemLeva(ev: Evento, needs: Need[], pledges: Pledge[]): string {
  const linhas = cabecalho(ev, 'Quem leva o quê')
  for (const g of agruparPorCategoria(needs)) {
    linhas.push(b(g.categoria))
    for (const n of g.needs) {
      const quem = pledgesDaNeed(pledges, n.id).map(descreverPledge)
      const situacao = completa(n) ? '✅ completo' : `faltam ${restante(n)}`
      linhas.push(`• ${n.nome} (${n.unidade}): ${quem.length > 0 ? quem.join(', ') : 'ninguém ainda'} — ${situacao}`)
    }
    linhas.push('')
  }
  return linhas.join('\n').trimEnd()
}

/** "O que falta": só itens incompletos, com link e prazo para convidar o grupo. */
export function textoFalta(ev: Evento, needs: Need[], link: string): string {
  const incompletos = needs.filter((n) => !completa(n))
  if (incompletos.length === 0) {
    return [...cabecalho(ev, 'Lanche coletivo'), '🎉 Tudo garantido! Obrigado a todo mundo que contribuiu.'].join('\n')
  }
  const linhas = cabecalho(ev, 'O que ainda falta')
  for (const g of agruparPorCategoria(incompletos)) {
    linhas.push(b(g.categoria))
    for (const n of g.needs) {
      const opcoesLivres = n.opcoes.filter((o) => n.maxPorOpcao === null || (n.reservadoPorOpcao[o] ?? 0) < n.maxPorOpcao)
      const detalhe = n.opcoes.length > 0 && opcoesLivres.length > 0 ? ` — ${opcoesLivres.join(' / ')}` : ''
      linhas.push(`• ${n.nome}: faltam ${restante(n)} de ${n.meta} (${n.unidade})${detalhe}`)
    }
    linhas.push('')
  }
  linhas.push(`👉 Escolha o que levar até ${formatDataHora(ev.prazoContribuicoes)}: ${link}`)
  return linhas.join('\n')
}

/**
 * Células que começam com `= + - @` (ou tab/CR) são lidas como fórmula pelo
 * Excel/Sheets; como `textoOutro` e nomes vêm de usuários, neutralizamos.
 */
export function celulaSegura(valor: string | number): string {
  const s = String(valor)
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
}

function celulaCsv(valor: string | number): string {
  const s = celulaSegura(valor)
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export const CSV_CABECALHO = ['Categoria', 'Item', 'Unidade', 'Nome', 'E-mail', 'Quantidade', 'Opção/Outro', 'Devolver no final']

/**
 * CSV com `;` (abre direto no Excel pt-BR) e BOM UTF-8 (acentos). Inclui o
 * e-mail vindo de `users` — uso restrito à organização.
 */
export function gerarCsv(needs: Need[], pledges: Pledge[], usuarios: Map<string, Usuario>): string {
  const linhas: Array<Array<string | number>> = [CSV_CABECALHO]
  for (const g of agruparPorCategoria(needs)) {
    for (const n of g.needs) {
      for (const p of pledgesDaNeed(pledges, n.id)) {
        const u = usuarios.get(p.uid)
        linhas.push([
          n.categoria,
          n.nome,
          n.unidade,
          u?.nome || p.primeiroNome,
          u?.email ?? '',
          p.qty,
          p.opcao ?? p.textoOutro ?? '',
          p.devolverAoFinal ? 'sim' : 'não',
        ])
      }
    }
  }
  return '﻿' + linhas.map((l) => l.map(celulaCsv).join(';')).join('\r\n') + '\r\n'
}

export interface Lacuna {
  need: Need
  faltam: number
}

/** Itens incompletos, do mais para o menos descoberto (% restante). */
export function lacunas(needs: Need[]): Lacuna[] {
  return needs
    .filter((n) => !completa(n))
    .map((need) => ({ need, faltam: restante(need) }))
    .sort((a, b) => b.faltam / b.need.meta - a.faltam / a.need.meta || a.need.nome.localeCompare(b.need.nome, 'pt-BR'))
}

export interface ReaberturaOk {
  ok: true
  prazo: Date
}
export interface ReaberturaErro {
  ok: false
  motivo: string
}

/** O novo prazo precisa ser futuro e não pode passar do início do evento (rule). */
export function validarReabertura(ev: Evento, novo: Date | null, agora: Date): ReaberturaOk | ReaberturaErro {
  if (!novo) return { ok: false, motivo: 'Informe data e hora válidas.' }
  if (novo <= agora) return { ok: false, motivo: 'Escolha um momento no futuro.' }
  if (novo > ev.inicio) return { ok: false, motivo: `O prazo não pode passar do início do evento (${formatDataHora(ev.inicio)}).` }
  return { ok: true, prazo: novo }
}
