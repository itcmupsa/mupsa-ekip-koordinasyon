import { useState, type FormEvent, type ReactNode } from 'react'
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

  function renderFormFields(idPrefix: string): ReactNode {
    const emailId = `${idPrefix}-email`
    const passwordId = `${idPrefix}-password`

    return (
      <>
        <div>
          <label htmlFor={emailId} className="mb-1.5 block text-sm font-medium text-ink">E-posta adresi</label>
          <input
            id={emailId}
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
          <label htmlFor={passwordId} className="mb-1.5 block text-sm font-medium text-ink">Şifre</label>
          <div className="relative">
            <input
              id={passwordId}
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
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{errorMessage}</p>
        )}
        <button
          type="submit"
          disabled={status === 'loading'}
          className="mt-1 rounded-md bg-brand px-4 py-2.5 text-sm font-medium text-canvas transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === 'loading' ? 'Giriş yapılıyor…' : 'Giriş yap'}
        </button>
      </>
    )
  }

  const introHeading = "Burası MUPSA'nın çalışma alanı."
  const introBody = 'Fikirlerin paylaşıldığı, etkinliklerin planlandığı ve ekip çalışmalarının birlikte yürütüldüğü yer.'
  const introTag = '#staywithmupsa'

  return (
    <div className="min-h-screen bg-canvas">
      <div className="hidden min-h-screen md:grid md:grid-cols-2">
        <div className="relative flex items-center overflow-hidden px-12 lg:px-16">
          <img src="/login-bg-desktop.webp" alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover object-center" />
          <div className="absolute inset-0 bg-white/35" aria-hidden="true" />
          <div className="relative z-10 max-w-md">
            <h1 className="text-3xl font-semibold leading-tight text-brand-dark lg:text-4xl">{introHeading}</h1>
            <p className="mt-4 text-base text-ink-soft">{introBody}</p>
            <p className="mt-6 text-sm font-medium text-ink-soft">{introTag}</p>
          </div>
        </div>
        <div className="flex items-center justify-center bg-canvas-surface px-12 py-12 lg:px-16">
          <div className="w-full max-w-sm">
            <div className="mb-8 flex flex-col items-center gap-3 text-center">
              <img src="/mupsa-logo.svg" alt="MUPSA Logo" className="h-16 w-auto object-contain" />
              <div>
                <h2 className="text-lg font-semibold text-ink">MUPSA Ekip Koordinasyon</h2>
                <p className="mt-1 text-sm text-ink-soft">Yönetim kurulu girişi</p>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">{renderFormFields('desktop')}</form>
          </div>
        </div>
      </div>

      <div className="relative flex min-h-screen w-full flex-col overflow-hidden px-5 py-10 md:hidden">
        <img src="/login-bg-mobile.webp" alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-white/35" aria-hidden="true" />
        <div className="relative z-10 flex flex-1 flex-col">
          <div className="flex flex-col items-center gap-3 text-center">
            <img src="/mupsa-logo.svg" alt="MUPSA Logo" className="h-14 w-auto object-contain" />
            <div>
              <h1 className="text-xl font-semibold leading-tight text-brand-dark">{introHeading}</h1>
              <p className="mt-2 text-sm text-ink-soft">{introBody}</p>
              <p className="mt-3 text-xs font-medium text-ink-soft">{introTag}</p>
            </div>
          </div>
          <div className="mt-auto pt-10">
            <div className="rounded-lg border border-canvas-border bg-canvas-surface/95 p-6 shadow-card backdrop-blur-[2px]">
              <div className="mb-4 text-center">
                <h2 className="text-base font-semibold text-ink">MUPSA Ekip Koordinasyon</h2>
                <p className="mt-1 text-sm text-ink-soft">Yönetim kurulu girişi</p>
              </div>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">{renderFormFields('mobile')}</form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
