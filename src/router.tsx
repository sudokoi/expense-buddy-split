import { QueryClient } from '@tanstack/react-query'
import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'

import type { AuthState } from '@/server/auth.server'

import { routeTree } from './routeTree.gen.ts'

export interface RouterContext {
  auth: AuthState
  queryClient: QueryClient
}

export function getRouter() {
  const queryClient = new QueryClient()

  const router = createTanStackRouter({
    routeTree,
    context: {
      auth: {
        isAuthenticated: false,
        session: {},
      },
      queryClient,
    } satisfies RouterContext,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
  })

  setupRouterSsrQueryIntegration({
    router,
    queryClient,
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
