import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'

interface MembershipStatus { displayName: string; hasActiveMembership: boolean; periodLabel: string | null; loading: boolean }

export function useMembershipStatus(session: Session | null): MembershipStatus {
  const [displayName, setDisplayName] = useState('')
  const [hasActiveMembership, setHasActiveMembership] = useState(false)
  const [periodLabel, setPeriodLabel] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) { setLoading(false); return }
    let isMounted = true
    setLoading(true)
    async function loadStatus() {
      const userId = session!.user.id
      const fallbackName = session!.user.email ?? 'Kullanıcı'
      const [profileResult, membershipResult] = await Promise.all([
        supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle(),
        supabase.from('period_memberships').select('id, is_active, periods!inner(label, is_active)').eq('profile_id', userId).eq('is_active', true).eq('periods.is_active', true).limit(1).maybeSingle(),
      ])
      if (!isMounted) return
      setDisplayName(profileResult.data?.display_name || fallbackName)
      const activePeriod = membershipResult.data?.periods as { label: string; is_active: boolean } | { label: string; is_active: boolean }[] | undefined
      if (membershipResult.data && activePeriod) {
        const period = Array.isArray(activePeriod) ? activePeriod[0] : activePeriod
        setHasActiveMembership(true); setPeriodLabel(period?.label ?? null)
      } else { setHasActiveMembership(false); setPeriodLabel(null) }
      setLoading(false)
    }
    loadStatus()
    return () => { isMounted = false }
  }, [session])

  return { displayName, hasActiveMembership, periodLabel, loading }
}
