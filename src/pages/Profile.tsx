import { useState } from 'react'
import { Navigate } from 'react-router'
import { useAuth } from '@/hooks/useAuth'

export function Profile() {
  const { user, loading } = useAuth()
  const [copiado, setCopiado] = useState(false)

  if (loading) return null
  if (!user) return <Navigate to="/" replace />

  async function copiar() {
    try {
      await navigator.clipboard.writeText(user!.uid)
      setCopiado(true)
    } catch {
      window.prompt('Copie seu UID:', user!.uid)
    }
  }

  return (
    <section className="card space-y-3">
      <h1 className="text-xl font-medium">Meu perfil</h1>
      <p className="text-sm">{user.displayName}</p>
      <div>
        <p className="text-sm text-muted">Seu UID (envie à organização para virar admin):</p>
        <code className="block break-all rounded-xl bg-surface p-3 text-sm">{user.uid}</code>
      </div>
      <button type="button" className="btn-primary" onClick={copiar}>
        {copiado ? 'UID copiado!' : 'Copiar UID'}
      </button>
    </section>
  )
}
