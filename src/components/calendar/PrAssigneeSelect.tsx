import { useState } from 'react'

interface PrAssigneeSelectProps {
  label: string
  manualAssigneeIds: string[]
  autoAssignees: Array<{ profileId: string; source: 'event_owner' | 'awareness_responsible' }>
  members: Array<{ id: string; name: string }>
  onChange: (value: string[]) => void
  disabled?: boolean
}

export default function PrAssigneeSelect({ label, manualAssigneeIds, autoAssignees, members, onChange, disabled }: PrAssigneeSelectProps) {
  const [selected, setSelected] = useState('')
  const [announcement, setAnnouncement] = useState('')

  const handleAdd = (id: string) => {
    if (id && !manualAssigneeIds.includes(id)) {
      onChange([...manualAssigneeIds, id])
      const member = members.find(m => m.id === id)
      setAnnouncement(`${member?.name ?? 'Üye'} eklendi.`)
    }
    setSelected('')
  }

  const handleRemove = (id: string) => {
    onChange(manualAssigneeIds.filter(v => v !== id))
    const member = members.find(m => m.id === id)
    setAnnouncement(`${member?.name ?? 'Üye'} kaldırıldı.`)
  }

  const availableMembers = members.filter(m => !manualAssigneeIds.includes(m.id))

  const sourceLabel = (source: 'event_owner' | 'awareness_responsible') => {
    if (source === 'event_owner') return 'Etkinlik yetkilisi'
    if (source === 'awareness_responsible') return 'Farkındalık yetkilisi'
    return source
  }

  return (
    <div>
      <div aria-live="polite" className="sr-only">{announcement}</div>
      <label className="block text-sm font-medium text-ink">
        {label}
        <select
          value={selected}
          onChange={(e) => handleAdd(e.target.value)}
          disabled={disabled || availableMembers.length === 0}
          className="mt-1.5 min-h-[44px] w-full rounded-lg border border-canvas-border px-3 font-normal disabled:opacity-60"
        >
          <option value="">{availableMembers.length === 0 ? 'Tüm uygun üyeler atandı' : 'Üye seç ve ekle'}</option>
          {availableMembers.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </label>
      {(manualAssigneeIds.length > 0 || autoAssignees.length > 0) && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {[...new Set([...autoAssignees.map(a => a.profileId), ...manualAssigneeIds])].map(id => {
            const member = members.find(m => m.id === id)
            const isManual = manualAssigneeIds.includes(id)
            const roles: string[] = [...new Set(autoAssignees.filter(a => a.profileId === id).map(a => sourceLabel(a.source)))]
            if (isManual) roles.push('İçeriğe atanan')
            return <li key={id} className="inline-flex items-center gap-2 rounded-xl bg-brand-soft px-3 py-1 text-xs font-medium text-brand-dark">
              <span>{member?.name ?? 'Bilinmeyen'} <span className="font-normal">({roles.join(' · ')})</span></span>
              {isManual && !disabled ? <button type="button" onClick={() => handleRemove(id)} aria-label={`${member?.name ?? 'Kişinin'} manuel atamasını kaldır`} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg hover:bg-brand/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">×</button> : null}
            </li>
          })}
        </ul>
      )}
    </div>
  )
}
