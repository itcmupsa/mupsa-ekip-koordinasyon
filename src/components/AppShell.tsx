import { useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import DesktopSidebar from './DesktopSidebar'
import MobileBottomNavigation from './MobileBottomNavigation'
import MobileHeader from './MobileHeader'
import MobileMoreSheet from './MobileMoreSheet'
import { supabase } from '../lib/supabaseClient'
import { detachPushSubscriptionForLogout } from '../lib/pushNotifications'

interface AppShellProps {
  children: ReactNode
  isSuperAdmin: boolean
  displayName: string
  roleLabel: string
  onSignOut: () => void
}

export default function AppShell({ children, isSuperAdmin, displayName, roleLabel, onSignOut }: AppShellProps) {
  const [isMoreOpen, setIsMoreOpen] = useState(false)
  const location = useLocation()

  async function handleSafeSignOut() {
    const { data } = await supabase.auth.getUser()
    if (data.user) await detachPushSubscriptionForLogout(data.user.id)
    onSignOut()
  }

  useEffect(() => {
    setIsMoreOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)')
    const handleChange = (event: MediaQueryListEvent | MediaQueryList) => {
      if (event.matches) setIsMoreOpen(false)
    }

    handleChange(mediaQuery)
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  return (
    <div className="min-h-screen bg-canvas">
      <DesktopSidebar isSuperAdmin={isSuperAdmin} displayName={displayName} roleLabel={roleLabel} onSignOut={() => void handleSafeSignOut()} />
      <MobileHeader displayName={displayName} />
      <div className="pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0 lg:pl-60">{children}</div>
      <MobileBottomNavigation isMoreOpen={isMoreOpen} onMoreClick={() => setIsMoreOpen((open) => !open)} />
      <MobileMoreSheet isOpen={isMoreOpen} isSuperAdmin={isSuperAdmin} onClose={() => setIsMoreOpen(false)} />
    </div>
  )
}
