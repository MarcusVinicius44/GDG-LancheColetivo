import { useId, type ReactNode } from 'react'

interface Props {
  rotulo: ReactNode
  /** Texto de ajuda sob o campo. */
  ajuda?: ReactNode
  /** Mensagem de erro (some quando vazia). */
  erro?: string
  /** Recebe o `id` e os atributos de acessibilidade que o controle deve usar. */
  children: (a: { id: string; 'aria-invalid': boolean; 'aria-describedby': string | undefined }) => ReactNode
}

/** Rótulo + controle + ajuda + erro, com os `aria-*` ligados. */
export function Campo({ rotulo, ajuda, erro, children }: Props) {
  const id = useId()
  const descricao = [ajuda ? `${id}-aj` : null, erro ? `${id}-er` : null].filter(Boolean).join(' ') || undefined
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium">
        {rotulo}
      </label>
      {children({ id, 'aria-invalid': Boolean(erro), 'aria-describedby': descricao })}
      {ajuda && (
        <p id={`${id}-aj`} className="text-xs text-muted">
          {ajuda}
        </p>
      )}
      {erro && (
        <p id={`${id}-er`} role="alert" className="text-sm text-gdg-red">
          {erro}
        </p>
      )}
    </div>
  )
}

/** Classe base dos `<input>`/`<select>`/`<textarea>` de formulário. */
export const CLASSE_CONTROLE = 'min-h-11 w-full rounded-xl border border-line bg-white px-3 aria-[invalid=true]:border-gdg-red'
