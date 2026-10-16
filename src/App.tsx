import { BrowserRouter, Route, Routes } from 'react-router'
import { CrabuntuProvider } from '@/components/Crabuntu'
import { Layout } from '@/components/Layout'
import { AuthProvider } from '@/hooks/useAuth'
import { AdminEvento } from '@/pages/admin/AdminEvento'
import { AdminHome } from '@/pages/admin/AdminHome'
import { EventPage } from '@/pages/EventPage'
import { Home } from '@/pages/Home'
import { Profile } from '@/pages/Profile'

export default function App() {
  return (
    <AuthProvider>
      <CrabuntuProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="e/:id" element={<EventPage />} />
              <Route path="perfil" element={<Profile />} />
              <Route path="admin" element={<AdminHome />} />
              <Route path="admin/e/:id" element={<AdminEvento />} />
              <Route path="*" element={<Home />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </CrabuntuProvider>
    </AuthProvider>
  )
}
