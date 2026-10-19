import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { adicionarCategoria, moverCategoria, removerCategoria, renomearCategoria } from '@/lib/categorias'
import { criarEventoTeste, EVENTO_TESTE, salvarEvento } from '@/lib/eventos'
import { planoMover } from '@/lib/needDoc'
import type { NeedBase } from '@/lib/needForm'
import { aplicarOrdem, criarNeed, removerNeed, salvarNeed } from '@/lib/needs'
import type { Need } from '@/lib/types'
import { HALLOWEEN_NEEDS } from '@/templates/halloween'
import {
  dbOf,
  eventoBase,
  needBase,
  needComOpcoes,
  resetEnv,
  seedBasico,
  setupEnv,
  teardownEnv,
} from './harness'
import { readRaw, seedPledge } from './ops'

beforeAll(setupEnv)
afterAll(teardownEnv)
beforeEach(resetEnv)

const codigo = async (p: Promise<unknown>) => {
  try {
    await p
  } catch (e) {
    return (e as { code?: string }).code ?? 'sem-codigo'
  }
  return null
}

const base = (o: Partial<NeedBase> = {}): NeedBase => ({
  nome: 'Suco', categoria: 'Bebidas', unidade: 'garrafa 1L', meta: 12, minPorPessoa: 1, maxPorPessoa: 4,
  opcoes: [], maxPorOpcao: null, permiteOutro: false, nota: '', tags: [], ...o,
})

const lerNeed = async (id: string): Promise<Need> => ({ id, ...(await readRaw(`events/evt1/needs/${id}`)) }) as Need
const lerEvento = () => readRaw('events/evt1')

const SABORES = ['Uva', 'Morango', 'Abacaxi', 'Laranja']
const DOZE_META = { meta: 12, maxPorPessoa: 4 }

