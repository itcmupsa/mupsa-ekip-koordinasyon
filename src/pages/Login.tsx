import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

type Status = 'idle' | 'loading' | 'error'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('loading')
    setErrorMessage('')

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      setStatus('error')
      setErrorMessage('Giriş yapılamadı. Lütfen e-posta ve şifrenizi kontrol edip tekrar deneyin.')
      return
    }

    navigate('/app')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <img src="/mupsa-logo.svg" alt="MUPSA Logo" className="h-16 w-auto object-contain" />
          <div>
            <h1 className="text-lg font-semibold text-ink">MUPSA Ekip Koordinasyon</h1>
            <p className="mt-1 text-sm text-ink-soft">Yönetim kurulu girişi</p>
          </div>
        </div>
        <div className="rounded-lg border border-canvas-border bg-canvas-surface p-6 shadow-card">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-ink">
                E-posta adresi
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="ad.soyad@ornek.com"
                className="w-full rounded-md border border-canvas-border bg-canvas-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-soft/60 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-ink">
                Şifre
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-md border border-canvas-border bg-canvas-surface px-3 py-2.5 pr-14 text-sm text-ink placeholder:text-ink-soft/60 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-xs font-medium text-ink-soft hover:text-ink focus:outline-none"
                >
                  {showPassword ? 'Gizle' : 'Göster'}
                </button>
              </div>
            </div>
            {status === 'error' && (
              <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
                {errorMessage}
              </p>
            )}
            <button
              type="submit"
              disabled={status === 'loading'}
              className="mt-1 rounded-md bg-brand px-4 py-2.5 text-sm font-medium text-canvas transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === 'loading' ? 'Giriş yapılıyor…' : 'Giriş yap'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
