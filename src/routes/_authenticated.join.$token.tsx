import { useMutation, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, notFound } from '@tanstack/react-router'

import { AppShell } from '@/components/groups/app-shell'
import { FormMessage } from '@/components/groups/form-primitives'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { joinGroupInvite } from '@/features/groups/group.functions'
import { invitePreviewQueryOptions } from '@/features/groups/group-query'

export const Route = createFileRoute('/_authenticated/join/$token')({
  loader: async ({ context, params }) => {
    const invite = await context.queryClient.ensureQueryData(invitePreviewQueryOptions(params.token))

    if (!invite) {
      throw notFound()
    }
  },
  component: JoinInviteRoute,
})

function JoinInviteRoute() {
  const { token } = Route.useParams()
  const { data: invite } = useSuspenseQuery(invitePreviewQueryOptions(token))

  const joinMutation = useMutation({
    mutationFn: () => joinGroupInvite({ data: { token } }),
    onSuccess: (result) => {
      window.location.assign(`/groups/${result.slug}`)
    },
  })

  if (!invite) {
    throw notFound()
  }

  const blockedReason = invite.isRevoked
    ? 'This invite has been revoked.'
    : invite.isExpired
      ? 'This invite has expired.'
      : invite.isExhausted
        ? 'This invite reached its usage limit.'
        : null

  return (
    <AppShell title="Join group" description="GitHub sign-in is required before a reusable invite can add you to a group.">
      <Card className="mx-auto w-full max-w-2xl border-border/70 bg-card/75">
        <CardHeader>
          <CardTitle>{invite.groupName}</CardTitle>
          <CardDescription>
            Join `/{invite.groupSlug}` and start participating in the shared expense ledger.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {blockedReason ? <FormMessage>{blockedReason}</FormMessage> : null}
          {invite.alreadyMember ? (
            <div className="rounded-[1.2rem] border border-border/70 bg-background/75 p-4 text-sm text-muted-foreground">
              You are already a member of this group.
            </div>
          ) : null}
          <div className="text-sm text-muted-foreground">Invite expires at {invite.expiresAt.toLocaleString()}.</div>
          <Button
            type="button"
            size="lg"
            disabled={Boolean(blockedReason) || invite.alreadyMember || joinMutation.isPending}
            onClick={() => joinMutation.mutate()}
          >
            {invite.alreadyMember ? 'Already joined' : joinMutation.isPending ? 'Joining...' : 'Join this group'}
          </Button>
          {joinMutation.isError ? (
            <FormMessage>{joinMutation.error instanceof Error ? joinMutation.error.message : 'Could not join this group.'}</FormMessage>
          ) : null}
        </CardContent>
      </Card>
    </AppShell>
  )
}
