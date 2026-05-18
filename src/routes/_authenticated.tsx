import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'

import { getAuthenticatedSession } from '@/features/auth/github.functions'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    try {
      await getAuthenticatedSession()
    } catch {
      throw redirect({
        to: '/',
        search: { authError: undefined, redirectTo: location.href },
      })
    }
  },
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  return <Outlet />
}
