import { createContext, use } from 'react'
import type { MomentoCrabuntu } from '@/lib/crabuntu'

export interface CrabuntuApi {
  /** Faz o Crabuntu aparecer e falar; `item` entra na fala. */
  falar: (momento: MomentoCrabuntu, item: string) => void
}

export const CrabuntuContext = createContext<CrabuntuApi | null>(null)

export function useCrabuntu(): CrabuntuApi {
  const ctx = use(CrabuntuContext)
  if (!ctx) throw new Error('useCrabuntu fora do CrabuntuProvider')
  return ctx
}
