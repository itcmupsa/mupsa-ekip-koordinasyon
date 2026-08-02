import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'

type Status = 'idle' | 'loading' | 'sent' | 'error'

export default function Login() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setStatus('loading'); setErrorMessage('')
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback`, shouldCreateUser: false },
    })
    if (error) { setStatus('error'); setErrorMessage('Bağlantı gönderilemedi. E-posta adresini kontrol edip tekrar deneyin.'); return }
    setStatus('sent')
  }
  return <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12"><div className="w-full max-w-sm">
    <div className="mb-8 flex flex-col items-center gap-3 text-center"><span className="flex h-11 w-11 items-center justify-center rounded-md bg-brand text-canvas" aria-hidden="true">+</span><div><h1 className="text-lg font-semibold text-ink">MUPSA Ekip Koordinasyon</h1><p className="mt-1 text-sm text-ink-soft">Yönetim kurulu girişi</p></div></div>
    <div className="rounded-lg border border-canvas-border bg-canvas-surface p-6 shadow-card">{status === 'sent' ? <div className="text-center"><p className="text-sm font-medium text-ink">Bağlantı gönderildi</p><p className="mt-2 text-sm text-ink-soft"><span className="font-medium text-ink">{email}</span> adresine bir giriş bağlantısı gönderdik. Gelen kutunu ve spam klasörünü kontrol et.</p><button type="button" onClick={() => setStatus('idle')} className="mt-4 text-sm font-medium text-brand hover:text-brand-dark">Farklı bir e-posta kullan</button></div> : <form onSubmit={handleSubmit} className="flex flex-col gap-4"><div><label htmlFor="email" className="mb-1.5 block text-sm font-medium text-ink">E-posta adresi</label><input id="email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ad.soyad@ornek.com" className="w-full rounded-md border border-canvas-border bg-canvas-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-soft/60 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" /></div>{status === 'error' && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{errorMessage}</p>}<button type="submit" disabled={status === 'loading'} className="mt-1 rounded-md bg-brand px-4 py-2.5 text-sm font-medium text-canvas transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60">{status === 'loading' ? 'Gönderiliyor…' : 'Giriş bağlantısı gönder'}</button><p className="text-center text-xs leading-relaxed text-ink-soft">Şifre gerekmez. Kişisel e-posta adresine tek kullanımlık bir giriş bağlantısı gönderilir.</p></form>}</div>
  </div></div>
}
