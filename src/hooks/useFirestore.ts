import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
  type DocumentSnapshot,
  type Query,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'
import { db } from '@/config/firebase'
import { useAuth } from '@/hooks/useAuth'
import { eventoDe, needDe, pledgeDe } from '@/lib/converters'
import type { Cancelamento, Usuario } from '@/lib/exportar'
import type { Evento, Need, Pledge } from '@/lib/types'

export interface Live<T> {
  data: T
  loading: boolean
  error: Error | null
}

/** Assina uma query; `key` muda ⇒ reassina. `null` = ainda não dá para consultar. */
function useQueryLive<T>(
  make: () => Query | null,
  map: (s: QueryDocumentSnapshot) => T,
  key: string,
): Live<T[]> {
  const [state, setState] = useState<{ key: string; data: T[]; error: Error | null } | null>(null)

  useEffect(() => {
    const q = make()
    if (!q) return
    return onSnapshot(
      q,
      (snap) => setState({ key, data: snap.docs.map(map), error: null }),
      (error) => setState({ key, data: [], error }),
    )
    // `make`/`map` são estáveis por construção (dependem só de `key`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const atual = state?.key === key ? state : null
  return { data: atual?.data ?? [], loading: atual === null, error: atual?.error ?? null }
}

/**
 * Eventos visíveis: o público vê `aberto`/`fechado`; a organização vê também
 * `rascunho` (as rules só provam a leitura com o filtro `in`).
 */
export function useEventos(): Live<Evento[]> {
  const { isAdmin, loading } = useAuth()
  const live = useQueryLive(
    () =>
      loading
        ? null
        : isAdmin
          ? query(collection(db, 'events'), orderBy('inicio', 'desc'))
          : // sem orderBy: `in` + orderBy exigiria índice composto (o emulador não cobra, o Firestore real sim)
            query(collection(db, 'events'), where('status', 'in', ['aberto', 'fechado'])),
    eventoDe,
    `eventos:${loading}:${isAdmin}`,
  )
  const ordenados = useMemo(() => [...live.data].sort((a, b) => b.inicio.getTime() - a.inicio.getTime()), [live.data])
  return { ...live, data: ordenados, loading: loading || live.loading }
}

export function useEvento(id: string | undefined): Live<Evento | null> {
  const [state, setState] = useState<{ id: string; data: Evento | null; error: Error | null } | null>(null)

  useEffect(() => {
    if (!id) return
    return onSnapshot(
      doc(db, 'events', id),
      (s: DocumentSnapshot) => setState({ id, data: s.exists() ? eventoDe(s) : null, error: null }),
      (error) => setState({ id, data: null, error }),
    )
  }, [id])

  const atual = state?.id === id ? state : null
  return { data: atual?.data ?? null, loading: !!id && atual === null, error: atual?.error ?? null }
}

export function useNeeds(eventId: string | undefined): Live<Need[]> {
  return useQueryLive(
    () => (eventId ? query(collection(db, 'events', eventId, 'needs'), orderBy('ordem')) : null),
    needDe,
    `needs:${eventId}`,
  )
}

/** Todas as pledges do evento (nomes + qty são públicos): "quem leva o quê". */
export function usePledges(eventId: string | undefined): Live<Pledge[]> {
  return useQueryLive(
    () => (eventId ? collection(db, 'events', eventId, 'pledges') : null),
    pledgeDe,
    `pledges:${eventId}`,
  )
}

/** Pledges de `uid` indexadas por `needId`. */
export function usePledgesDe(pledges: Pledge[], uid: string | undefined): Map<string, Pledge> {
  return useMemo(() => new Map(pledges.filter((p) => p.uid === uid).map((p) => [p.needId, p])), [pledges, uid])
}

/** Relógio que reavalia fases (prazo/início) sem recarregar a página. */
export function useAgora(intervaloMs = 30_000): Date {
  const [agora, setAgora] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), intervaloMs)
    return () => clearInterval(t)
  }, [intervaloMs])
  return agora
}

// ---- Consultas da organização (as rules só liberam para admin) ----

export interface Bloqueio {
  uid: string
  motivo: string
}

/** `ativo=false` ⇒ não consulta (evita erro de permissão para quem não é admin). */
export function useBloqueios(ativo: boolean): Live<Bloqueio[]> {
  return useQueryLive(
    () => (ativo ? collection(db, 'blocked') : null),
    (s) => ({ uid: s.id, motivo: (s.data().motivo as string) ?? '' }),
    `blocked:${ativo}`,
  )
}

export function useCancelamentos(eventId: string | undefined, ativo: boolean): Live<Cancelamento[]> {
  return useQueryLive(
    () => (ativo && eventId ? collection(db, 'events', eventId, 'cancelamentos') : null),
    (s) => {
      const d = s.data()
      return { id: s.id, needId: d.needId, uid: d.uid, primeiroNome: d.primeiroNome ?? 'Participante', qty: d.qty ?? 0 }
    },
    `cancel:${eventId}:${ativo}`,
  )
}

/** uid → nome/e-mail (coleção `users`; e-mail só a organização enxerga). */
export function useUsuarios(ativo: boolean): Live<Map<string, Usuario>> {
  const live = useQueryLive(
    () => (ativo ? collection(db, 'users') : null),
    (s) => ({ uid: s.id, nome: (s.data().nome as string) ?? '', email: (s.data().email as string) ?? '' }),
    `users:${ativo}`,
  )
  const mapa = useMemo(() => new Map(live.data.map((u) => [u.uid, { nome: u.nome, email: u.email }])), [live.data])
  return { ...live, data: mapa }
}
