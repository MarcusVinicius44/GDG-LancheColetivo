import { useState } from 'react'
import { Link, Outlet } from 'react-router'
import gdgLogo from '@/assets/gdg-logo.svg'
import { useAuth } from '@/hooks/useAuth'
import { isInAppBrowser } from '@/lib/inAppBrowser'

function InAppBrowserNotice() {
  const [copiado, setCopiado] = useState(false)
  async function copiar() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopiado(true)
    } catch {
      window.prompt('Copie o link:', window.location.href)
    }
  }
  return (
    <div className="card mx-auto my-6 max-w-md space-y-3 text-center">
      <h2 className="text-lg font-medium">Abra no navegador</h2>
      <p className="text-sm text-muted">
        O Google não permite entrar por dentro do WhatsApp, Instagram ou Facebook. Toque em “⋮” ou “Abrir no navegador”,
        ou copie o link e cole no Chrome/Safari.
      </p>
      <button type="button" className="btn-primary" onClick={copiar}>
        {copiado ? 'Link copiado!' : 'Copiar link'}
      </button>
    </div>
  )
}

export function Layout() {
  const { user, loading, isAdmin, signIn, signOut } = useAuth()
  const inApp = isInAppBrowser()

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-2 px-4 py-3 sm:flex-row sm:justify-between sm:gap-x-3">
          <Link to="/" className="flex min-w-0 items-center gap-3 font-medium" aria-label="Lanche Coletivo — GDG Aracaju">
            <img src={gdgLogo} alt="Google Developer Groups" className="h-7 w-auto shrink-0 sm:h-8" />
            <span className="hidden truncate border-l border-line pl-3 sm:inline">Lanche Coletivo</span>
          </Link>
          <nav className="flex flex-wrap items-center justify-center gap-2 text-sm">
            {isAdmin && (
              <Link to="/admin" className="btn-ghost">
                Admin
              </Link>
            )}
            {user && (
              <Link to="/perfil" className="btn-ghost">
                Perfil
              </Link>
            )}
            {!loading &&
              (user ? (
                <button type="button" className="btn-ghost" onClick={() => void signOut()}>
                  Sair
                </button>
              ) : (
                !inApp && (
                  <button type="button" className="btn-primary" onClick={() => void signIn()}>
                    Entrar com Google
                  </button>
                )
              ))}
          </nav>
        </div>
        <div className="flex h-1">
          <span className="flex-1 bg-gdg-blue" />
          <span className="flex-1 bg-gdg-red" />
          <span className="flex-1 bg-gdg-yellow" />
          <span className="flex-1 bg-gdg-green" />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        {!user && inApp ? <InAppBrowserNotice /> : <Outlet />}
      </main>
    </div>
  )
}
