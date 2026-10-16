import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, GoogleAuthProvider } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'

const useEmulators = import.meta.env.VITE_USE_EMULATORS === 'true'

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? 'demo-key',
  // O SDK exige authDomain para o login por popup, mesmo com emuladores.
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || (useEmulators ? 'localhost' : undefined),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'demo-lanche-coletivo',
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
})

export const auth = getAuth(app)
export const db = getFirestore(app)
export const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

if (useEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}
