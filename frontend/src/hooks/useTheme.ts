import { useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'

const THEME_KEY = 'clause-forge-theme'

const getInitialTheme = (): Theme => {
  const stored = localStorage.getItem(THEME_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

// Module-level store so every component (Navbar toggle, Monaco editors)
// shares the same theme state.
let currentTheme: Theme = getInitialTheme()
const listeners = new Set<() => void>()

const applyTheme = (theme: Theme) => {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  localStorage.setItem(THEME_KEY, theme)
}

// Apply before first paint to avoid a light flash
applyTheme(currentTheme)

const setTheme = (theme: Theme) => {
  currentTheme = theme
  applyTheme(theme)
  listeners.forEach((l) => l())
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const useTheme = () => {
  const theme = useSyncExternalStore(subscribe, () => currentTheme)
  return {
    theme,
    isDark: theme === 'dark',
    toggleTheme: () => setTheme(currentTheme === 'dark' ? 'light' : 'dark'),
  }
}
