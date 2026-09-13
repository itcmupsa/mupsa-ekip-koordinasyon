import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { loginPathFor, safeAppReturnTo } from '../lib/authRedirect'

export default function AuthCallback() {
  const [failed, setFailed] = useState(false)
  const returnTo = safeAppReturnTo(new URLSearchParams(window.location.search).get('returnTo'))
  useEffect(() => {
    let isMounted = true
    async function resolveSession() {
      const { data, error } = await supabase.auth.getSession()
      if (!isMounted) return
      if (error || !data.session) { setFailed(true); return }
      window.location.replace(returnTo)
    }
    resolveSession(); return () => { isMounted = false }
  }, [returnTo])
  return <div className="flex min-h-screen items-center justify-center bg-canvas px-4"><div className="w-full max-w-sm rounded-lg border border-canvas-border bg-canvas-surface p-6 text-center shadow-card">{failed ? <div><p className="text-sm font-medium text-ink">Giriş bağlantısı geçersiz veya süresi dolmuş</p><p className="mt-2 text-sm text-ink-soft">Yeni bir giriş bağlantısı istemek için giriş ekranına dönebilirsin.</p><Link to={loginPathFor(returnTo)} className="mt-4 inline-block text-sm font-medium text-brand hover:text-brand-dark">Giriş ekranına dön</Link></div> : <p className="text-sm text-ink-soft">Giriş bağlantısı doğrulanıyor…</p>}</div></div>
}
