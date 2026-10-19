import { Link } from 'react-router'
import { ComoFunciona } from '@/components/ComoFunciona'
import { useAuth } from '@/hooks/useAuth'
import { useAgora, useEventos } from '@/hooks/useFirestore'
import { isInAppBrowser } from '@/lib/inAppBrowser'
import { rotuloFase } from '@/lib/fase'
import { formatDataHora } from '@/lib/format'

export function Home() {
  const { user, loading: authLoading, signIn } = useAuth()
  const { data: eventos, loading, error } = useEventos()
  const agora = useAgora()

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-medium">Lanche Coletivo</h1>
        <p className="mb-3 text-muted">
          Coffee break feito por todo mundo: escolha o que você leva e acompanhe o que ainda falta.
        </p>
        <ComoFunciona />
      </div>

      {!authLoading && !user && !isInAppBrowser() && (
        <div className="card flex flex-wrap items-center gap-3 border-gdg-blue">
          <p className="min-w-0 flex-1 text-sm">
            <strong>Para escolher o que levar, entre com a sua conta Google.</strong> Você só precisa entrar na hora de
            contribuir; para ver os eventos não precisa.
          </p>
          <button type="button" className="btn-primary" onClick={() => void signIn()}>
            Entrar com Google
          </button>
        </div>
      )}

      {loading && <p className="text-muted">Carregando eventos…</p>}
      {error && (
        <p role="alert" className="card text-sm text-gdg-red">
          Não foi possível carregar os eventos. Atualize a página.
        </p>
      )}
      {!loading && !error && eventos.length === 0 && (
        <p className="card text-muted">Nenhum evento aberto no momento. Volte em breve!</p>
      )}

      <ul className="space-y-3">
        {eventos.map((ev) => {
          const fase = rotuloFase(ev, agora)
          return (
            <li key={ev.id}>
              <Link to={`/e/${ev.id}`} className="card block space-y-2 transition hover:border-gdg-blue">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-medium leading-snug">{ev.titulo}</h2>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${fase.cor}`}>{fase.texto}</span>
                </div>
                <p className="text-sm text-muted">
                  📅 {formatDataHora(ev.inicio)} · 📍 {ev.local}
                </p>
                <p className="text-sm font-medium text-gdg-blue">Ver o que levar →</p>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
