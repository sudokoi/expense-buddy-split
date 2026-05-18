import { createFileRoute, redirect } from '@tanstack/react-router'

import { sanitizeRedirectTo } from '@/lib/redirect'
import { beginGitHubAuthorization } from '@/features/auth/github.functions'

export const Route = createFileRoute('/connect')({
  validateSearch: (search) => ({
    redirectTo: typeof search.redirectTo === 'string' ? sanitizeRedirectTo(search.redirectTo) : '/groups',
  }),
  beforeLoad: async ({ search }) => {
    await beginGitHubAuthorization({
      data: {
        redirectTo: search.redirectTo,
      },
    })

    throw redirect({ to: '/', search: { authError: undefined, redirectTo: undefined } })
  },
  component: ConnectRoute,
})

function ConnectRoute() {
  return null
}
