import { useSuspenseQuery } from '@tanstack/react-query'
import { Outlet, createFileRoute, useMatchRoute } from '@tanstack/react-router'

import { GroupsDashboard } from '@/components/groups/groups-dashboard'
import { groupsDashboardQueryOptions } from '@/features/groups/group-query'

export const Route = createFileRoute('/_authenticated/groups')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(groupsDashboardQueryOptions())
  },
  component: GroupsRoute,
})

function GroupsRoute() {
  const matchRoute = useMatchRoute()
  const isGroupsIndex = Boolean(matchRoute({ to: '/groups', fuzzy: false }))

  if (!isGroupsIndex) {
    return <Outlet />
  }

  return <GroupsDashboardRoute />
}

function GroupsDashboardRoute() {
  const { data } = useSuspenseQuery(groupsDashboardQueryOptions())

  return <GroupsDashboard groups={data.groups} userLogin={data.userLogin} />
}
