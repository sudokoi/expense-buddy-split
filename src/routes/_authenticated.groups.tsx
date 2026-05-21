import { useSuspenseQuery } from '@tanstack/react-query'
import { Outlet, createFileRoute, useMatchRoute } from '@tanstack/react-router'

import { AppShell } from '@/components/groups/app-shell'
import { GroupsDashboard } from '@/components/groups/groups-dashboard'
import { Card, CardContent } from '@/components/ui/card'
import { groupsDashboardQueryOptions } from '@/features/groups/group-query'

export const Route = createFileRoute('/_authenticated/groups')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(groupsDashboardQueryOptions())
  },
  pendingMs: 120,
  pendingComponent: GroupsPending,
  component: GroupsRoute,
})

function GroupsPending() {
  return (
    <AppShell
      title="Groups"
      description="Loading your groups and recent access state."
    >
      <Card className="border-border/70 bg-card/65">
        <CardContent className="grid gap-3 py-4">
          <div className="h-5 w-32 animate-pulse rounded bg-muted" />
          <div className="h-4 w-72 animate-pulse rounded bg-muted/80" />
          <div className="mt-2 grid gap-3">
            <div className="h-24 animate-pulse rounded-[1.25rem] bg-muted/70" />
            <div className="h-24 animate-pulse rounded-[1.25rem] bg-muted/70" />
            <div className="h-24 animate-pulse rounded-[1.25rem] bg-muted/70" />
          </div>
        </CardContent>
      </Card>
    </AppShell>
  )
}

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
