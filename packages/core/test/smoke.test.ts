import { expect, test } from 'bun:test'
import { VERSION } from '../src/index'

test('core package loads', () => {
  expect(VERSION).toBe('0.0.1')
})
