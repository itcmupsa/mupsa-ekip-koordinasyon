import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { PublicationRow, SharedLink } from '../lib/publicationPlan'

interface Manager { profile_id: string; display_name: string }
interface Plan {
  rows: PublicationRow[]; managers: Manager[]; canManage: boolean
  eventLinks: Record<string, SharedLink[]>; awarenessLinks: Record<string, SharedLink[]>
  loading: boolean; error: boolean
}
const emptyPlan: Plan = { rows: [], managers: [], canManage: false, eventLinks: {}, awarenessLinks: {}, loading: true, error: false }

export function usePublicationPlan(periodId: string | null, refreshKey = 0): Plan {
  const [plan, setPlan] = useState<Plan>(emptyPlan)
  useEffect(() => {
    let active = true
    let busy = false
    setPlan(emptyPlan)
    if (!periodId) return
    async function load() {
      if (busy) return
      busy = true
      try {
        const [entries, managers, permission, events, awareness] = await Promise.all([
          supabase.from('pr_calendar_entries').select('id,title,event_id,awareness_post_id,entry_kind,status,scheduled_date,scheduled_time,channels,reference_links,reference_label,reference_url,assignees:pr_calendar_entry_assignees(profile_id,assignment_source)').eq('period_id', periodId!).is('deleted_at', null).order('scheduled_date').order('scheduled_time'),
          supabase.rpc('get_pr_publication_managers', { target_period_id: periodId }),
          supabase.rpc('can_manage_pr_calendar', { target_period_id: periodId }),
          supabase.from('events').select('id,event_links(id,title,url,deleted_at)').eq('period_id', periodId!).is('deleted_at', null),
          supabase.from('awareness_posts').select('id,drive_folder_url,design_url,share_url').eq('period_id', periodId!).is('deleted_at', null),
        ])
        if (!active) return
        if ([entries, managers, permission, events, awareness].some(r => r.error)) {
          setPlan(p => ({ ...p, loading: false, error: true }))
          return
        }
        const eventLinks: Plan['eventLinks'] = {}
        for (const event of events.data ?? []) {
          eventLinks[event.id] = (event.event_links ?? []).filter(l => !l.deleted_at).map(l => ({ id: l.id, label: l.title, url: l.url }))
        }
        const awarenessLinks: Plan['awarenessLinks'] = {}
        for (const post of awareness.data ?? []) {
          awarenessLinks[post.id] = [
            { id: 'drive', label: 'Ortak Drive klasörü', url: post.drive_folder_url },
            { id: 'design', label: 'Çalışma / tasarım bağlantısı', url: post.design_url },
            { id: 'share', label: 'Mevcut paylaşım bağlantısı', url: post.share_url },
          ].flatMap(l => l.url ? [{ ...l, url: l.url }] : [])
        }
        setPlan({ rows: (entries.data ?? []) as PublicationRow[], managers: (managers.data ?? []) as Manager[], canManage: permission.data === true, eventLinks, awarenessLinks, loading: false, error: false })
      } catch {
        if (active) setPlan(p => ({ ...p, loading: false, error: true }))
      } finally { busy = false }
    }
    void load()
    const refresh = () => { if (document.visibilityState !== 'hidden') void load() }
    window.addEventListener('focus', refresh)
    window.addEventListener('mupsa-publications-changed', refresh)
    document.addEventListener('visibilitychange', refresh)
    const timer = window.setInterval(refresh, 30000)
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('mupsa-publications-changed', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [periodId, refreshKey])
  return plan
}