describe('lib/needs.ts contra as rules', () => {
  it('criarNeed: id por slug, ordem depois dos existentes, contadores zerados, categoria do evento', async () => {
    await seedBasico({ evento: eventoBase({ categorias: ['Bebidas', 'Frutas'] }), needs: { n1: needBase({ ordem: 5 }) } })
    const db = dbOf('admin')
    const existentes = [await lerNeed('n1')]
    const id = await criarNeed(db, 'evt1', base({ nome: 'Banana prata', categoria: 'Frutas', unidade: 'kg', meta: 10 }), existentes)
    expect(id).toBe('banana-prata')
    expect(await readRaw('events/evt1/needs/banana-prata')).toMatchObject({
      nome: 'Banana prata', categoria: 'Frutas', reservado: 0, ordem: 6, ultimoUid: null, opcoes: [], tags: [],
    })
    // mesmo nome de novo: o slug ganha sufixo, sem sobrescrever
    const id2 = await criarNeed(db, 'evt1', base({ nome: 'Banana prata', categoria: 'Frutas' }), [...existentes, await lerNeed(id)])
    expect(id2).toBe('banana-prata-2')
  })

  it('criarNeed com sabores acentuados (opcoesNorm correto) e categoria fora da lista negada', async () => {
    await seedBasico({ evento: eventoBase({ categorias: ['Bebidas'] }), needs: {} })
    const db = dbOf('admin')
    await criarNeed(db, 'evt1', base({ nome: 'Refri', opcoes: ['Guaraná Antarctica', 'Coca-Cola'], maxPorOpcao: 6 }), [])
    expect(await readRaw('events/evt1/needs/refri')).toMatchObject({
      opcoesNorm: ['guarana antarctica', 'coca-cola'], reservadoPorOpcao: { 'Guaraná Antarctica': 0, 'Coca-Cola': 0 },
    })
    expect(await codigo(criarNeed(db, 'evt1', base({ nome: 'Pão', categoria: 'Salgados' }), []))).toBe('permission-denied')
  })

  it('não-admin não cria, edita nem remove', async () => {
    await seedBasico()
    const db = dbOf('alice')
    const atual = await lerNeed('n1')
    expect(await codigo(criarNeed(db, 'evt1', base(), []))).toBe('permission-denied')
    expect(await codigo(salvarNeed(db, 'evt1', atual, base({ nome: 'Hack', meta: 10 })))).toBe('permission-denied')
    expect(await codigo(removerNeed(db, 'evt1', 'n1'))).toBe('permission-denied')
  })

  it('salvarNeed sem mudanças não escreve nada', async () => {
    await seedBasico()
    const atual = await lerNeed('n1')
    const novo = base({ ...atual, opcoes: [...atual.opcoes], tags: [...atual.tags] })
    expect(await salvarNeed(dbOf('admin'), 'evt1', atual, novo)).toBe(false)
  })

  describe('item COM contribuições', () => {
    const seedComReservas = async () => {
      await seedBasico({ needs: { n1: needComOpcoes(SABORES, { ...DOZE_META, nome: 'Suco' }) } })
      await seedPledge('alice', 'n1', 2, { opcao: 'Uva' })
    }

    it('edita nome, meta, limites, nota e etiquetas; contadores e quem contribuiu ficam intactos', async () => {
      await seedComReservas()
      const atual = await lerNeed('n1')
      const ok = await salvarNeed(
        dbOf('admin'), 'evt1', atual,
        base({
          ...atual, nome: 'Suco natural', unidade: 'jarra', meta: 14, maxPorPessoa: 5, maxPorOpcao: 5,
          nota: 'sem açúcar', tags: ['sem-gluten'], opcoes: [...atual.opcoes],
        }),
      )
      expect(ok).toBe(true)
      expect(await readRaw('events/evt1/needs/n1')).toMatchObject({
        nome: 'Suco natural', meta: 14, maxPorPessoa: 5, maxPorOpcao: 5, nota: 'sem açúcar', tags: ['sem-gluten'],
        reservado: 2, reservadoPorOpcao: { Uva: 2, Morango: 0, Abacaxi: 0, Laranja: 0 }, ultimoUid: 'alice',
      })
      expect(await readRaw('events/evt1/pledges/n1_alice')).toMatchObject({ qty: 2, opcao: 'Uva' })
    })

    it('acrescenta sabores no fim (inclusive com ponto no nome) sem tocar nos contadores', async () => {
      await seedComReservas()
      const atual = await lerNeed('n1')
      await salvarNeed(dbOf('admin'), 'evt1', atual, base({ ...atual, opcoes: [...SABORES, 'Caju', 'Manga.Rosa'] }))
      const n = await readRaw('events/evt1/needs/n1')
      expect(n?.opcoes).toEqual([...SABORES, 'Caju', 'Manga.Rosa'])
      expect(n?.opcoesNorm).toEqual(['uva', 'morango', 'abacaxi', 'laranja', 'caju', 'manga.rosa'])
      expect(n?.reservadoPorOpcao).toEqual({ Uva: 2, Morango: 0, Abacaxi: 0, Laranja: 0, Caju: 0, 'Manga.Rosa': 0 })
      expect(n?.reservado).toBe(2)
    })

    it('o servidor nega remover sabor ou apagar o item, mesmo se a tela falhar em avisar', async () => {
      await seedComReservas()
      const db = dbOf('admin')
      const atual = await lerNeed('n1')
      // `atual` com reservado=0 forjado: força o caminho de "regravar o mapa" — as rules precisam barrar
      const desatualizado = { ...atual, reservado: 0, reservadoPorOpcao: { Uva: 0, Morango: 0, Abacaxi: 0, Laranja: 0 } }
      expect(await codigo(salvarNeed(db, 'evt1', desatualizado, base({ ...atual, opcoes: ['Morango', 'Abacaxi'] })))).toBe('permission-denied')
      expect(await codigo(removerNeed(db, 'evt1', 'n1'))).toBe('permission-denied')
      expect(await readRaw('events/evt1/needs/n1')).toMatchObject({ reservado: 2, reservadoPorOpcao: { Uva: 2 } })
    })

    it('meta abaixo do reservado é negada pelo servidor', async () => {
      await seedComReservas()
      const atual = await lerNeed('n1')
      expect(await codigo(salvarNeed(dbOf('admin'), 'evt1', atual, base({ ...atual, meta: 1, opcoes: SABORES })))).toBe('permission-denied')
    })
  })

  describe('item SEM contribuições', () => {
    it('remove e reordena sabores livremente (mapa de contadores regravado com zeros)', async () => {
      await seedBasico({ needs: { n1: needComOpcoes(SABORES, DOZE_META) } })
      const atual = await lerNeed('n1')
      await salvarNeed(dbOf('admin'), 'evt1', atual, base({ ...atual, opcoes: ['Laranja', 'Uva'], maxPorOpcao: 6 }))
      expect(await readRaw('events/evt1/needs/n1')).toMatchObject({
        opcoes: ['Laranja', 'Uva'], opcoesNorm: ['laranja', 'uva'], reservadoPorOpcao: { Laranja: 0, Uva: 0 }, maxPorOpcao: 6,
      })
    })

    it('troca de categoria (para outra do evento) e etiqueta "devolver"', async () => {
      await seedBasico({ evento: eventoBase({ categorias: ['Bebidas', 'Frutas'] }), needs: { n1: needBase() } })
      const atual = await lerNeed('n1')
      await salvarNeed(dbOf('admin'), 'evt1', atual, base({ ...atual, categoria: 'Frutas', tags: ['devolver'] }))
      expect(await readRaw('events/evt1/needs/n1')).toMatchObject({ categoria: 'Frutas', tags: ['devolver'] })
    })

    it('removerNeed apaga o item', async () => {
      await seedBasico({ needs: { n1: needBase() } })
      await removerNeed(dbOf('admin'), 'evt1', 'n1')
      expect(await readRaw('events/evt1/needs/n1')).toBeUndefined()
    })

    it('corrida: alguém contribui entre a leitura e o salvar ⇒ o servidor nega e nada se perde', async () => {
      await seedBasico({ needs: { n1: needComOpcoes(SABORES, DOZE_META) } })
      const atual = await lerNeed('n1') // lido com reservado = 0
      await seedPledge('bob', 'n1', 3, { opcao: 'Morango' }) // contribuição chega agora
      const r = await codigo(salvarNeed(dbOf('admin'), 'evt1', atual, base({ ...atual, opcoes: ['Uva', 'Laranja'] })))
      expect(r).toBe('permission-denied')
      expect(await readRaw('events/evt1/needs/n1')).toMatchObject({ reservado: 3, reservadoPorOpcao: { Morango: 3 } })
    })
  })

  it('aplicarOrdem troca a ordem de dois itens vizinhos de uma vez', async () => {
    await seedBasico({ needs: { a: needBase({ nome: 'A', ordem: 1 }), b: needBase({ nome: 'B', ordem: 2 }), c: needBase({ nome: 'C', ordem: 3 }) } })
    const todos = await Promise.all(['a', 'b', 'c'].map(lerNeed))
    await aplicarOrdem(dbOf('admin'), 'evt1', planoMover(todos, 'c', -1))
    expect((await readRaw('events/evt1/needs/c'))?.ordem).toBe(2)
    expect((await readRaw('events/evt1/needs/b'))?.ordem).toBe(3)
    expect((await readRaw('events/evt1/needs/a'))?.ordem).toBe(1)
  })
})

