import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'

export type AppRole = 'super_admin' | 'coordinator'

interface MembershipStatus {
  displayName: string
  hasActiveMembership: boolean
  periodLabel: string | null
  profileId: string | null
  periodId: string | null
  appRole: AppRole | null
  coordinatorRoleName: string | null
  coordinatorRoleSlug: string | null
  loading: boolean
}

interface PeriodRelation {
  label: string
  is_active: boolean
}

interface CoordinatorRoleRelation {
  name: string
  slug: string
}

function pickOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

export function useMembershipStatus(session: Session | null): MembershipStatus {
  const [displayName, setDisplayName] = useState('')
  const [hasActiveMembership, setHasActiveMembership] = useState(false)
  const [periodLabel, setPeriodLabel] = useState<string | null>(null)
  const [profileId, setProfileId] = useState<string | null>(null)
  const [periodId, setPeriodId] = useState<string | null>(null)
  const [appRole, setAppRole] = useState<AppRole | null>(null)
  const [coordinatorRoleName, setCoordinatorRoleName] = useState<string | null>(null)
  const [coordinatorRoleSlug, setCoordinatorRoleSlug] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) {
      setLoading(false)
      setHasActiveMembership(false)
      setPeriodLabel(null)
      setProfileId(null)
      setPeriodId(null)
      setAppRole(null)
      setCoordinatorRoleName(null)
      setCoordinatorRoleSlug(null)
      return
    }
    let isMounted = true
    setLoading(true)
    async function loadStatus() {
      const userId = session!.user.id
      const fallbackName = session!.user.email ?? 'Kullanıcı'
      const [profileResult, membershipResult, superAdminResult] = await Promise.all([
        supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle(),
        supabase
          .from('period_memberships')
          .select('id, period_id, period_display_name, app_role, is_active, coordinator_roles(name, slug), periods!inner(label, is_active)')
          .eq('profile_id', userId)
          .eq('is_active', true)
          .eq('periods.is_active', true)
          .limit(1)
          .maybeSingle(),
        supabase.rpc('is_super_admin'),
      ])
      if (!isMounted) return

      const membership = membershipResult.data
      setDisplayName(
        (membership?.period_display_name as string | null) ||
          profileResult.data?.display_name ||
          fallbackName,
      )
      const activePeriod = pickOne(
        membership?.periods as PeriodRelation | PeriodRelation[] | null | undefined,
      )

      if (membership && activePeriod) {
        const coordinatorRole = pickOne(
          membership.coordinator_roles as CoordinatorRoleRelation | CoordinatorRoleRelation[] | null | undefined,
        )
        setHasActiveMembership(true)
        setPeriodLabel(activePeriod.label ?? null)
        setProfileId(userId)
        setPeriodId(membership.period_id ?? null)
        setAppRole(superAdminResult.data === true ? 'super_admin' : ((membership.app_role as AppRole | null) ?? null))
        setCoordinatorRoleName(coordinatorRole?.name ?? null)
        setCoordinatorRoleSlug(coordinatorRole?.slug ?? null)
      } else {
        setHasActiveMembership(false)
        setPeriodLabel(null)
        setProfileId(null)
        setPeriodId(null)
        setAppRole(null)
        setCoordinatorRoleName(null)
        setCoordinatorRoleSlug(null)
      }
      setLoading(false)
    }
    loadStatus()
    return () => {
      isMounted = false
    }
  }, [session])

  return {
    displayName,
    hasActiveMembership,
    periodLabel,
    profileId,
    periodId,
    appRole,
    coordinatorRoleName,
    coordinatorRoleSlug,
    loading,
  }
}
