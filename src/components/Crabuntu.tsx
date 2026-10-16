import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import crabuntu from '@/assets/crabuntu.webp'
import { CrabuntuContext } from '@/hooks/useCrabuntu'
import { escolherFrase, type MomentoCrabuntu } from '@/lib/crabuntu'

interface Fala {
  id: number
  texto: string
  momento: MomentoCrabuntu
}

const DURACAO_MS = 5200
const CONFETES = ['🥐', '🍕', '🧃', '🍰', '☕', '🥪']

export function CrabuntuProvider({ children }: { children: ReactNode }) {
  const [fala, setFala] = useState<Fala | null>(null)
  const [saindo, setSaindo] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const contador = useRef(0)

  const dispensar = useCallback(() => {
    clearTimeout(timer.current)
    setSaindo(true)
    timer.current = setTimeout(() => {
      setFala(null)
      setSaindo(false)
    }, 320)
  }, [])

  const falar = useCallback(
    (momento: MomentoCrabuntu, item: string) => {
      clearTimeout(timer.current)
      setSaindo(false)
      setFala({ id: ++contador.current, texto: escolherFrase(momento, item), momento })
      timer.current = setTimeout(dispensar, DURACAO_MS)
    },
    [dispensar],
  )

  useEffect(() => () => clearTimeout(timer.current), [])

  const api = useMemo(() => ({ falar }), [falar])

  return (
    <CrabuntuContext value={api}>
      {children}
      {fala && <CrabuntuToast key={fala.id} fala={fala} saindo={saindo} onFechar={dispensar} />}
    </CrabuntuContext>
  )
}

function CrabuntuToast({ fala, saindo, onFechar }: { fala: Fala; saindo: boolean; onFechar: () => void }) {
  const festa = fala.momento !== 'cancelou'
  return (
    <div
      role="status"
      aria-live="polite"
      className={`crabuntu pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-4 sm:justify-end sm:pr-8 sm:pb-6 ${
        saindo ? 'crabuntu-sai' : 'crabuntu-entra'
      }`}
    >
      <button
        type="button"
        onClick={onFechar}
        aria-label="Fechar mensagem do Crabuntu"
        className="pointer-events-auto relative flex max-w-md items-end gap-1 text-left"
      >
        {festa && (
          <span aria-hidden className="crabuntu-confetes absolute -top-2 right-2 left-2 h-0">
            {CONFETES.map((c, i) => (
              <span key={c} className="crabuntu-confete" style={{ left: `${8 + i * 15}%`, animationDelay: `${i * 90}ms` }}>
                {c}
              </span>
            ))}
          </span>
        )}
        <span className="crabuntu-balao relative mb-8 rounded-2xl border border-line bg-white px-4 py-3 text-sm font-medium shadow-lg">
          {fala.texto}
          <span aria-hidden className="crabuntu-balao-ponta" />
        </span>
        <img
          src={crabuntu}
          alt=""
          width={112}
          height={112}
          className={`crabuntu-img size-24 shrink-0 select-none sm:size-28 ${festa ? 'crabuntu-festa' : ''}`}
          draggable={false}
        />
      </button>
    </div>
  )
}
