import { createFileRoute, redirect } from '@tanstack/react-router'

import { getAuthErrorSearch } from '@/features/auth/errors'
import { completeGitHubAuthorization } from '@/features/auth/github.functions'

export const Route = createFileRoute('/auth/github/callback')({
  validateSearch: (search) => ({
    code: typeof search.code === 'string' ? search.code : '',
    state: typeof search.state === 'string' ? search.state : '',
  }),
  beforeLoad: async ({ search }) => {
    if (!search.code || !search.state) {
      throw redirect({ to: '/', search: { authError: 'missing_callback_params' } })
    }

    try {
      const result = await completeGitHubAuthorization({
        data: {
          code: search.code,
          state: search.state,
        },
      })

      throw redirect({ href: result.redirectTo })
    } catch (error) {
      throw redirect({ to: '/', search: getAuthErrorSearch(error) })
    }
  },
  component: GitHubCallbackRoute,
})

function GitHubCallbackRoute() {
  return null
}
