import { ProgressBar } from '@/components/ProgressBar'
import { completa, descreverPledge, restante, restanteDaOpcao } from '@/lib/needView'
import type { Need, Pledge } from '@/lib/types'

const TAG_LABEL: Record<string, string> = {
  vegano: '🌱 vegano',
  'sem-gluten': 'sem glúten',
  'sem-lactose': 'sem lactose',
}

export type AcaoNeed =
  | { tipo: 'levar' }
  | { tipo: 'editar' }
  | { tipo: 'reduzir' }
  | { tipo: 'entrar' }
  | { tipo: 'bloqueada'; motivo: string }

interface Props {
  need: Need
  /** todas as pledges desta necessidade (nomes + qty são públicos). */
  pledges: Pledge[]
  minha: Pledge | null
  acao: AcaoNeed
  onAcao: () => void
}

function textoBotao(a: AcaoNeed) {
  switch (a.tipo) {
    case 'levar':
      return 'Quero levar'
    case 'editar':
      return 'Editar minha parte'
    case 'reduzir':
      return 'Reduzir minha parte'
    case 'entrar':
      return 'Entrar para contribuir'
    case 'bloqueada':
      return a.motivo
  }
}

export function NeedCard({ need, pledges, minha, acao, onAcao }: Props) {
  const cheia = completa(need)
  const falta = restante(need)

  return (
    <article className="card space-y-3" aria-labelledby={`need-${need.id}`}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={`need-${need.id}`} className="font-medium leading-snug">
            {need.nome}
          </h3>
          <p className="text-sm text-muted">
            {need.unidade}
            {need.minPorPessoa > 1 && ` · mín. ${need.minPorPessoa} por pessoa`}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
            cheia ? 'bg-gdg-green/15 text-gdg-green' : 'bg-gdg-blue/10 text-gdg-blue'
          }`}
        >
          {cheia ? 'Completo ✓' : `Faltam ${falta}`}
        </span>
      </header>

      <div className="space-y-1">
        <ProgressBar valor={need.reservado} meta={need.meta} rotulo={`Progresso de ${need.nome}`} />
        <p className="text-xs text-muted">
          {need.reservado} de {need.meta} reservados
        </p>
      </div>

      {need.tags.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Restrições alimentares">
          {need.tags.map((t) => (
            <li key={t} className="rounded-full border border-line px-2.5 py-0.5 text-xs">
              {TAG_LABEL[t] ?? t}
            </li>
          ))}
        </ul>
      )}

      {need.nota && <p className="text-sm text-muted">{need.nota}</p>}

      {need.opcoes.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Opções">
          {need.opcoes.map((o) => {
            const sobra = restanteDaOpcao(need, o)
            const cheio = sobra === 0
            return (
              <li
                key={o}
                className={`rounded-full border px-2.5 py-0.5 text-xs ${
                  cheio ? 'border-line text-muted line-through' : 'border-gdg-blue/40'
                }`}
              >
                {o}
                <span className="ml-1 text-muted no-underline">
                  {need.reservadoPorOpcao[o] ?? 0}
                  {need.maxPorOpcao !== null && `/${need.maxPorOpcao}`}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {pledges.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer select-none text-muted">
            Quem leva ({pledges.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {pledges.map((p) => (
              <li key={p.id} className={p.id === minha?.id ? 'font-medium' : ''}>
                {descreverPledge(p)}
                {p.id === minha?.id && <span className="text-gdg-blue"> (você)</span>}
              </li>
            ))}
          </ul>
        </details>
      )}

      <button
        type="button"
        className={acao.tipo === 'bloqueada' ? 'btn-ghost w-full' : 'btn-primary w-full'}
        disabled={acao.tipo === 'bloqueada'}
        onClick={onAcao}
      >
        {textoBotao(acao)}
      </button>
    </article>
  )
}