describe('lib/categorias.ts contra as rules', () => {
  it('evento antigo (sem campo): adicionar materializa as 7 padrão + a nova', async () => {
    await seedBasico()
    await adicionarCategoria(dbOf('admin'), 'evt1', 'Frutas')
    expect((await lerEvento())?.categorias).toEqual([
      'Bebidas', 'Salgados', 'Doces', 'Pães & Frios', 'Café & Cia', 'Descartáveis', 'Diversos', 'Frutas',
    ])
  })

  it('adicionar, mover e remover', async () => {
    await seedBasico({ evento: eventoBase({ categorias: ['Bebidas', 'Doces'] }) })
    const db = dbOf('admin')
    await adicionarCategoria(db, 'evt1', 'Frutas')
    await moverCategoria(db, 'evt1', 'Frutas', -1)
    expect((await lerEvento())?.categorias).toEqual(['Bebidas', 'Frutas', 'Doces'])
    await removerCategoria(db, 'evt1', 'Doces')
    expect((await lerEvento())?.categorias).toEqual(['Bebidas', 'Frutas'])
  })

  it('nome repetido é recusado antes de escrever; não-admin é negado pelo servidor', async () => {
    await seedBasico({ evento: eventoBase({ categorias: ['Bebidas', 'Doces'] }) })
    await expect(adicionarCategoria(dbOf('admin'), 'evt1', 'doces')).rejects.toThrow(/Já existe/)
    expect(await codigo(adicionarCategoria(dbOf('alice'), 'evt1', 'Frutas'))).toBe('permission-denied')
    expect((await lerEvento())?.categorias).toEqual(['Bebidas', 'Doces'])
  })

  it('renomear migra todos os itens (inclusive com contribuições) e preserva a posição', async () => {
    await seedBasico({
      evento: eventoBase({ categorias: ['Bebidas', 'Frutas', 'Doces'] }),
      needs: {
        n1: needBase({ nome: 'Banana', categoria: 'Frutas', maxPorPessoa: 5, ordem: 1 }),
        n2: needBase({ nome: 'Maçã', categoria: 'Frutas', ordem: 2 }),
        n3: needBase({ nome: 'Bolo', categoria: 'Doces', ordem: 3 }),
      },
    })
    await seedPledge('alice', 'n1', 2)
    const itens = await Promise.all(['n1', 'n2', 'n3'].map(lerNeed))
    await renomearCategoria(dbOf('admin'), 'evt1', 'Frutas', 'Frutas e Verduras', itens)
    expect((await lerEvento())?.categorias).toEqual(['Bebidas', 'Frutas e Verduras', 'Doces'])
    expect((await lerNeed('n1')).categoria).toBe('Frutas e Verduras')
    expect((await lerNeed('n2')).categoria).toBe('Frutas e Verduras')
    expect((await lerNeed('n3')).categoria).toBe('Doces')
    expect(await readRaw('events/evt1/needs/n1')).toMatchObject({ reservado: 2 })
  })

  it('renomear para um nome já existente falha sem alterar nada', async () => {
    await seedBasico({ evento: eventoBase({ categorias: ['Bebidas', 'Doces'] }), needs: { n1: needBase() } })
    const itens = [await lerNeed('n1')]
    await expect(renomearCategoria(dbOf('admin'), 'evt1', 'Bebidas', 'Doces', itens)).rejects.toThrow(/Já existe/)
    expect((await lerEvento())?.categorias).toEqual(['Bebidas', 'Doces'])
    expect((await lerNeed('n1')).categoria).toBe('Bebidas')
  })
})

