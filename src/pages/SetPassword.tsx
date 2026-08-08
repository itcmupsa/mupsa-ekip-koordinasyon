import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

type Status = 'idle' | 'loading' | 'success' | 'error'

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
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-md bg-brand text-canvas" aria-hidden="true">
            +
          </span>
          <div>
            <h1 className="text-lg font-semibold text-ink">MUPSA Ekip Koordinasyon</h1>
            <p className="mt-1 text-sm text-ink-soft">Yeni şifre belirleme</p>
          </div>
        </div>
        <div className="rounded-lg border border-canvas-border bg-canvas-surface p-6 shadow-card">
          {status === 'success' ? (
            <div className="text-center">
              <p className="text-sm font-medium text-green-700">Şifreniz başarıyla oluşturuldu.</p>
              <p className="mt-2 text-sm text-ink-soft">Uygulamaya yönlendiriliyorsunuz…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
                    className="w-full rounded-md border border-canvas-border bg-canvas-surface px-3 py-2.5 pr-14 text-sm text-ink placeholder:text-ink-soft/60 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                  />
                  <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute inset-y-0 right-0 flex items-center pr-3 text-xs font-medium text-ink-soft hover:text-ink focus:outline-none">
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
                  className="w-full rounded-md border border-canvas-border bg-canvas-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-soft/60 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </div>
              {status === 'error' && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{errorMessage}</p>}
              <button type="submit" disabled={status === 'loading'} className="mt-1 rounded-md bg-brand px-4 py-2.5 text-sm font-medium text-canvas transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60">
                {status === 'loading' ? 'Kaydediliyor…' : 'Şifreyi kaydet'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
