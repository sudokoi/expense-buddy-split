import { describe, expect, test } from 'vitest'

import { defaultMetaTitle, siteConfig } from '@/lib/site'

describe('siteConfig', () => {
  test('exposes a branded meta title', () => {
    expect(siteConfig.name).toBe('BalanceBuddy')
    expect(defaultMetaTitle).toContain(siteConfig.name)
  })
})
