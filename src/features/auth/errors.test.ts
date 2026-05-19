import { describe, expect, test } from 'vitest'

import { getAuthErrorMessage, getAuthErrorSearch } from '@/features/auth/errors'

describe('auth errors', () => {
  test('maps known auth errors to readable copy', () => {
    expect(getAuthErrorMessage('oauth_state_mismatch')).toContain('expired')
  })

  test('falls back to generic auth error', () => {
    expect(getAuthErrorSearch(new Error('random failure'))).toEqual({
      authError: 'auth_failed',
    })
  })
})
