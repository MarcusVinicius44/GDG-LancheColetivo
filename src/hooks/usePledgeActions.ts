import { useMemo } from 'react'
import { db } from '@/config/firebase'
import { useAuth } from '@/hooks/useAuth'
import { erro } from '@/lib/errors'
import { cancelarPledge, salvarPledge } from '@/lib/pledges'
import type { PledgeInput } from '@/lib/types'

/**
 * Ações de pledge já ligadas ao usuário logado. Todas rejeitam com
 * `PledgeError` (mensagem pt-BR em `.message`, `.code` para a UI decidir).
 */
export function usePledgeActions(eventId: string) {
  const { user, blocked } = useAuth()

  return useMemo(() => {
    const ator = () => {
      if (!user) throw erro('nao-logado')
      return { uid: user.uid, nome: user.displayName }
    }
    return {
      salvar: (needId: string, input: PledgeInput) => salvarPledge(db, eventId, needId, ator(), input, { bloqueado: blocked }),
      cancelar: (needId: string) => cancelarPledge(db, eventId, needId, ator()),
      /** Organização: remove pledge alheia (precisa ser admin; as rules garantem). */
      removerDeOutro: (needId: string, donoUid: string) => cancelarPledge(db, eventId, needId, ator(), { donoUid }),
    }
  }, [user, blocked, eventId])
}
