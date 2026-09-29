/** The two palettes supported by the extension popup. */
export type Theme = 'light' | 'dark'

/** The local-storage key used for an explicit popup theme choice. */
export const THEME_STORAGE_KEY = 'theme'

/** Convert the browser's dark-mode preference into a popup theme. */
export const systemTheme = (prefersDark: boolean): Theme => prefersDark ? 'dark' : 'light'

/** Use a stored palette when it is recognized, otherwise use the fallback. */
export const resolveTheme = (stored: unknown, fallback: Theme): Theme =>
  stored === 'dark' || stored === 'light' ? stored : fallback
