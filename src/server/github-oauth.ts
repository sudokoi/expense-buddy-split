import { env } from '@/lib/env.server'

export interface GitHubIdentity {
  id: number
  login: string
  name: string | null
  avatarUrl: string
}

interface GitHubTokenResponse {
  access_token?: string
  error?: string
  error_description?: string
}

export function createGitHubAuthorizationUrl(
  state: string,
  redirectUri: string,
) {
  const url = new URL('https://github.com/login/oauth/authorize')
  url.searchParams.set('client_id', env.githubClientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('scope', 'read:user')
  url.searchParams.set('state', state)
  return url.toString()
}

export async function exchangeGitHubCode(code: string, redirectUri: string) {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: env.githubClientId,
      client_secret: env.githubClientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  })

  if (!response.ok) {
    throw new Error('GitHub OAuth token exchange failed')
  }

  const data = (await response.json()) as GitHubTokenResponse
  if (!data.access_token) {
    throw new Error(
      data.error_description ||
        data.error ||
        'GitHub OAuth token exchange failed',
    )
  }

  return { accessToken: data.access_token }
}

export async function getAuthenticatedUser(
  accessToken: string,
): Promise<GitHubIdentity> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': 'balance-buddy',
    },
  })

  if (!response.ok) {
    throw new Error('GitHub user profile request failed')
  }

  const data = (await response.json()) as {
    id: number
    login: string
    name: string | null
    avatar_url: string
  }

  return {
    id: data.id,
    login: data.login,
    name: data.name,
    avatarUrl: data.avatar_url,
  }
}
