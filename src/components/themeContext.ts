import { createContext, useContext } from 'react'

export interface ThemeContextValue {
  color: string
  loading: boolean
  saving: boolean
  error: string | null
  saveColor: (color: string) => Promise<boolean>
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside ThemeProvider.')
  return context
}
