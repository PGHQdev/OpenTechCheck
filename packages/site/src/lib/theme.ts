/** A manually selected color theme. */
export type Theme = 'light' | 'dark'

/** The color theme preference used by the website. */
export type ThemePreference = Theme | 'system'

/** The local-storage key used for an explicit theme preference. */
export const themeStorageKey = 'opentechcheck-theme'

/**
 * Parse a persisted theme value.
 *
 * @param value - The value read from local storage or the document.
 * @returns A supported theme, or `undefined` for an absent or invalid value.
 */
export function parseTheme(value: string | null | undefined): Theme | undefined {
  return value === 'light' || value === 'dark' ? value : undefined
}

/**
 * Return the other supported color theme.
 *
 * @param theme - The currently resolved color theme.
 * @returns The theme to apply next.
 */
export function toggleTheme(theme: Theme): Theme {
  return theme === 'dark' ? 'light' : 'dark'
}
