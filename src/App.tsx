import { useEffect, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
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
import CalendarHub from './pages/CalendarHub'
import PrCalendar from './pages/PrCalendar'
import Tasks from './pages/Tasks'
import { syncExistingPushSubscription } from './lib/pushNotifications'
import { ThemeProvider } from './components/ThemeProvider'
import { loginPathFor, safeAppReturnTo } from './lib/authRedirect'

export default function App() {
  const { session, loading } = useSession()
  const location = useLocation()
  const currentPath = `${location.pathname}${location.search}${location.hash}`
  const loginReturnTo = safeAppReturnTo(new URLSearchParams(location.search).get('returnTo'))
  const requireSession = (element: ReactNode) => session
    ? element
    : <Navigate to={loginPathFor(currentPath)} replace />

  useEffect(() => {
    if (!session) return
    // Mevcut izni sessizce tazeler; izin istemek yine kullanıcının düğmeye
    // basmasını gerektirir. Böylece doğrudan alt sayfaya girildiğinde de
    // sunucudaki PWA abonelik kaydı güncel kalır.
    void syncExistingPushSubscription(session.user.id).catch(() => undefined)

    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === 'PUSH_SUBSCRIPTION_CHANGED') {
        void syncExistingPushSubscription(session.user.id).catch(() => undefined)
      }
    }

    navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage)
    return () => navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage)
  }, [session])

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-canvas"><p className="text-sm text-ink-soft">Yükleniyor…</p></div>
  return <ThemeProvider profileId={session?.user.id}><Routes>
    <Route path="/login" element={session ? <Navigate to={loginReturnTo} replace /> : <Login />} />
    <Route path="/auth/callback" element={<AuthCallback />} />
    <Route path="/app" element={requireSession(<AppHome session={session!} />)} />
    <Route path="/app/etkinlikler" element={requireSession(<EventsList session={session!} />)} />
    <Route path="/app/etkinlikler/:eventId" element={requireSession(<EventDetail />)} />
    <Route path="/app/farkindalik" element={requireSession(<AwarenessPosts session={session!} />)} />
    <Route path="/app/takvim" element={requireSession(<LegacyCalendarRoute />)} />
    <Route path="/app/takvimler" element={requireSession(<CalendarHub session={session!} />)} />
    <Route path="/app/takvimler/etkinlik" element={requireSession(<Calendar key="events" session={session!} calendarKind="events" />)} />
    <Route path="/app/takvimler/farkindalik" element={requireSession(<Calendar key="awareness" session={session!} calendarKind="awareness" />)} />
    <Route path="/app/takvimler/pr" element={requireSession(<PrCalendar session={session!} />)} />
    <Route path="/app/gorevler" element={requireSession(<Tasks session={session!} />)} />
    <Route path="/app/yonetim/uyeler" element={requireSession(<AdminMembers session={session!} />)} />
    <Route path="/app/ayarlar/sifre" element={requireSession(<SetPassword />)} />
    <Route path="/app/ayarlar" element={requireSession(<AccountSettings session={session!} />)} />
    <Route path="*" element={<Navigate to={session ? '/app' : '/login'} replace />} />
  </Routes></ThemeProvider>
}

function LegacyCalendarRoute() {
  const location = useLocation()
  return <Navigate to={location.search ? `/app/takvimler/etkinlik${location.search}` : '/app/takvimler'} replace />
}
