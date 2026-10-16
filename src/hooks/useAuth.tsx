import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { createContext, use, useEffect, useMemo, useState, type ReactNode } from 'react'
import { auth, db, googleProvider } from '@/config/firebase'
import { primeiroNome } from '@/lib/format'

interface AuthState {
  user: User | null
  loading: boolean
  isAdmin: boolean
  /** true se existe blocked/{uid} (o próprio usuário pode ler). */
  blocked: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

async function docExists(col: string, uid: string): Promise<boolean> {
  try {
    return (await getDoc(doc(db, col, uid))).exists()
  } catch {
    return false
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [blocked, setBlocked] = useState(false)

  useEffect(
    () =>
      onAuthStateChanged(auth, async (u) => {
        setUser(u)
        if (!u) {
          setIsAdmin(false)
          setBlocked(false)
          setLoading(false)
          return
        }
        const [admin, block] = await Promise.all([docExists('admins', u.uid), docExists('blocked', u.uid)])
        setIsAdmin(admin)
        setBlocked(block)
        setLoading(false)
        // Perfil privado (e-mail só visível a dono e organização). Falha não bloqueia o app.
        setDoc(
          doc(db, 'users', u.uid),
          {
            nome: u.displayName ?? '',
            primeiroNome: primeiroNome(u.displayName),
            email: u.email ?? '',
            ultimoLogin: serverTimestamp(),
          },
          { merge: true },
        ).catch(() => undefined)
      }),
    [],
  )

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      isAdmin,
      blocked,
      signIn: async () => {
        try {
          await signInWithPopup(auth, googleProvider)
        } catch (e) {
          const code = (e as { code?: string }).code
          if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
            await signInWithRedirect(auth, googleProvider)
          } else if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
            throw e
          }
        }
      },
      signOut: () => fbSignOut(auth),
    }),
    [user, loading, isAdmin, blocked],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}

export function useAuth(): AuthState {
  const ctx = use(AuthContext)
  if (!ctx) throw new Error('useAuth fora do AuthProvider')
  return ctx
}
