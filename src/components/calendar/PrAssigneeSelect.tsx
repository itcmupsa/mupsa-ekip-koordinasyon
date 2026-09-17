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
    if (source === 'event_owner') return 'Etkinlik sahibi'
    if (source === 'awareness_responsible') return 'Farkındalık sorumlusu'
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
          {autoAssignees.map(a => {
            const member = members.find(m => m.id === a.profileId)
            return (
              <li key={`${a.profileId}-${a.source}`} className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1.5 text-xs font-medium text-ink-soft">
                {member?.name ?? 'Bilinmeyen'} <span className="opacity-60">({sourceLabel(a.source)})</span>
              </li>
            )
          })}
          {manualAssigneeIds.map(id => {
            const member = members.find(m => m.id === id)
            return (
              <li key={id} className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1.5 text-xs font-medium text-brand-dark">
                {member?.name ?? 'Bilinmeyen'}
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => handleRemove(id)}
                    className="relative ml-1 -mr-1 grid h-5 w-5 place-items-center rounded-full hover:bg-brand/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand before:absolute before:left-1/2 before:top-1/2 before:h-11 before:w-11 before:-translate-x-1/2 before:-translate-y-1/2"
                    aria-label={`${member?.name ?? 'Kişiyi'} kaldır`}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3"><path d="M18 6 6 18M6 6l12 12"/></svg>
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
