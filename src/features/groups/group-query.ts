import { queryOptions } from '@tanstack/react-query'

import {
  getGroupBySlug,
  getGroupsDashboard,
  getInvitePreview,
} from '@/features/groups/group.functions'

export type GroupBySlugQueryData = Awaited<ReturnType<typeof getGroupBySlug>>

export function groupsDashboardQueryOptions() {
  return queryOptions({
    queryKey: ['groups', 'dashboard'],
    queryFn: () => getGroupsDashboard(),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  })
}

export function groupBySlugQueryOptions(slug: string) {
  return queryOptions({
    queryKey: ['groups', 'detail', slug],
    queryFn: () => getGroupBySlug({ data: { slug } }),
    staleTime: 15_000,
    gcTime: 5 * 60_000,
  })
}

export function invitePreviewQueryOptions(token: string) {
  return queryOptions({
    queryKey: ['groups', 'invite', token],
    queryFn: () => getInvitePreview({ data: { token } }),
  })
}
