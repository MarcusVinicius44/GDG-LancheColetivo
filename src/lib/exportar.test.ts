import { describe, expect, it } from 'vitest'
import {
  CSV_CABECALHO,
  celulaSegura,
  gerarCsv,
  lacunas,
  textoFalta,
  textoQuemLeva,
  validarReabertura,
  type Usuario,
} from '@/lib/exportar'
import { deInputFortaleza, paraInputFortaleza } from '@/lib/format'
import type { Evento, Need, Pledge } from '@/lib/types'

const ev: Evento = {
  id: 'e1', titulo: 'Coding Jam', descricao: '', local: 'UNINASSAU', inscritos: 0, publicoPlanejado: 90, margem: 0,
  maxNecessidadesPorPessoa: 2, status: 'aberto',
  inicio: new Date('2026-10-31T11:30:00Z'), prazoContribuicoes: new Date('2026-10-29T21:00:00Z'),
  categorias: ['Bebidas', 'Pães & Frios', 'Café & Cia'],
}
const need = (o: Partial<Need> = {}): Need => ({
  id: 'n1', nome: 'Refrigerante', categoria: 'Bebidas', unidade: 'garrafa 2L', meta: 10, reservado: 0, minPorPessoa: 1,
  maxPorPessoa: 4, opcoes: [], opcoesNorm: [], maxPorOpcao: null, reservadoPorOpcao: {}, permiteOutro: false,
  nota: '', tags: [], ordem: 1, ultimoUid: null, ...o,
})
const pledge = (o: Partial<Pledge> = {}): Pledge => ({
  id: 'n1_a', needId: 'n1', uid: 'a', qty: 2, opcao: null, textoOutro: null, primeiroNome: 'Ana', devolverAoFinal: false, ...o,
})

describe('textoQuemLeva', () => {
  it('agrupa por categoria, lista quem leva e a situação', () => {
    const t = textoQuemLeva(
      ev,
      [need({ reservado: 3 }), need({ id: 'n2', nome: 'Pão', categoria: 'Pães & Frios', unidade: 'unidade', meta: 4, reservado: 4 })],
      [pledge({ opcao: 'Fanta' }), pledge({ id: 'n1_b', uid: 'b', primeiroNome: 'Bia', qty: 1 }), pledge({ id: 'n2_a', needId: 'n2', qty: 4 })],
    )
    expect(t).toContain('*Quem leva o quê* — Coding Jam')
    expect(t).toContain('*Bebidas*')
    expect(t).toContain('• Refrigerante (garrafa 2L): Ana ×2 · Fanta, Bia ×1 — faltam 7')
    expect(t).toContain('• Pão (unidade): Ana ×4 — ✅ completo')
    expect(t.indexOf('*Bebidas*')).toBeLessThan(t.indexOf('*Pães & Frios*'))
  })
  it('item sem ninguém vira "ninguém ainda"', () => {
    expect(textoQuemLeva(ev, [need()], [])).toContain('ninguém ainda — faltam 10')
  })
})

describe('textoFalta', () => {
  it('só incompletos, com sabores livres, prazo e link', () => {
    const n = need({
      opcoes: ['Coca', 'Fanta'], maxPorOpcao: 2, reservadoPorOpcao: { Coca: 2, Fanta: 0 }, reservado: 2,
    })
    const t = textoFalta(ev, [n, need({ id: 'n2', nome: 'Leite', categoria: 'Café & Cia', meta: 2, reservado: 2 })], 'https://x.app/e/e1')
    expect(t).toContain('*O que ainda falta*')
    expect(t).toContain('• Refrigerante: faltam 8 de 10 (garrafa 2L) — Fanta')
    expect(t).not.toContain('Leite')
    expect(t).toContain('https://x.app/e/e1')
    expect(t).toMatch(/até .*29\/10\/2026/)
  })
  it('tudo completo: mensagem de agradecimento', () => {
    expect(textoFalta(ev, [need({ reservado: 10 })], 'u')).toContain('Tudo garantido')
  })
})

