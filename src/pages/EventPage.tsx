import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { MinhasContribuicoes } from '@/components/MinhasContribuicoes'
import { NeedCard, type AcaoNeed } from '@/components/NeedCard'
import { PledgeModal } from '@/components/PledgeModal'
import { PrivacyNote } from '@/components/PrivacyNote'
import { ProgressBar } from '@/components/ProgressBar'
import { useAuth } from '@/hooks/useAuth'
import { useCrabuntu } from '@/hooks/useCrabuntu'
import { useAgora, useEvento, useNeeds, usePledges, usePledgesDe } from '@/hooks/useFirestore'
import { usePledgeActions } from '@/hooks/usePledgeActions'
import { explicarFase, rotuloFase } from '@/lib/fase'
import { formatDataHora } from '@/lib/format'
import { agruparPorCategoria, completa, pledgesDaNeed, resumir } from '@/lib/needView'
import { faseDoEvento } from '@/lib/pledgeLogic'

/** Cores do GDG em rodízio pela posição da categoria na lista do evento. */
const CORES_CATEGORIA = ['bg-gdg-blue', 'bg-gdg-red', 'bg-gdg-yellow', 'bg-gdg-green']

export function EventPage() {
  const { id } = useParams()
  const { user, loading: authLoading, blocked, signIn } = useAuth()
  const { data: evento, loading: loadingEv, error: erroEv } = useEvento(id)
  const { data: needs, loading: loadingNeeds } = useNeeds(id)
  const { data: pledges } = usePledges(id)
  const agora = useAgora()
  const acoes = usePledgeActions(id ?? '')
  const crabuntu = useCrabuntu()
  const [abertaId, setAbertaId] = useState<string | null>(null)

  const minhas = usePledgesDe(pledges, user?.uid)
  const categorias = evento?.categorias
  const grupos = useMemo(() => agruparPorCategoria(needs, categorias), [needs, categorias])
  const resumo = useMemo(() => resumir(needs), [needs])

  if (loadingEv || authLoading) return <p className="text-muted">Carregando…</p>
  if (erroEv || !evento) {
    return (
      <section className="card space-y-3">
        <h1 className="text-xl font-medium">Evento não encontrado</h1>
        <p className="text-sm text-muted">O link pode estar errado ou o evento ainda não foi publicado.</p>
        <Link to="/" className="btn-primary w-fit">
          Ver eventos
        </Link>
      </section>
    )
  }

  const fase = faseDoEvento(evento, agora)
  const selo = rotuloFase(evento, agora)
  const abertaNeed = needs.find((n) => n.id === abertaId) ?? null
  const minhasLista = [...minhas.values()]
  const noLimite = minhas.size >= evento.maxNecessidadesPorPessoa

  function acaoDe(needId: string): AcaoNeed {
    const minha = minhas.get(needId)
    const need = needs.find((n) => n.id === needId)
    if (!user) return { tipo: 'entrar' }
    if (evento!.status === 'rascunho') return { tipo: 'bloqueada', motivo: 'Aguardando publicação' }
    if (fase === 'fechado' || fase === 'encerrado') return { tipo: 'bloqueada', motivo: 'Contribuições encerradas' }
    if (minha) return { tipo: fase === 'pos-prazo' ? 'reduzir' : 'editar' }
    if (fase === 'pos-prazo') return { tipo: 'bloqueada', motivo: 'Prazo encerrado' }
    if (blocked) return { tipo: 'bloqueada', motivo: 'Conta sem permissão' }
    if (need && completa(need)) return { tipo: 'bloqueada', motivo: 'Completo ✓' }
    if (noLimite) return { tipo: 'bloqueada', motivo: `Limite de ${evento!.maxNecessidadesPorPessoa} itens` }
    return { tipo: 'levar' }
  }

  return (
    <div className="space-y-5">
      <section className="card space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h1 className="text-2xl font-medium leading-tight">{evento.titulo}</h1>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${selo.cor}`}>{selo.texto}</span>
        </div>
        <p className="text-sm text-muted">
          📅 {formatDataHora(evento.inicio)} · 📍 {evento.local}
        </p>
        {evento.descricao && <p className="text-sm">{evento.descricao}</p>}
        <p className="rounded-xl bg-surface p-3 text-sm">{explicarFase(evento, agora)}</p>

        {resumo.total > 0 && (
          <div className="space-y-1.5">
            <ProgressBar valor={resumo.percentual} meta={100} rotulo="Progresso geral do evento" />
            <p className="text-sm text-muted">
              <strong className="font-medium text-ink">{resumo.percentual}%</strong> do lanche garantido ·{' '}
              {resumo.completas} de {resumo.total} itens completos
              {resumo.faltando > 0 && ` · faltam ${resumo.faltando}`}
            </p>
          </div>
        )}

        {!user && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gdg-blue/30 bg-gdg-blue/5 p-3">
            <p className="flex-1 text-sm">Entre com sua conta Google para escolher o que levar.</p>
            <button type="button" className="btn-primary" onClick={() => void signIn()}>
              Entrar com Google
            </button>
          </div>
        )}
        {blocked && (
          <p role="alert" className="rounded-xl bg-gdg-red/10 p-3 text-sm">
            Sua conta não pode fazer novas contribuições. Você ainda pode reduzir ou cancelar as que já fez. Fale com a
            organização.
          </p>
        )}
        <PrivacyNote />
      </section>

      <MinhasContribuicoes
        pledges={minhasLista}
        needs={needs}
        max={evento.maxNecessidadesPorPessoa}
        onAbrir={setAbertaId}
      />

      {loadingNeeds && <p className="text-muted">Carregando a lista…</p>}
      {!loadingNeeds && needs.length === 0 && (
        <p className="card text-muted">A organização ainda não cadastrou os itens deste evento.</p>
      )}

      {grupos.map((g, i) => (
        <section key={g.categoria} className="space-y-3" aria-labelledby={`cat-${i}`}>
          <h2 id={`cat-${i}`} className="flex items-center gap-2 text-lg font-medium">
            <span aria-hidden className={`size-3 rounded-full ${CORES_CATEGORIA[i % CORES_CATEGORIA.length]}`} />
            {g.categoria}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {g.needs.map((n) => (
              <NeedCard
                key={n.id}
                need={n}
                pledges={pledgesDaNeed(pledges, n.id)}
                minha={minhas.get(n.id) ?? null}
                acao={acaoDe(n.id)}
                onAcao={() => (user ? setAbertaId(n.id) : void signIn())}
              />
            ))}
          </div>
        </section>
      ))}

      {abertaNeed && (
        <PledgeModal
          key={abertaNeed.id}
          need={abertaNeed}
          minha={minhas.get(abertaNeed.id) ?? null}
          fase={fase}
          onClose={() => setAbertaId(null)}
          onSalvar={async (input) => {
            const eraEdicao = minhas.has(abertaNeed.id)
            await acoes.salvar(abertaNeed.id, input)
            crabuntu.falar(eraEdicao ? 'editou' : 'criou', abertaNeed.nome)
          }}
          onCancelar={async () => {
            await acoes.cancelar(abertaNeed.id)
            crabuntu.falar('cancelou', abertaNeed.nome)
          }}
        />
      )}
    </div>
  )
}
