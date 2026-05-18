import { describe, expect, test } from 'vitest'

import { createId } from '@/db/ids'

describe('createId', () => {
  test('returns uuid-like ids', () => {
    expect(createId()).toMatch(/^[0-9a-f-]{36}$/)
  })
})
