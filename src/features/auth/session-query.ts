import { queryOptions } from '@tanstack/react-query'

import { getOptionalSession } from '@/features/auth/github.functions'

export function optionalSessionQueryOptions() {
  return queryOptions({
    queryKey: ['session', 'optional'],
    queryFn: () => getOptionalSession(),
  })
}
