import { describe, expect, test } from 'vitest'

import { defaultMetaTitle, siteConfig } from '@/lib/site'

describe('siteConfig', () => {
  test('exposes a branded meta title', () => {
    expect(siteConfig.name).toBe('Expense Buddy Split')
    expect(defaultMetaTitle).toContain(siteConfig.name)
  })
})
