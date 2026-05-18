import { redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useSession } from '@tanstack/react-start/server'
import { z } from 'zod'

import { sanitizeRedirectTo } from '@/lib/redirect'
import { env } from '@/lib/env.server'
import { upsertGitHubUser } from '@/features/auth/user-repository'
import { consumeOAuthState, issueOAuthState } from '@/server/oauth-state'
import { authSessionConfig } from '@/server/session'
import type { AuthSessionData } from '@/server/session'
import {
  createGitHubAuthorizationUrl,
  exchangeGitHubCode,
  getAuthenticatedUser,
} from '@/server/github-oauth'
import { requireAuthenticatedSessionMiddleware } from '@/server/auth-middleware'
import { isAuthenticatedSession } from '@/server/auth.server'

export const beginGitHubAuthorization = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({
      redirectTo: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const state = issueOAuthState(data.redirectTo)

    throw redirect({
      href: createGitHubAuthorizationUrl(state, `${env.appOrigin}/auth/github/callback`),
    })
  })

export const completeGitHubAuthorization = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({
      code: z.string().min(1),
      state: z.string().min(1),
    }),
  )
  .handler(async ({ data }) => {
    const oauthState = consumeOAuthState(data.state)
    if (!oauthState) {
      throw new Error('GitHub OAuth state verification failed')
    }

    const tokenResponse = await exchangeGitHubCode(data.code, `${env.appOrigin}/auth/github/callback`)
    const user = await getAuthenticatedUser(tokenResponse.accessToken)
    const persistedUser = await upsertGitHubUser({
      githubUserId: user.id,
      userLogin: user.login,
      displayName: user.name ?? user.login,
      avatarUrl: user.avatarUrl,
    })
    const session = await useSession<AuthSessionData>(authSessionConfig)

    await session.update(() => ({
      appUserId: persistedUser.id,
      githubUserId: persistedUser.githubUserId,
      userLogin: persistedUser.userLogin,
      displayName: persistedUser.displayName,
      avatarUrl: persistedUser.avatarUrl ?? undefined,
    }))

    return {
      redirectTo: oauthState.redirectTo,
    }
  })

export const getAuthenticatedSession = createServerFn({ method: 'GET' })
  .middleware([requireAuthenticatedSessionMiddleware])
  .handler(async ({ context }) => {
    return context.auth.session
  })

export const getOptionalSession = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await useSession<AuthSessionData>(authSessionConfig)

  return isAuthenticatedSession(session.data) ? session.data : null
})

export const logoutGitHubSession = createServerFn({ method: 'POST' }).handler(async () => {
  const session = await useSession<AuthSessionData>(authSessionConfig)
  await session.clear()
  return { redirectTo: sanitizeRedirectTo('/') }
})
