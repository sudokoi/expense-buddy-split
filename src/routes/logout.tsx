import { createFileRoute, redirect } from '@tanstack/react-router'

import { logoutGitHubSession } from '@/features/auth/github.functions'

export const Route = createFileRoute('/logout')({
  beforeLoad: async () => {
    await logoutGitHubSession()
    throw redirect({ to: '/', search: { authError: undefined } })
  },
  component: LogoutRoute,
})

function LogoutRoute() {
  return null
}
