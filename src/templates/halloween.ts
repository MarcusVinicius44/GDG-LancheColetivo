import type { Categoria, Tag } from '@/config/constants'
import { normOpcoes } from '@/lib/format'

/**
 * Template do Coding Jam de Halloween (31/10/2026, UNINASSAU) — público 90, margem 0.
 * Água e gelo ficam de fora (decisão final). Usado pelo botão do admin (passa
 * pelas Security Rules) e, só no emulador, pelo script de seed.
 */

export interface NeedTemplate {
  id: string
  nome: string
  categoria: Categoria
  unidade: string
  meta: number
  minPorPessoa: number
  maxPorPessoa: number
  opcoes: string[]
  maxPorOpcao: number | null
  permiteOutro: boolean
  nota: string
  tags: Tag[]
}

type Base = Partial<NeedTemplate> & Pick<NeedTemplate, 'id' | 'nome' | 'categoria' | 'unidade' | 'meta'>

const n = (b: Base): NeedTemplate => ({
  minPorPessoa: 1,
  maxPorPessoa: Math.min(b.meta, 4),
  opcoes: [],
  maxPorOpcao: null,
  permiteOutro: false,
  nota: '',
  tags: [],
  ...b,
})

export const HALLOWEEN_EVENT = {
  id: 'coding-jam-halloween',
  titulo: 'Coding Jam de Halloween',
  descricao:
    'Coffee break coletivo do GDG Aracaju. Escolha o que você leva — é só o que está na lista, sem repetir. Todo mundo come junto!',
  local: 'UNINASSAU — Aracaju',
  // 31/10/2026 08:30 e 29/10/2026 18:00, horário de Fortaleza (UTC−3, sem horário de verão)
  inicio: new Date('2026-10-31T11:30:00Z'),
  prazoContribuicoes: new Date('2026-10-29T21:00:00Z'),
  inscritos: 0,
  publicoPlanejado: 90,
  margem: 0,
  maxNecessidadesPorPessoa: 2,
} as const

export const HALLOWEEN_NEEDS: NeedTemplate[] = [
  // Bebidas
  n({
    id: 'refrigerante', nome: 'Refrigerante', categoria: 'Bebidas', unidade: 'garrafa 2L', meta: 10,
    opcoes: ['Coca-Cola', 'Guaraná Antarctica', 'Fanta'], maxPorOpcao: 4, permiteOutro: true,
  }),
  n({
    id: 'suco', nome: 'Suco', categoria: 'Bebidas', unidade: 'garrafa 1L', meta: 12,
    opcoes: ['Uva', 'Morango', 'Abacaxi', 'Laranja'], maxPorOpcao: 4,
  }),
  // Café & Cia
  n({
    id: 'cafe-pronto', nome: 'Café pronto', categoria: 'Café & Cia', unidade: 'garrafa térmica 1L', meta: 14,
    maxPorPessoa: 3, nota: 'A garrafa térmica volta para você no final, se quiser.',
  }),
  n({ id: 'leite', nome: 'Leite', categoria: 'Café & Cia', unidade: 'caixa 1L', meta: 6, maxPorPessoa: 3 }),
  n({ id: 'acucar', nome: 'Açúcar', categoria: 'Café & Cia', unidade: 'pacote 1kg', meta: 3, maxPorPessoa: 2 }),
  n({ id: 'adocante', nome: 'Adoçante', categoria: 'Café & Cia', unidade: 'frasco', meta: 2, maxPorPessoa: 1 }),
  n({ id: 'copinhos-cafe', nome: 'Copinhos de café', categoria: 'Café & Cia', unidade: 'pacote 50un', meta: 4, maxPorPessoa: 2 }),
  n({ id: 'mexedores', nome: 'Mexedores', categoria: 'Café & Cia', unidade: 'pacote', meta: 2, maxPorPessoa: 1 }),
  // Salgados
  n({
    id: 'salgados', nome: 'Salgados', categoria: 'Salgados', unidade: 'unidade', meta: 330,
    minPorPessoa: 25, maxPorPessoa: 100, permiteOutro: true,
    nota: 'Se quiser, conte qual salgado vai levar (coxinha, esfiha…).',
  }),
  n({
    id: 'salgado-vegano', nome: 'Salgado vegano', categoria: 'Salgados', unidade: 'unidade', meta: 30,
    minPorPessoa: 10, maxPorPessoa: 30, tags: ['vegano'],
  }),
  // Doces
  n({
    id: 'bolo', nome: 'Bolo inteiro', categoria: 'Doces', unidade: 'bolo', meta: 6, maxPorPessoa: 2,
    opcoes: ['Macaxeira', 'Cenoura', 'Chocolate', 'Fubá', 'Laranja'], maxPorOpcao: 2, permiteOutro: true,
  }),
  n({ id: 'docinhos', nome: 'Docinhos', categoria: 'Doces', unidade: 'unidade', meta: 100, minPorPessoa: 20, maxPorPessoa: 100 }),
  n({
    id: 'bolo-sem-gluten', nome: 'Bolo sem glúten e sem lactose', categoria: 'Doces', unidade: 'bolo', meta: 1,
    maxPorPessoa: 1, tags: ['sem-gluten', 'sem-lactose'],
  }),
  // Pães & Frios
  n({ id: 'pao', nome: 'Pão', categoria: 'Pães & Frios', unidade: 'unidade', meta: 140, minPorPessoa: 10, maxPorPessoa: 70 }),
  n({ id: 'queijo', nome: 'Queijo', categoria: 'Pães & Frios', unidade: 'pacote 500g', meta: 5, maxPorPessoa: 2 }),
  n({ id: 'presunto', nome: 'Presunto / peito de peru', categoria: 'Pães & Frios', unidade: 'pacote 500g', meta: 4, maxPorPessoa: 2 }),
  n({ id: 'manteiga', nome: 'Manteiga', categoria: 'Pães & Frios', unidade: 'pote', meta: 3, maxPorPessoa: 2 }),
  n({ id: 'requeijao', nome: 'Requeijão', categoria: 'Pães & Frios', unidade: 'pote', meta: 3, maxPorPessoa: 2 }),
  // Descartáveis
  n({ id: 'pratos', nome: 'Pratos', categoria: 'Descartáveis', unidade: 'unidade', meta: 150, minPorPessoa: 25, maxPorPessoa: 100 }),
  n({ id: 'copos', nome: 'Copos 200ml', categoria: 'Descartáveis', unidade: 'unidade', meta: 300, minPorPessoa: 25, maxPorPessoa: 100 }),
  n({ id: 'guardanapos', nome: 'Guardanapos', categoria: 'Descartáveis', unidade: 'pacote 50un', meta: 8, maxPorPessoa: 4 }),
  n({ id: 'talheres', nome: 'Talheres', categoria: 'Descartáveis', unidade: 'unidade', meta: 100, minPorPessoa: 25, maxPorPessoa: 100 }),
  // Diversos
  n({ id: 'faca', nome: 'Faca', categoria: 'Diversos', unidade: 'unidade', meta: 2, maxPorPessoa: 1, nota: 'Volta para você no final.' }),
  n({ id: 'saco-lixo', nome: 'Saco de lixo', categoria: 'Diversos', unidade: 'pacote', meta: 2, maxPorPessoa: 1 }),
  n({ id: 'papel-toalha', nome: 'Papel toalha', categoria: 'Diversos', unidade: 'rolo', meta: 2, maxPorPessoa: 1 }),
]

/** Documento exato que as rules esperam para uma need nova (contadores zerados). */
export function needDoc(t: NeedTemplate, ordem: number) {
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
