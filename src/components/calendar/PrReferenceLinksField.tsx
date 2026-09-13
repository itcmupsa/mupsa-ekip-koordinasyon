import { useState } from 'react'
import { isSafeExternalUrl, MAX_PR_REFERENCE_LINKS, type PrReferenceLink } from '../../lib/prCalendar'

function createLink(): PrReferenceLink {
  return { id: crypto.randomUUID(), label: '', url: '' }
}

export default function PrReferenceLinksField({ value, onChange }: { value: PrReferenceLink[]; onChange: (links: PrReferenceLink[]) => void }) {
  const [touched, setTouched] = useState<Set<string>>(() => new Set())

  function update(id: string, field: 'label' | 'url', nextValue: string) {
    onChange(value.map((link) => link.id === id ? { ...link, [field]: nextValue } : link))
  }

  function remove(id: string) {
    onChange(value.filter((link) => link.id !== id))
    setTouched((current) => {
      const next = new Set(current)
      next.delete(id)
      return next
    })
  }

  return <section aria-labelledby="pr-reference-links-title" className="rounded-xl border border-canvas-border bg-canvas/50 p-3 sm:p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 id="pr-reference-links-title" className="text-sm font-semibold text-ink">Bağlantılar</h3>
        <p className="mt-1 text-xs leading-5 text-ink-soft">Instagram gönderisi, Drive dosyası veya brief gibi bağlantıları ayrı ayrı ekleyin.</p>
      </div>
      <button
        type="button"
        onClick={() => onChange([...value, createLink()])}
        disabled={value.length >= MAX_PR_REFERENCE_LINKS}
        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-brand/30 bg-white px-3 text-sm font-semibold text-brand-dark transition-colors hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-50"
      >
        + Bağlantı ekle
      </button>
    </div>

    <p className="sr-only" aria-live="polite">{value.length} bağlantı alanı açık.</p>
    {value.length === 0 ? <p className="mt-3 rounded-lg border border-dashed border-canvas-border bg-white px-3 py-4 text-center text-sm text-ink-soft">Henüz bağlantı eklenmedi.</p> : null}

    <div className="mt-3 space-y-3">
      {value.map((link, index) => {
        const wasTouched = touched.has(link.id)
        const missingLabel = wasTouched && !link.label.trim() && Boolean(link.url.trim())
        const missingUrl = wasTouched && Boolean(link.label.trim()) && !link.url.trim()
        const invalidUrl = wasTouched && Boolean(link.url.trim()) && !isSafeExternalUrl(link.url.trim())
        const urlError = missingUrl ? 'Bağlantı adresini girin.' : invalidUrl ? 'Adres http:// veya https:// ile başlamalı.' : null
        return <fieldset key={link.id} className="rounded-xl border border-canvas-border bg-white p-3">
          <legend className="px-1 text-xs font-semibold text-ink-soft">Bağlantı {index + 1}</legend>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto] sm:items-start">
            <label className="block text-sm font-medium text-ink">
              Bağlantı adı
              <input
                value={link.label}
                maxLength={160}
                onChange={(event) => update(link.id, 'label', event.target.value)}
                onBlur={() => setTouched((current) => new Set(current).add(link.id))}
                placeholder="Örn. Instagram gönderisi"
                aria-invalid={missingLabel || undefined}
                className="mt-1.5 min-h-11 w-full rounded-lg border border-canvas-border px-3 font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              />
              {missingLabel ? <span className="mt-1 block text-xs text-danger">Bağlantı adını girin.</span> : null}
            </label>
            <label className="block text-sm font-medium text-ink">
              Bağlantı adresi
              <input
                type="url"
                value={link.url}
                maxLength={2048}
                onChange={(event) => update(link.id, 'url', event.target.value)}
                onBlur={() => setTouched((current) => new Set(current).add(link.id))}
                placeholder="https://…"
                aria-invalid={Boolean(urlError) || undefined}
                className="mt-1.5 min-h-11 w-full rounded-lg border border-canvas-border px-3 font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              />
              {urlError ? <span className="mt-1 block text-xs text-danger">{urlError}</span> : null}
            </label>
            <button
              type="button"
              onClick={() => remove(link.id)}
              aria-label={`${index + 1}. bağlantıyı kaldır`}
              className="min-h-11 rounded-lg border border-red-200 px-3 text-sm font-semibold text-danger transition-colors hover:bg-danger-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger sm:mt-[26px]"
            >
              Kaldır
            </button>
          </div>
        </fieldset>
      })}
    </div>
  </section>
}
