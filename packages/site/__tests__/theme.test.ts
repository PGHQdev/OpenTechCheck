import { expect, test } from 'bun:test'
import { parseTheme, toggleTheme } from '../src/lib/theme'

test('parses only supported persisted themes', () => {
  expect(parseTheme('light')).toBe('light')
  expect(parseTheme('dark')).toBe('dark')
  expect(parseTheme('system')).toBeUndefined()
  expect(parseTheme(null)).toBeUndefined()
})

test('toggles the resolved theme', () => {
  expect(toggleTheme('light')).toBe('dark')
  expect(toggleTheme('dark')).toBe('light')
})
