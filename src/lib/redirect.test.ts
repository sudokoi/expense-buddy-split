import { describe, expect, test } from 'vitest'

import { sanitizeRedirectTo } from '@/lib/redirect'

describe('sanitizeRedirectTo', () => {
  test('falls back to groups for empty redirects', () => {
    expect(sanitizeRedirectTo()).toBe('/groups')
    expect(sanitizeRedirectTo('')).toBe('/groups')
  })

  test('keeps in-app redirects', () => {
    expect(sanitizeRedirectTo('/groups/goa-trip')).toBe('/groups/goa-trip')
  })

  test('rejects external redirects', () => {
    expect(sanitizeRedirectTo('https://example.com')).toBe('/groups')
    expect(sanitizeRedirectTo('//example.com')).toBe('/groups')
  })
})
