import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabaseClient'
import { createBrandTheme, createSerialTaskQueue, DEFAULT_BRAND_COLOR, normalizeHexColor, rgbCssValue } from '../lib/theme'
import { ThemeContext } from './themeContext'

const THEME_CACHE_PREFIX = 'mupsa:theme:'

function readCachedTheme(profileId: string | null | undefined): string | null {
  if (!profileId || typeof window === 'undefined') return null
  try {
    return normalizeHexColor(window.localStorage.getItem(`${THEME_CACHE_PREFIX}${profileId}`) ?? '')
  } catch {
    return null
  }
}

function cacheTheme(profileId: string, color: string | null) {
  try {
    const key = `${THEME_CACHE_PREFIX}${profileId}`
    if (color) window.localStorage.setItem(key, color)
    else window.localStorage.removeItem(key)
  } catch {
    // Sunucu tercihi kalıcıdır; kapalı localStorage yalnız ilk boyamayı etkiler.
  }
}

function applyTheme(color: string) {
  const theme = createBrandTheme(color)
  const root = document.documentElement
  root.style.setProperty('--color-brand', rgbCssValue(theme.brand))
  root.style.setProperty('--color-brand-dark', rgbCssValue(theme.dark))
  root.style.setProperty('--color-brand-soft', rgbCssValue(theme.soft))
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.brand)
}

export function ThemeProvider({ profileId, children }: { profileId: string | null | undefined; children: ReactNode }) {
  const [color, setColor] = useState(() => readCachedTheme(profileId) ?? DEFAULT_BRAND_COLOR)
  const [loading, setLoading] = useState(Boolean(profileId))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const accountGenerationRef = useRef(0)
  const activeProfileRef = useRef(profileId)
  const latestSaveRequestRef = useRef(0)
  const saveQueue = useMemo(() => createSerialTaskQueue(), [])

  useLayoutEffect(() => {
    activeProfileRef.current = profileId
    accountGenerationRef.current += 1
    latestSaveRequestRef.current += 1
    const initialColor = readCachedTheme(profileId) ?? DEFAULT_BRAND_COLOR
    applyTheme(initialColor)
    setColor(initialColor)
    setError(null)
    setSaving(false)
    setLoading(Boolean(profileId))
  }, [profileId])

  useEffect(() => {
    if (!profileId) return

    const loadingProfileId = profileId
    const loadingGeneration = accountGenerationRef.current
    let active = true
    async function loadTheme() {
      const { data, error: loadError } = await supabase
        .from('user_theme_preferences')
        .select('color')
        .eq('profile_id', loadingProfileId)
        .maybeSingle()
      if (!active || activeProfileRef.current !== loadingProfileId || accountGenerationRef.current !== loadingGeneration) return
      if (loadError) {
        setError('Tema tercihin güncellenemedi. Mevcut tema kullanılmaya devam ediyor.')
        setLoading(false)
        return
      }
      const savedColor = normalizeHexColor((data as { color?: string } | null)?.color ?? '')
      const resolvedColor = savedColor ?? DEFAULT_BRAND_COLOR
      cacheTheme(loadingProfileId, savedColor)
      setColor(resolvedColor)
      applyTheme(resolvedColor)
      setLoading(false)
    }
    void loadTheme()
    return () => { active = false }
  }, [profileId])

  const saveColor = useCallback(async (nextColor: string): Promise<boolean> => {
    const normalized = normalizeHexColor(nextColor)
    const savingProfileId = profileId
    const savingGeneration = accountGenerationRef.current
    if (!normalized || !savingProfileId) {
      setError('Geçerli bir renk seçilemedi.')
      return false
    }
    const savingRequest = latestSaveRequestRef.current + 1
    latestSaveRequestRef.current = savingRequest
    setSaving(true)
    setError(null)
    let saveFailed = false
    try {
      const result = await saveQueue.enqueue(() => supabase.from('user_theme_preferences').upsert(
        { profile_id: savingProfileId, color: normalized },
        { onConflict: 'profile_id' },
      ))
      saveFailed = Boolean(result.error)
    } catch {
      saveFailed = true
    }
    if (activeProfileRef.current !== savingProfileId || accountGenerationRef.current !== savingGeneration) return false
    if (latestSaveRequestRef.current !== savingRequest) return false
    if (saveFailed) {
      setError('Tema tercihin kaydedilemedi. Lütfen tekrar dene.')
      setSaving(false)
      return false
    }
    cacheTheme(savingProfileId, normalized)
    setColor(normalized)
    applyTheme(normalized)
    setSaving(false)
    return true
  }, [profileId, saveQueue])

  const value = useMemo(() => ({ color, loading, saving, error, saveColor }), [color, loading, saving, error, saveColor])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