describe('salvarEvento contra as rules', () => {
  it('grava só o que mudou, com datas como Timestamp; status e criadoEm não mudam', async () => {
    await seedBasico()
    const antes = await lerEvento()
    const novoInicio = new Date(Date.now() + 10 * 24 * 3600_000)
    const novoPrazo = new Date(Date.now() + 8 * 24 * 3600_000)
    const ok = await salvarEvento(dbOf('admin'), 'evt1', {
      titulo: 'Novo título', publicoPlanejado: 120, inicio: novoInicio, prazoContribuicoes: novoPrazo,
    })
    expect(ok).toBe(true)
    const depois = await lerEvento()
    expect(depois).toMatchObject({ titulo: 'Novo título', publicoPlanejado: 120, status: 'aberto', local: antes?.local })
    expect(depois?.inicio.toMillis()).toBe(novoInicio.getTime())
    expect(depois?.criadoEm.toMillis()).toBe(antes?.criadoEm.toMillis())
  })

  it('nada a gravar ⇒ false; prazo depois do início e não-admin são negados pelo servidor', async () => {
    await seedBasico()
    expect(await salvarEvento(dbOf('admin'), 'evt1', {})).toBe(false)
    const longe = new Date(Date.now() + 100 * 24 * 3600_000)
    expect(await codigo(salvarEvento(dbOf('admin'), 'evt1', { prazoContribuicoes: longe }))).toBe('permission-denied')
    expect(await codigo(salvarEvento(dbOf('alice'), 'evt1', { titulo: 'Hack' }))).toBe('permission-denied')
  })
})

describe('template Halloween pelo caminho real do app', () => {
  it('criarEventoTeste passa pelas rules: evento com categorias, 25 itens, tags devolver', async () => {
    await seedBasico({ needs: {} })
    const id = await criarEventoTeste(dbOf('admin'))
    expect(id).toBe(EVENTO_TESTE.id)
    const ev = await readRaw(`events/${id}`)
    expect(ev).toMatchObject({ titulo: EVENTO_TESTE.titulo, status: 'rascunho' })
    expect(ev?.categorias).toEqual(['Bebidas', 'Salgados', 'Doces', 'Pães & Frios', 'Café & Cia', 'Descartáveis', 'Diversos'])
    for (const t of HALLOWEEN_NEEDS) {
      const n = await readRaw(`events/${id}/needs/${t.id}`)
      expect(n, t.id).toBeDefined()
      expect(n?.tags.includes('devolver'), t.id).toBe(t.tags.includes('devolver'))
    }
    expect(HALLOWEEN_NEEDS).toHaveLength(25)
  })
})
