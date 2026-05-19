import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

import { deleteCookie, getCookie, setCookie } from '@tanstack/react-start/server'

import { sanitizeRedirectTo } from '@/lib/redirect'
import { env } from '@/lib/env.server'
import { authCookieOptions, getScopedCookieName } from '@/server/cookie-settings'

const OAUTH_COOKIE = getScopedCookieName('balance-buddy-oauth')
const OAUTH_TTL_SECONDS = 60 * 10

function toBase64Url(value: Buffer | string): string {
  return Buffer.from(value).toString('base64url').replace(/=/g, '')
}

function sign(value: string): string {
  return createHmac('sha256', env.sessionPassword).update(value).digest('base64url')
}

export function issueOAuthState(redirectTo?: string) {
  const state = toBase64Url(randomBytes(32))
  const payload = JSON.stringify({
    state,
    redirectTo: sanitizeRedirectTo(redirectTo),
  })
  const encodedPayload = toBase64Url(payload)
  const cookieValue = `${encodedPayload}.${sign(encodedPayload)}`

  setCookie(OAUTH_COOKIE, cookieValue, {
    ...authCookieOptions,
    maxAge: OAUTH_TTL_SECONDS,
  })

  return state
}

export function consumeOAuthState(expectedState: string) {
  const cookie = getCookie(OAUTH_COOKIE)
  deleteCookie(OAUTH_COOKIE, authCookieOptions)

  if (!cookie) {
    return null
  }

  const [payload, signature] = cookie.split('.')
  if (!payload || !signature) {
    return null
  }

  const actual = Buffer.from(signature)
  const expected = Buffer.from(sign(payload))
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return null
  }

  const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
    state?: string
    redirectTo?: string
  }

  if (!parsed.state || parsed.state !== expectedState) {
    return null
  }

  return {
    redirectTo: sanitizeRedirectTo(parsed.redirectTo),
  }
}
