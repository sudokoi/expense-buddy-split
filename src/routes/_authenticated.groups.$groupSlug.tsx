import { useSuspenseQuery } from '@tanstack/react-query'
import {
  Link,
  createFileRoute,
  notFound,
  redirect,
} from '@tanstack/react-router'

import { GroupDetailPage } from '@/components/groups/group-detail-page'
import { AppShell } from '@/components/groups/app-shell'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { groupBySlugQueryOptions } from '@/features/groups/group-query'

export const Route = createFileRoute('/_authenticated/groups/$groupSlug')({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(
      groupBySlugQueryOptions(params.groupSlug),
    )

    if (!data) {
      throw notFound()
    }

    if (data.kind === 'forbidden') {
      throw redirect({ to: '/groups' })
    }

    if (data.redirectedFromSlug && data.currentSlug !== params.groupSlug) {
      throw redirect({
        to: '/groups/$groupSlug',
        params: { groupSlug: data.currentSlug },
      })
    }
  },
  pendingMs: 150,
  pendingComponent: GroupDetailPending,
  component: GroupDetailRoute,
})

function GroupDetailPending() {
  return (
    <AppShell
      title="Loading group"
      description="Fetching balances and activity."
    >
      <Card className="max-w-3xl border-border/70 bg-card/75">
        <CardContent className="grid gap-3 py-6">
          <div className="h-5 w-40 animate-pulse rounded bg-muted" />
          <div className="h-4 w-64 animate-pulse rounded bg-muted/80" />
          <div className="mt-2 grid gap-3">
            <div className="h-24 animate-pulse rounded-[1.2rem] bg-muted/70" />
            <div className="h-24 animate-pulse rounded-[1.2rem] bg-muted/70" />
            <div className="h-24 animate-pulse rounded-[1.2rem] bg-muted/70" />
          </div>
        </CardContent>
      </Card>
    </AppShell>
  )
}

function GroupDetailRoute() {
  const { groupSlug } = Route.useParams()
  const { data } = useSuspenseQuery(groupBySlugQueryOptions(groupSlug))

  if (!data) {
    throw notFound()
  }

  if (data.kind === 'forbidden') {
    return (
      <AppShell
        title="Group access required"
        description="You need to join this group before you can view its ledger."
      >
        <Card className="max-w-xl border-border/70 bg-card/75">
          <CardHeader>
            <CardTitle>
              You are signed in, but not a member of this group
            </CardTitle>
            <CardDescription>
              Ask an owner for an invite link, or return to your groups
              dashboard to create one of your own.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              to="/groups"
              preload="intent"
              preloadDelay={0}
              className="text-sm font-medium text-primary"
            >
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
