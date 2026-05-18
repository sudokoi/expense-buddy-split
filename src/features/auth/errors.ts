export const authErrorMessages: Record<string, string> = {
  missing_callback_params: 'GitHub did not return the data needed to finish sign-in.',
  oauth_state_mismatch: 'The GitHub authorization request expired or was interrupted. Try again.',
  auth_failed: 'GitHub sign-in failed. Try again.',
} as const

export function getAuthErrorMessage(authError?: string) {
  if (!authError) {
    return null
  }

  return authErrorMessages[authError] ?? authErrorMessages.auth_failed
}

export function getAuthErrorSearch(error: unknown) {
  const message = error instanceof Error ? error.message : ''

  if (message === 'GitHub OAuth state verification failed') {
    return { authError: 'oauth_state_mismatch' }
  }

  return { authError: 'auth_failed' }
}
