import { expect, test } from 'bun:test'
import { resolveTheme, systemTheme } from '../src/popup/theme'

test('system preference maps to the matching default theme', () => {
  expect(systemTheme(true)).toBe('dark')
  expect(systemTheme(false)).toBe('light')
})

test('stored theme wins over the system fallback only for known values', () => {
  expect(resolveTheme('dark', 'light')).toBe('dark')
  expect(resolveTheme('light', 'dark')).toBe('light')
  expect(resolveTheme(undefined, 'dark')).toBe('dark')
  expect(resolveTheme('system', 'light')).toBe('light')
})
