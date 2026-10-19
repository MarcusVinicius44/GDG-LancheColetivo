import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { doc, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import {
  dbOf,
  eventoBase,
  evPath,
  needBase,
  needComOpcoes,
  needPath,
  norm,
  resetEnv,
  seedBasico,
  setupEnv,
  teardownEnv,
} from './harness'
import { assertFails, assertSucceeds, seedPledge } from './ops'

beforeAll(setupEnv)
afterAll(teardownEnv)
beforeEach(resetEnv)

const admin = () => dbOf('admin')
const novaNeed = (nid: string, data: Record<string, unknown>, k: 'admin' | 'alice' = 'admin') =>
  setDoc(doc(dbOf(k), needPath(nid)), data)
const patchNeed = (nid: string, data: Record<string, unknown>) =>
  updateDoc(doc(admin(), needPath(nid)), data)
const patchEvento = (data: Record<string, unknown>, k: 'admin' | 'alice' = 'admin') =>
  updateDoc(doc(dbOf(k), evPath()), data)

const CUSTOM = ['Bebidas', 'Frutas', 'Doces']

describe('J. Categorias editáveis por evento', () => {
  describe('campo `categorias` do evento', () => {
    it('admin cria evento com categorias válidas', async () => {
      await seedBasico()
      await assertSucceeds(
        setDoc(doc(admin(), 'events/novo'), eventoBase({ status: 'rascunho', categorias: CUSTOM })),
      )
    })

    it.each([
      ['lista vazia', []],
      ['13 categorias', Array.from({ length: 13 }, (_, i) => `Cat ${i}`)],
      ['repetidas', ['Bebidas', 'Bebidas']],
      ['nome vazio', ['Bebidas', '']],
      ['nome > 30 caracteres', ['x'.repeat(31)]],
      ['item que não é string', ['Bebidas', 3]],
      ['não é lista', 'Bebidas'],
    ])('create evento com categorias inválidas (%s) negado', async (_n, categorias) => {
      await seedBasico()
      await assertFails(setDoc(doc(admin(), 'events/novo'), eventoBase({ categorias })))
    })

    it('12 categorias ok', async () => {
      await seedBasico()
      await assertSucceeds(
        setDoc(
          doc(admin(), 'events/novo'),
          eventoBase({ categorias: Array.from({ length: 12 }, (_, i) => `Cat ${i}`) }),
        ),
      )
    })

    it('admin atualiza as categorias; não-admin negado', async () => {
      await seedBasico({ evento: eventoBase({ categorias: CUSTOM }) })
      await assertSucceeds(patchEvento({ categorias: [...CUSTOM, 'Frios'] }))
      await assertFails(patchEvento({ categorias: ['Bebidas'] }, 'alice'))
    })

    it('evento antigo (sem `categorias`) continua editável', async () => {
      await seedBasico()
      await assertSucceeds(patchEvento({ titulo: 'Novo título' }))
      await assertSucceeds(patchEvento({ categorias: ['Bebidas', 'Frutas'] }))
    })
  })

  describe('need valida a categoria contra a lista do evento', () => {
    it('categoria custom aceita; fora da lista negada', async () => {
      await seedBasico({ evento: eventoBase({ categorias: CUSTOM }), needs: {} })
      await assertSucceeds(novaNeed('n1', needBase({ categoria: 'Frutas' })))
      await assertFails(novaNeed('n2', needBase({ categoria: 'Salgados' })))
    })

    it('categoria padrão que saiu da lista do evento é negada', async () => {
      await seedBasico({ evento: eventoBase({ categorias: ['Frutas'] }), needs: {} })
      await assertFails(novaNeed('n1', needBase({ categoria: 'Bebidas' })))
    })

    it('evento sem `categorias`: vale o conjunto das 7 padrão', async () => {
      await seedBasico({ needs: {} })
      await assertSucceeds(novaNeed('n1', needBase({ categoria: 'Pães & Frios' })))
      await assertFails(novaNeed('n2', needBase({ categoria: 'Frutas' })))
    })

    it('não-admin não cria need em categoria custom', async () => {
      await seedBasico({ evento: eventoBase({ categorias: CUSTOM }), needs: {} })
      await assertFails(novaNeed('n1', needBase({ categoria: 'Frutas' }), 'alice'))
    })

    it('update: mover item (com reservas) para outra categoria da lista ok; para fora da lista negado', async () => {
      await seedBasico({
        evento: eventoBase({ categorias: CUSTOM }),
        needs: { n1: needBase({ maxPorPessoa: 5 }) },
      })
      await seedPledge('alice', 'n1', 2)
      await assertSucceeds(patchNeed('n1', { categoria: 'Frutas' }))
      await assertFails(patchNeed('n1', { categoria: 'Salgados' }))
    })

    it('categoria órfã: item fica sem poder ser editado até migrar (por isso a UI só remove categoria vazia)', async () => {
      await seedBasico({
        evento: eventoBase({ categorias: CUSTOM }),
        needs: { n1: needBase({ categoria: 'Frutas' }) },
      })
      await assertSucceeds(patchEvento({ categorias: ['Bebidas', 'Doces'] }))
      await assertFails(patchNeed('n1', { nome: 'Banana' }))
      await assertSucceeds(patchNeed('n1', { nome: 'Banana', categoria: 'Doces' }))
    })

    it('renomear categoria em 3 passos, sempre válido', async () => {
      await seedBasico({
        evento: eventoBase({ categorias: CUSTOM }),
        needs: { n1: needBase({ categoria: 'Frutas' }), n2: needBase({ categoria: 'Frutas', ordem: 2 }) },
      })
      // 1: acrescenta o novo nome
      await assertSucceeds(patchEvento({ categorias: ['Bebidas', 'Frutas', 'Frutas e Verduras', 'Doces'] }))
      // 2: migra os itens (em lote)
      const db = admin()
      const b = writeBatch(db)
      b.update(doc(db, needPath('n1')), { categoria: 'Frutas e Verduras' })
      b.update(doc(db, needPath('n2')), { categoria: 'Frutas e Verduras' })
      await assertSucceeds(b.commit())
      // 3: remove o antigo
      await assertSucceeds(patchEvento({ categorias: ['Bebidas', 'Frutas e Verduras', 'Doces'] }))
      await assertSucceeds(patchNeed('n1', { nota: 'ok' }))
    })

    it('lote de 8 needs em evento com categorias custom passa no limite de acessos', async () => {
      await seedBasico({ evento: eventoBase({ categorias: CUSTOM }), needs: {} })
      const db = admin()
      const b = writeBatch(db)
      for (let i = 0; i < 8; i++) {
        b.set(
          doc(db, needPath(`s${i}`)),
          needComOpcoes(['Uva', 'Morango', 'Abacaxi', 'Laranja'], { ordem: i, categoria: 'Frutas' }),
        )
      }
      await assertSucceeds(b.commit())
    })
  })

  describe('tag `devolver`', () => {
    it('aceita; 4 tags ok; 5 negado; desconhecida negada', async () => {
      await seedBasico({ needs: {} })
      await assertSucceeds(novaNeed('n1', needBase({ tags: ['devolver'] })))
      await assertSucceeds(novaNeed('n2', needBase({ tags: ['vegano', 'sem-gluten', 'sem-lactose', 'devolver'] })))
      await assertFails(
        novaNeed('n3', needBase({ tags: ['vegano', 'sem-gluten', 'sem-lactose', 'devolver', 'devolver'] })),
      )
      await assertFails(novaNeed('n4', needBase({ tags: ['kosher'] })))
    })
  })

  describe('edição de config com contribuições (admin)', () => {
    it('nome, unidade, nota, ordem, min/máx e tags podem mudar; contadores intactos', async () => {
      await seedBasico({ needs: { n1: needBase({ maxPorPessoa: 5 }) } })
      await seedPledge('alice', 'n1', 2)
      await assertSucceeds(
        patchNeed('n1', {
          nome: 'Refri',
          unidade: 'lata',
          nota: 'gelado',
          ordem: 7,
          minPorPessoa: 1,
          maxPorPessoa: 6,
          tags: ['devolver'],
        }),
      )
      await assertFails(patchNeed('n1', { nome: 'Refri', reservado: 0 }))
    })

    describe('acréscimo de opções com reservas: uma por escrita, até 12 (limite de 1000 expressões)', () => {
      const ACENTOS = ['Ação', 'Éclair', 'Índigo', 'Ôvo', 'Úmido', 'Çaju', 'Ãgua', 'Õnix', 'Âmbar', 'Êxito', 'Ônibus', 'Àgil']
      const prep = async (base: string[]) => {
        await seedBasico({ needs: { n1: needComOpcoes(base, { meta: 12, maxPorPessoa: 4, maxPorOpcao: 12 }) } })
        await seedPledge('alice', 'n1', 2, { opcao: base[0]! })
      }
      const acrescentar = (base: string[], novas: string[]) => {
        const todas = [...base, ...novas]
        const mapa = Object.fromEntries(todas.map((o) => [o, 0]))
        mapa[base[0]!] = 2
        return patchNeed('n1', { opcoes: todas, opcoesNorm: todas.map(norm), reservadoPorOpcao: mapa })
      }

      it.each([1, 4, 6, 11])('%i existentes + 1 nova passa (nomes acentuados)', async (n) => {
        const base = ACENTOS.slice(0, n)
        await prep(base)
        await assertSucceeds(acrescentar(base, [ACENTOS[n]!]))
      })

      it('duas novas de uma vez com reservas é negado (o cliente escreve uma por vez)', async () => {
        const base = ACENTOS.slice(0, 4)
        await prep(base)
        await assertFails(acrescentar(base, ACENTOS.slice(4, 6)))
      })

      it('a 13ª opção é negada; sem mudança em 12 opções passa', async () => {
        await prep(ACENTOS)
        await assertFails(acrescentar(ACENTOS, ['Treze']))
        await assertSucceeds(patchNeed('n1', { nota: 'ok' }))
      })

      it('opção nova com contador ≠ 0 ou opcoesNorm errado é negada', async () => {
        const base = ACENTOS.slice(0, 3)
        await prep(base)
        const todas = [...base, 'Caju']
        const mapa = { ...Object.fromEntries(todas.map((o) => [o, 0])), [base[0]!]: 2 }
        await assertFails(patchNeed('n1', { opcoes: todas, opcoesNorm: todas.map(norm), reservadoPorOpcao: { ...mapa, Caju: 1 } }))
        await assertFails(patchNeed('n1', { opcoes: todas, opcoesNorm: [...base.map(norm), 'CAJU'], reservadoPorOpcao: mapa }))
      })
    })

    it('acrescentar opção no fim com reservas ok; reordenar/remover negado', async () => {
      await seedBasico({ needs: { n1: needComOpcoes(['Uva', 'Morango', 'Abacaxi', 'Laranja']) } })
      await seedPledge('alice', 'n1', 2, { opcao: 'Uva' })
      await assertFails(
        patchNeed('n1', {
          opcoes: ['Morango', 'Uva', 'Abacaxi', 'Laranja'],
          opcoesNorm: ['morango', 'uva', 'abacaxi', 'laranja'],
          reservadoPorOpcao: { Uva: 2, Morango: 0, Abacaxi: 0, Laranja: 0 },
        }),
      )
      await assertSucceeds(
        patchNeed('n1', {
          opcoes: ['Uva', 'Morango', 'Abacaxi', 'Laranja', 'Caju'],
          opcoesNorm: ['uva', 'morango', 'abacaxi', 'laranja', 'caju'],
          reservadoPorOpcao: { Uva: 2, Morango: 0, Abacaxi: 0, Laranja: 0, Caju: 0 },
        }),
      )
    })
  })
})