describe('CSV', () => {
  const usuarios = new Map<string, Usuario>([['a', { nome: 'Ana Souza', email: 'ana@x.com' }]])
  it('cabeçalho, BOM, separador ; e e-mail via users', () => {
    const csv = gerarCsv([need()], [pledge({ opcao: 'Fanta', devolverAoFinal: true })], usuarios)
    expect(csv.startsWith('﻿')).toBe(true)
    const [cab, linha] = csv.slice(1).split('\r\n')
    expect(cab).toBe(CSV_CABECALHO.join(';'))
    expect(linha).toBe('Bebidas;Refrigerante;garrafa 2L;Ana Souza;ana@x.com;2;Fanta;sim')
  })
  it('sem cadastro em users usa o primeiro nome e deixa e-mail vazio', () => {
    const csv = gerarCsv([need()], [pledge({ uid: 'zz' })], new Map())
    expect(csv).toContain('Ana;;2;;não')
  })
  it('escapa aspas, ; e quebras de linha', () => {
    const csv = gerarCsv([need()], [pledge({ textoOutro: 'tapioca; "recheada"\nqueijo' })], usuarios)
    expect(csv).toContain('"tapioca; ""recheada""\nqueijo"')
  })
  it('neutraliza fórmulas (injeção de CSV)', () => {
    expect(celulaSegura('=HYPERLINK("http://x")')).toBe(`'=HYPERLINK("http://x")`)
    expect(celulaSegura('+1')).toBe("'+1")
    expect(celulaSegura('-1')).toBe("'-1")
    expect(celulaSegura('@SUM(A1)')).toBe("'@SUM(A1)")
    expect(celulaSegura('normal')).toBe('normal')
    expect(celulaSegura(5)).toBe('5')
    const csv = gerarCsv([need()], [pledge({ textoOutro: '=cmd|calc' })], usuarios)
    expect(csv).toContain(";'=cmd|calc;")
  })
})

describe('lacunas', () => {
  it('só incompletos, mais descobertos primeiro', () => {
    const r = lacunas([
      need({ id: 'a', nome: 'A', meta: 10, reservado: 9 }),
      need({ id: 'b', nome: 'B', meta: 10, reservado: 0 }),
      need({ id: 'c', nome: 'C', meta: 10, reservado: 10 }),
    ])
    expect(r.map((l) => l.need.id)).toEqual(['b', 'a'])
    expect(r[0]?.faltam).toBe(10)
  })
})

describe('validarReabertura', () => {
  const agora = new Date('2026-10-30T12:00:00Z')
  it('aceita futuro ≤ início', () => {
    const novo = new Date('2026-10-31T10:00:00Z')
    expect(validarReabertura(ev, novo, agora)).toEqual({ ok: true, prazo: novo })
    expect(validarReabertura(ev, ev.inicio, agora).ok).toBe(true)
  })
  it('rejeita inválido, passado e depois do início', () => {
    expect(validarReabertura(ev, null, agora).ok).toBe(false)
    expect(validarReabertura(ev, new Date('2026-10-30T11:00:00Z'), agora).ok).toBe(false)
    const r = validarReabertura(ev, new Date('2026-10-31T12:00:00Z'), agora)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toContain('início do evento')
  })
})

describe('datetime-local em Fortaleza', () => {
  it('ida e volta, independente do fuso do navegador', () => {
    const d = new Date('2026-10-29T21:00:00Z')
    expect(paraInputFortaleza(d)).toBe('2026-10-29T18:00')
    expect(deInputFortaleza('2026-10-29T18:00')?.toISOString()).toBe('2026-10-29T21:00:00.000Z')
    expect(deInputFortaleza(paraInputFortaleza(d))?.getTime()).toBe(d.getTime())
  })
  it('inválidos viram null', () => {
    expect(deInputFortaleza('')).toBeNull()
    expect(deInputFortaleza('29/10/2026 18:00')).toBeNull()
    expect(deInputFortaleza('2026-13-45T99:99')).toBeNull()
  })
})
