/**
 * Device-local preferences: appearance, default library view, haptics and the
 * yearly reading goal. These never touch the sheet — they live in localStorage
 * on this device only, which is exactly what the "You" screen promises.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type ThemePreference = 'light' | 'dark' | 'auto'
export type ViewPreference = 'list' | 'grid'

interface Preferences {
  theme: ThemePreference
  defaultView: ViewPreference
  haptics: boolean
  /** Books-per-year goal keyed by year; null when no goal is set. */
  goals: Record<string, number>
}

interface PreferencesContextValue extends Preferences {
  setTheme: (theme: ThemePreference) => void
  setDefaultView: (view: ViewPreference) => void
  setHaptics: (enabled: boolean) => void
  goalFor: (year: number) => number | null
  setGoal: (year: number, goal: number | null) => void
}

const STORAGE_KEY = 'spine.preferences'
const LEGACY_VIEW_KEY = 'spine.libraryView'

const DEFAULTS: Preferences = { theme: 'auto', defaultView: 'list', haptics: true, goals: {} }

const THEME_COLORS = { light: '#f5ead8', dark: '#1d1a17' }

function readPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as Partial<Preferences>) : {}
    const legacyView = localStorage.getItem(LEGACY_VIEW_KEY)
    return {
      theme: parsed.theme === 'light' || parsed.theme === 'dark' ? parsed.theme : 'auto',
      defaultView: parsed.defaultView === 'grid' || (parsed.defaultView === undefined && legacyView === 'grid') ? 'grid' : 'list',
      haptics: parsed.haptics !== false,
      goals: typeof parsed.goals === 'object' && parsed.goals ? parsed.goals : {},
    }
  } catch {
    return DEFAULTS
  }
}

function writePreferences(prefs: Preferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    /* private mode or full storage: preferences just don't persist */
  }
}

/** Applies the theme to <html> so tokens.css can switch palettes, and keeps the browser chrome in step. */
function applyTheme(theme: ThemePreference) {
  const root = document.documentElement
  if (theme === 'auto') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
  const dark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? THEME_COLORS.dark : THEME_COLORS.light)
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null)

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>(readPreferences)

  useEffect(() => {
    writePreferences(prefs)
  }, [prefs])

  useEffect(() => {
    applyTheme(prefs.theme)
    if (prefs.theme !== 'auto') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('auto')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [prefs.theme])

  const setTheme = useCallback((theme: ThemePreference) => setPrefs((p) => ({ ...p, theme })), [])
  const setDefaultView = useCallback((defaultView: ViewPreference) => setPrefs((p) => ({ ...p, defaultView })), [])
  const setHaptics = useCallback((haptics: boolean) => setPrefs((p) => ({ ...p, haptics })), [])
  const goalFor = useCallback((year: number) => prefs.goals[String(year)] ?? null, [prefs.goals])
  const setGoal = useCallback((year: number, goal: number | null) => {
    setPrefs((p) => {
      const goals = { ...p.goals }
      if (goal && goal > 0) goals[String(year)] = goal
      else delete goals[String(year)]
      return { ...p, goals }
    })
  }, [])

  const value = useMemo<PreferencesContextValue>(
    () => ({ ...prefs, setTheme, setDefaultView, setHaptics, goalFor, setGoal }),
    [prefs, setTheme, setDefaultView, setHaptics, goalFor, setGoal],
  )
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext)
  if (!ctx) throw new Error('usePreferences must be used inside PreferencesProvider')
  return ctx
}
