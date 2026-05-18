import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import { GroupsDashboard } from '@/components/groups/groups-dashboard'
import { groupsDashboardQueryOptions } from '@/features/groups/group-query'

export const Route = createFileRoute('/_authenticated/groups')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(groupsDashboardQueryOptions())
  },
  component: GroupsDashboardRoute,
})

function GroupsDashboardRoute() {
  const { auth } = Route.useRouteContext()
  const { data } = useSuspenseQuery(groupsDashboardQueryOptions())

  return <GroupsDashboard groups={data.groups} userLogin={auth.session.userLogin || 'unknown'} />
}
