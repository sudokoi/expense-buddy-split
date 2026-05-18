import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute, notFound, redirect } from '@tanstack/react-router'

import { GroupDetailPage } from '@/components/groups/group-detail-page'
import { AppShell } from '@/components/groups/app-shell'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { groupBySlugQueryOptions } from '@/features/groups/group-query'

export const Route = createFileRoute('/_authenticated/groups/$groupSlug')({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(groupBySlugQueryOptions(params.groupSlug))

    if (!data) {
      throw notFound()
    }

    if (data.kind === 'forbidden') {
      throw redirect({ to: '/groups' })
    }

    if (data.redirectedFromSlug && data.currentSlug !== params.groupSlug) {
      throw redirect({ to: '/groups/$groupSlug', params: { groupSlug: data.currentSlug } })
    }
  },
  component: GroupDetailRoute,
})

function GroupDetailRoute() {
  const { groupSlug } = Route.useParams()
  const { data } = useSuspenseQuery(groupBySlugQueryOptions(groupSlug))

  if (!data) {
    throw notFound()
  }

  if (data.kind === 'forbidden') {
    return (
      <AppShell title="Group access required" description="You need to join this group before you can view its ledger.">
        <Card className="max-w-xl border-border/70 bg-card/75">
          <CardHeader>
            <CardTitle>You are signed in, but not a member of this group</CardTitle>
            <CardDescription>
              Ask an owner for an invite link, or return to your groups dashboard to create one of your own.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/groups" className="text-sm font-medium text-primary">
              Back to groups
            </Link>
          </CardContent>
        </Card>
      </AppShell>
    )
  }

  return (
    <GroupDetailPage
      group={data.group}
      redirectedFromSlug={data.redirectedFromSlug}
      currentUserId={data.currentUserId}
    />
  )
}
