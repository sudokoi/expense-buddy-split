import { queryOptions } from '@tanstack/react-query'

import { getGroupBySlug, getGroupsDashboard, getInvitePreview } from '@/features/groups/group.functions'

export function groupsDashboardQueryOptions() {
  return queryOptions({
    queryKey: ['groups', 'dashboard'],
    queryFn: () => getGroupsDashboard(),
  })
}

export function groupBySlugQueryOptions(slug: string) {
  return queryOptions({
    queryKey: ['groups', 'detail', slug],
    queryFn: () => getGroupBySlug({ data: { slug } }),
  })
}

export function invitePreviewQueryOptions(token: string) {
  return queryOptions({
    queryKey: ['groups', 'invite', token],
    queryFn: () => getInvitePreview({ data: { token } }),
  })
}
