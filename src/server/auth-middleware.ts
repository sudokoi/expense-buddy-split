import { createMiddleware } from '@tanstack/react-start'
import { useSession } from '@tanstack/react-start/server'

import { createAnonymousAuthState, isAuthenticatedSession } from '@/server/auth.server'
import { authSessionConfig } from '@/server/session'
import type { AuthSessionData } from '@/server/session'

export const requestAuthMiddleware = createMiddleware({ type: 'request' }).server(
  async ({ next }) => {
    const session = await useSession<AuthSessionData>(authSessionConfig)
    const authState = isAuthenticatedSession(session.data)
      ? { isAuthenticated: true, session: session.data }
      : createAnonymousAuthState()

    return next({ context: { auth: authState } })
  },
)

export const requireAuthenticatedSessionMiddleware = createMiddleware({
  type: 'function',
}).server(async ({ next }) => {
  const session = await useSession<AuthSessionData>(authSessionConfig)

  if (!isAuthenticatedSession(session.data)) {
    throw new Error('Unauthorized')
  }

  return next({
    context: {
      auth: {
        isAuthenticated: true,
        session: session.data,
      },
    },
  })
})
