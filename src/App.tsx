import { Navigate, Route, Routes } from 'react-router-dom'
import { useSession } from './hooks/useSession'
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import AppHome from './pages/AppHome'

export default function App() {
  const { session, loading } = useSession()
  if (loading) return <div className="flex min-h-screen items-center justify-center bg-canvas"><p className="text-sm text-ink-soft">Yükleniyor…</p></div>
  return <Routes>
    <Route path="/login" element={session ? <Navigate to="/app" replace /> : <Login />} />
    <Route path="/auth/callback" element={<AuthCallback />} />
    <Route path="/app" element={session ? <AppHome session={session} /> : <Navigate to="/login" replace />} />
    <Route path="*" element={<Navigate to={session ? '/app' : '/login'} replace />} />
  </Routes>
}
