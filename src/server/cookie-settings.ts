import { env } from '@/lib/env.server'
import { getScopedCookieName as getCookieName, shouldUseSecureCookies } from '@/lib/cookies'

const usesSecureCookies = shouldUseSecureCookies(env.appOrigin)

export const authCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: usesSecureCookies,
  path: '/',
}

export function getScopedCookieName(name: string) {
  return getCookieName(name, env.appOrigin)
}
