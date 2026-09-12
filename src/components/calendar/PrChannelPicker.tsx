import { useState } from 'react'

export default function ChannelPicker({ value, onChange }: { value: string[]; onChange: (value: string[]) => void }) {
  const [custom, setCustom] = useState('')
  const presets = ['Instagram', 'WhatsApp', 'LinkedIn', 'X', 'YouTube', 'TikTok', 'Facebook', 'E-posta', 'Web sitesi']
  const options = [...new Set([...presets.map(preset => value.find(item => item.toLowerCase() === preset.toLowerCase()) ?? preset), ...value])]
  const addCustom = () => {
    const name = presets.find(preset => preset.toLowerCase() === custom.trim().toLowerCase()) ?? custom.trim()
    if (!name || value.length >= 20) return
    if (!value.some(item => item.toLowerCase() === name.toLowerCase())) onChange([...value, name])
    setCustom('')
  }
  return <fieldset><legend className="text-sm font-medium">Paylaşım kanalları</legend>
    <p className="mt-1 text-xs text-ink-soft">Birden fazla kanal seçebilirsiniz.</p>
    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">{options.map(channel => <label key={channel} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${value.includes(channel) ? 'border-brand bg-brand-soft text-brand-dark' : 'border-canvas-border text-ink-soft'}`}><input type="checkbox" checked={value.includes(channel)} disabled={!value.includes(channel) && value.length >= 20} onChange={e => onChange(e.target.checked ? [...value, channel] : value.filter(item => item !== channel))} className="h-4 w-4 shrink-0 accent-brand" /><span className="break-words min-w-0">{channel}</span></label>)}</div>
    <div className="mt-2 flex gap-2"><input aria-label="Diğer kanal adı" placeholder="Diğer kanal adı" maxLength={120} value={custom} onChange={e => setCustom(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }} className="min-h-11 min-w-0 flex-1 rounded-lg border border-canvas-border px-3 text-sm" /><button type="button" onClick={addCustom} disabled={!custom.trim() || value.length >= 20} className="min-h-11 rounded-lg border border-canvas-border px-3 text-sm disabled:opacity-50">Ekle</button></div>
  </fieldset>
}
