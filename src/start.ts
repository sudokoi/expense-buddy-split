import { createStart } from '@tanstack/react-start'

import { requestAuthMiddleware } from '@/server/auth-middleware'

export const startInstance = createStart(() => ({
  requestMiddleware: [requestAuthMiddleware],
}))
