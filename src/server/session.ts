import type { SessionConfig } from '@tanstack/react-start/server'

import { env } from '@/lib/env.server'
import { authCookieOptions, getScopedCookieName } from '@/server/cookie-settings'

export interface AuthSessionData {
  githubUserId?: number
  userLogin?: string
  displayName?: string
  avatarUrl?: string
}

export const authSessionConfig: SessionConfig = {
  password: env.sessionPassword,
  name: getScopedCookieName('expense-buddy-split'),
  maxAge: 60 * 60 * 24 * 30,
  cookie: authCookieOptions,
}
