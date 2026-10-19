import { doc, runTransaction, writeBatch, type Firestore } from 'firebase/firestore'
import {
  adicionar,
  mover,
  remover,
  renomearPasso1,
  renomearPasso3,
} from '@/lib/categoriasLogic'
import { eventoDe } from '@/lib/converters'
import type { Need } from '@/lib/types'

/** Gravação das categorias do evento (campo `categorias`), sempre sobre a lista atual do servidor. */

/** Lotes pequenos: cada escrita gasta acessos das rules (limite de 20 por lote). */
const LOTE = 8

/** Lê a lista atual numa transação, aplica `fn` e grava (evita sobrescrever alteração de outro admin). */
async function editarLista(db: Firestore, eventId: string, fn: (atual: string[]) => string[]): Promise<void> {
  const ref = doc(db, 'events', eventId)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new Error('Evento não encontrado.')
    tx.update(ref, { categorias: fn(eventoDe(snap).categorias) })
  })
}

export const adicionarCategoria = (db: Firestore, eventId: string, nome: string) =>
  editarLista(db, eventId, (l) => adicionar(l, nome))

export const moverCategoria = (db: Firestore, eventId: string, nome: string, dir: -1 | 1) =>
  editarLista(db, eventId, (l) => mover(l, nome, dir))

/** O chamador garante que a categoria está vazia (rules recusariam editar itens de categoria removida). */
export const removerCategoria = (db: Firestore, eventId: string, nome: string) =>
  editarLista(db, eventId, (l) => remover(l, nome))

/**
 * Renomeia em 3 passos; interromper em qualquer ponto deixa tudo válido (no máximo as duas
 * categorias existem ao mesmo tempo e dá para repetir):
 * 1. o nome novo entra na lista, logo depois do antigo; 2. os itens migram (lotes de 8);
 * 3. o nome antigo sai da lista.
 */
export async function renomearCategoria(
  db: Firestore,
  eventId: string,
  de: string,
  para: string,
  itens: readonly Need[],
): Promise<void> {
  const novo = para.trim()
  await editarLista(db, eventId, (l) => renomearPasso1(l, de, novo))
  const doDe = itens.filter((n) => n.categoria === de)
  for (let i = 0; i < doDe.length; i += LOTE) {
    const b = writeBatch(db)
    for (const n of doDe.slice(i, i + LOTE)) b.update(doc(db, 'events', eventId, 'needs', n.id), { categoria: novo })
    await b.commit()
  }
  await editarLista(db, eventId, (l) => renomearPasso3(l, de))
}
