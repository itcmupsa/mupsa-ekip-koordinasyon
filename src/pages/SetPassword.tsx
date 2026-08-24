import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

type Status = 'idle' | 'loading' | 'success' | 'error'

function PasswordIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true"><path d="M12 3 5 6v5c0 4.8 2.8 8.1 7 10 4.2-1.9 7-5.2 7-10V6z" /><rect x="9" y="10" width="6" height="5" rx="1" /><path d="M10.5 10V8.5a1.5 1.5 0 0 1 3 0V10" /></svg>
}

export default function SetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')

    if (!password || !confirmPassword) {
      setStatus('error')
      setErrorMessage('Lütfen tüm alanları doldurun.')
      return
    }

    if (password.length < 8) {
      setStatus('error')
      setErrorMessage('Şifreniz en az 8 karakter uzunluğunda olmalıdır.')
      return
    }

    if (password !== confirmPassword) {
      setStatus('error')
      setErrorMessage('Şifreler eşleşmiyor. Lütfen kontrol edin.')
      return
    }

    setStatus('loading')
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setStatus('error')
      setErrorMessage('Şifre oluşturulurken bir hata meydana geldi. Lütfen tekrar deneyin.')
      return
    }

    setStatus('success')
    window.setTimeout(() => navigate('/app'), 2000)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-8 sm:py-12">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-dark text-white shadow-card" aria-hidden="true"><PasswordIcon /></span>
          <div>
            <h1 className="text-xl font-semibold text-ink">MUPSA Ekip Koordinasyon</h1>
            <p className="mt-1 text-sm text-ink-soft">Yeni şifre belirleme</p>
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-canvas-border bg-canvas-surface shadow-card">
          <div className="flex items-center gap-3 border-b border-canvas-border px-4 py-4 sm:px-6">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-dark"><PasswordIcon /></span>
            <div><h2 className="text-base font-semibold text-ink">Güvenli bir şifre oluştur</h2><p className="mt-0.5 text-xs text-ink-soft">Yeni şifrenizi iki alana da aynı şekilde girin.</p></div>
          </div>
          {status === 'success' ? (
            <div className="px-4 py-10 text-center sm:px-6">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-2xl text-green-700">✓</span>
              <p className="mt-4 text-base font-semibold text-green-700">Şifreniz başarıyla oluşturuldu.</p>
              <p className="mt-2 text-sm text-ink-soft">Uygulamaya yönlendiriliyorsunuz…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 p-4 sm:p-6">
              <section className="rounded-xl border border-canvas-border bg-canvas p-4">
                <div className="grid gap-4">
                <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-ink">Yeni şifre</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="En az 8 karakter"
                    className="min-h-11 w-full rounded-lg border border-canvas-border bg-canvas-surface px-3 py-2.5 pr-16 text-sm text-ink placeholder:text-ink-soft/60 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
                  />
                  <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute inset-y-0 right-0 flex min-w-14 items-center justify-center text-xs font-semibold text-brand-dark hover:text-brand focus:outline-none">
                    {showPassword ? 'Gizle' : 'Göster'}
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-ink">Yeni şifre (tekrar)</label>
                <input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Şifrenizi doğrulayın"
                  className="min-h-11 w-full rounded-lg border border-canvas-border bg-canvas-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-soft/60 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
                />
              </div>
                </div>
              </section>
              <div className="rounded-xl border border-brand/15 bg-brand-soft/30 px-4 py-3"><p className="text-xs font-semibold text-ink">Şifre kuralları</p><ul className="mt-2 grid gap-1 text-xs text-ink-soft sm:grid-cols-2"><li>• En az 8 karakter</li><li>• İki alan birbiriyle eşleşmeli</li></ul></div>
              {status === 'error' && <p role="alert" className="rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">{errorMessage}</p>}
              </div>
              <div className="border-t border-canvas-border bg-canvas px-4 py-4 sm:px-6"><button type="submit" disabled={status === 'loading'} className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-brand-dark px-5 text-sm font-semibold text-white transition-colors hover:bg-brand disabled:cursor-not-allowed disabled:opacity-60">{status === 'loading' ? 'Kaydediliyor…' : 'Şifreyi kaydet'}</button></div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
