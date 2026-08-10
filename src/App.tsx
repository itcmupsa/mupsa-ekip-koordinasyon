import { Navigate, Route, Routes } from 'react-router-dom'
import { useSession } from './hooks/useSession'
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import AppHome from './pages/AppHome'
import AdminMembers from './pages/AdminMembers'
import EventsList from './pages/EventsList'
import EventDetail from './pages/EventDetail'
import SetPassword from './pages/SetPassword'
import AccountSettings from './pages/AccountSettings'
import AwarenessPosts from './pages/AwarenessPosts'
import Calendar from './pages/Calendar'

export default function App() {
  const { session, loading } = useSession()
  if (loading) return <div className="flex min-h-screen items-center justify-center bg-canvas"><p className="text-sm text-ink-soft">Yükleniyor…</p></div>
  return <Routes>
    <Route path="/login" element={session ? <Navigate to="/app" replace /> : <Login />} />
    <Route path="/auth/callback" element={<AuthCallback />} />
    <Route path="/app" element={session ? <AppHome session={session} /> : <Navigate to="/login" replace />} />
    <Route path="/app/etkinlikler" element={session ? <EventsList session={session} /> : <Navigate to="/login" replace />} />
    <Route path="/app/etkinlikler/:eventId" element={session ? <EventDetail /> : <Navigate to="/login" replace />} />
    <Route path="/app/farkindalik" element={session ? <AwarenessPosts session={session} /> : <Navigate to="/login" replace />} />
    <Route path="/app/takvim" element={session ? <Calendar session={session} /> : <Navigate to="/login" replace />} />
    <Route path="/app/yonetim/uyeler" element={session ? <AdminMembers session={session} /> : <Navigate to="/login" replace />} />
    <Route path="/app/ayarlar/sifre" element={session ? <SetPassword /> : <Navigate to="/login" replace />} />
    <Route path="/app/ayarlar" element={session ? <AccountSettings session={session} /> : <Navigate to="/login" replace />} />
    <Route path="*" element={<Navigate to={session ? '/app' : '/login'} replace />} />
  </Routes>
}
