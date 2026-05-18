import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowRightIcon, PlusIcon, UsersIcon } from 'lucide-react'

import { AppShell } from '@/components/groups/app-shell'
import { FieldHint, FieldLabel, FormMessage, TextInput } from '@/components/groups/form-primitives'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createGroup } from '@/features/groups/group.functions'
import type { GroupSummary } from '@/features/groups/group-repository'
import { groupsDashboardQueryOptions } from '@/features/groups/group-query'

interface GroupsDashboardProps {
  groups: GroupSummary[]
  userLogin: string
}

export function GroupsDashboard({ groups, userLogin }: GroupsDashboardProps) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const createGroupMutation = useMutation({
    mutationFn: async () => {
      const result = await createGroup({
        data: {
          name,
          slug,
          currencyCode: 'INR',
        },
      })

      return result
    },
    onSuccess: async (result) => {
      setErrorMessage(null)
      setName('')
      setSlug('')
      await queryClient.invalidateQueries({ queryKey: groupsDashboardQueryOptions().queryKey })
      await navigate({ to: '/groups/$groupSlug', params: { groupSlug: result.slug } })
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : 'Could not create the group.')
    },
  })

  return (
    <AppShell
      title="Your groups"
      description={`Signed in as ${userLogin}. Create a group, invite people, and keep balances explainable from one shared ledger.`}
      actions={
        <Button render={<a href="#create-group" />}>
          Create group
          <PlusIcon data-icon="inline-end" />
        </Button>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-border/70 bg-card/65">
          <CardHeader>
            <Badge variant="accent" className="w-fit">
              Live app
            </Badge>
            <CardTitle>{groups.length ? 'Pick up where your group left off' : 'Start your first group'}</CardTitle>
            <CardDescription>
              Groups are slug-based, invite by link, and keep a ledger that combines shared expenses with settle-up entries.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {groups.length ? (
              groups.map((group) => (
                <Link
                  key={group.id}
                  to="/groups/$groupSlug"
                  params={{ groupSlug: group.slug }}
                  className="rounded-[1.35rem] border border-border/70 bg-background/70 p-4 transition hover:border-ring/40 hover:bg-background"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="font-medium text-foreground">{group.name}</div>
                      <div className="text-sm text-muted-foreground">/{group.slug}</div>
                    </div>
                    <Badge variant={group.role === 'owner' ? 'accent' : 'secondary'}>{group.role}</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span>{group.memberCount} members</span>
                    <span>{group.currencyCode}</span>
                  </div>
                </Link>
              ))
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-border/80 bg-background/65 p-6 text-sm leading-6 text-muted-foreground">
                No groups yet. Create one on the right, then share the invite link with everyone who should be part of the ledger.
              </div>
            )}
          </CardContent>
        </Card>

        <Card id="create-group" className="border-border/70 bg-card/75">
          <CardHeader>
            <div className="mb-2 flex size-11 items-center justify-center rounded-[1rem] bg-primary/18 text-primary">
              <UsersIcon className="size-5" />
            </div>
            <CardTitle>Create a group</CardTitle>
            <CardDescription>
              Slugs stay in the URL, and old ones can later redirect through slug history when owners rename them.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault()
                createGroupMutation.mutate()
              }}
            >
              <div className="space-y-2">
                <FieldLabel htmlFor="group-name">Group name</FieldLabel>
                <TextInput
                  id="group-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Goa trip 2026"
                />
              </div>

              <div className="space-y-2">
                <FieldLabel htmlFor="group-slug">Group slug</FieldLabel>
                <TextInput
                  id="group-slug"
                  value={slug}
                  onChange={(event) => setSlug(event.target.value)}
                  placeholder="goa-trip-2026"
                />
                <FieldHint>Use lowercase letters, numbers, and hyphens only.</FieldHint>
              </div>

              {errorMessage ? <FormMessage>{errorMessage}</FormMessage> : null}

              <Button type="submit" size="lg" disabled={createGroupMutation.isPending}>
                {createGroupMutation.isPending ? 'Creating...' : 'Create group'}
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
