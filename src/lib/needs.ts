import { FieldPath, deleteDoc, doc, setDoc, updateDoc, writeBatch, type Firestore } from 'firebase/firestore'
import { gerarIdNeed, needDoc, planoEscritas, proximaOrdem, type TrocaOrdem } from '@/lib/needDoc'
import type { NeedBase } from '@/lib/needForm'
import type { Need } from '@/lib/types'

/**
 * Escrita de itens (needs) pelo admin. Tudo passa pelas Security Rules: o que a tela não
 * consegue provar (ex.: alguém contribuiu agora há pouco) o servidor nega com `permission-denied`.
 * Nada aqui grava `reservado` nem `ultimoUid` — contadores só acompanham uma contribuição.
 */

const needRef = (db: Firestore, eventId: string, needId: string) => doc(db, 'events', eventId, 'needs', needId)

/** Cria um item novo (contadores zerados, `ordem` depois dos existentes). Devolve o id. */
export async function criarNeed(db: Firestore, eventId: string, base: NeedBase, existentes: readonly Need[]): Promise<string> {
  const id = gerarIdNeed(base.nome, new Set(existentes.map((n) => n.id)))
  await setDoc(needRef(db, eventId, id), needDoc(base, proximaOrdem(existentes)))
  return id
}

/**
 * Grava só os campos que mudaram. Devolve `false` se não havia nada a gravar. Com reservas e
 * vários sabores novos, são várias escritas em sequência (ver `planoEscritas`); se uma falhar, o
 * item fica válido, apenas com parte dos sabores novos — a tela recarrega e dá para repetir.
 */
export async function salvarNeed(db: Firestore, eventId: string, atual: Need, novo: NeedBase): Promise<boolean> {
  const etapas = planoEscritas(atual, novo)
  for (const campos of etapas) {
    const pares = campos.flatMap(([caminho, valor]) => [caminho.length === 1 ? caminho[0]! : new FieldPath(...caminho), valor])
    const [campo0, valor0, ...resto] = pares as [string | FieldPath, unknown, ...unknown[]]
    await updateDoc(needRef(db, eventId, atual.id), campo0, valor0, ...resto)
  }
  return etapas.length > 0
}

/** Só com `reservado == 0` (as rules negam o contrário). */
export const removerNeed = (db: Firestore, eventId: string, needId: string) => deleteDoc(needRef(db, eventId, needId))

/** Troca a `ordem` de dois itens vizinhos, juntos. */
export async function aplicarOrdem(db: Firestore, eventId: string, trocas: readonly TrocaOrdem[]): Promise<void> {
  if (trocas.length === 0) return
  const b = writeBatch(db)
  for (const t of trocas) b.update(needRef(db, eventId, t.id), { ordem: t.ordem })
  await b.commit()
}
