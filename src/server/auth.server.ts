import type { AuthSessionData } from '@/server/session'

export interface AuthState {
  isAuthenticated: boolean
  session: AuthSessionData
}

export function createAnonymousAuthState(): AuthState {
  return {
    isAuthenticated: false,
    session: {},
  }
}

export function isAuthenticatedSession(session: AuthSessionData): boolean {
  return Boolean(session.githubUserId && session.userLogin)
}
