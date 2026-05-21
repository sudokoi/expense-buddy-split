import { useDeferredValue, useEffect, useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { ArrowRightIcon, PlusIcon } from 'lucide-react'

import { AppShell } from '@/components/groups/app-shell'
import {
  FieldHint,
  FieldLabel,
  FormMessage,
  TextInput,
} from '@/components/groups/form-primitives'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  createGroup,
  suggestGroupSlug,
} from '@/features/groups/group.functions'
import type { GroupSummary } from '@/features/groups/group-repository'
import {
  groupBySlugQueryOptions,
  groupsDashboardQueryOptions,
} from '@/features/groups/group-query'

interface GroupsDashboardProps {
  groups: GroupSummary[]
  userLogin: string
}

export function GroupsDashboard({ groups, userLogin }: GroupsDashboardProps) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const isNavigating = useRouterState({
    select: (state) => state.status === 'pending',
  })
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [pendingGroupSlug, setPendingGroupSlug] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const deferredName = useDeferredValue(name)

  function resetCreateGroupForm() {
    setIsCreateDialogOpen(false)
    setName('')
    setSlug('')
    setIsSlugManuallyEdited(false)
    setErrorMessage(null)
  }

  useEffect(() => {
    if (!isNavigating) {
      setPendingGroupSlug(null)
    }
  }, [isNavigating, pathname])

  function preloadGroup(groupSlug: string) {
    void queryClient.prefetchQuery(groupBySlugQueryOptions(groupSlug))
  }

  useEffect(() => {
    if (isSlugManuallyEdited) {
      return
    }

    const nextName = deferredName.trim()
    if (!nextName) {
      setSlug('')
      return
    }

    let cancelled = false

    void suggestGroupSlug({
      data: {
        name: nextName,
      },
    })
      .then((result) => {
        if (!cancelled) {
          setSlug(result.slug)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSlug('')
        }
      })

    return () => {
      cancelled = true
    }
  }, [deferredName, isSlugManuallyEdited])

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
      resetCreateGroupForm()
      await queryClient.invalidateQueries({
        queryKey: groupsDashboardQueryOptions().queryKey,
      })
      await navigate({
        to: '/groups/$groupSlug',
        params: { groupSlug: result.slug },
      })
    },
    onError: (error) => {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not create the group.',
      )
    },
  })

  return (
    <>
      <AppShell
        title="Groups"
        description={`Signed in as ${userLogin}. Open a group or create a new one when you need it.`}
        actions={
          <Button type="button" onClick={() => setIsCreateDialogOpen(true)}>
            Create group
            <PlusIcon data-icon="inline-end" />
          </Button>
        }
      >
        <Card className="border-border/70 bg-card/65">
          <CardHeader className="gap-2">
            <CardTitle>
              {groups.length ? 'Your groups' : 'No groups yet'}
            </CardTitle>
            <CardDescription>
              {groups.length
                ? 'Open a group to review balances, record entries, or invite more people.'
                : 'Create your first group to start tracking shared expenses.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {groups.length ? (
              groups.map((group) => (
                <Link
                  key={group.id}
                  to="/groups/$groupSlug"
                  params={{ groupSlug: group.slug }}
                  onMouseEnter={() => preloadGroup(group.slug)}
                  onFocus={() => preloadGroup(group.slug)}
                  onClick={() => setPendingGroupSlug(group.slug)}
                  preload="intent"
                  preloadDelay={0}
                  className="rounded-[1.25rem] border border-border/70 bg-background/70 px-4 py-3 transition hover:border-ring/40 hover:bg-background"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                      <div className="truncate font-medium text-foreground">
                        {group.name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        /{group.slug}
                      </div>
                    </div>
                    <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      {pendingGroupSlug === group.slug && isNavigating
                        ? 'opening'
                        : group.role}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span>{group.memberCount} members</span>
                    <span>{group.currencyCode}</span>
                    {pendingGroupSlug === group.slug && isNavigating ? (
                      <span className="font-medium text-foreground">
                        Loading group...
                      </span>
                    ) : null}
                  </div>
                </Link>
              ))
            ) : (
              <div className="rounded-[1.25rem] border border-dashed border-border/80 bg-background/65 p-6 text-sm leading-6 text-muted-foreground">
                <p>
                  No groups yet. Create one, share the invite link, and keep the
                  ledger in one place.
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="mt-4"
                  onClick={() => setIsCreateDialogOpen(true)}
                >
                  Create your first group
                  <PlusIcon data-icon="inline-end" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </AppShell>

      <Dialog.Root
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-foreground/18 backdrop-blur-sm" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[1.6rem] border border-border/80 bg-background/95 p-5 text-foreground shadow-[0_32px_90px_rgba(74,68,88,0.22)] outline-none">
            <div className="space-y-1">
              <Dialog.Title className="text-lg font-semibold tracking-tight">
                Create group
              </Dialog.Title>
              <Dialog.Description className="text-sm leading-6 text-muted-foreground">
                Pick a clear name and URL slug. You can rename the slug later.
              </Dialog.Description>
            </div>

            <form
              className="mt-5 space-y-4"
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
                  placeholder="Household expenses"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <FieldLabel htmlFor="group-slug">Group slug</FieldLabel>
                <TextInput
                  id="group-slug"
                  value={slug}
                  onChange={(event) => {
                    setSlug(event.target.value)
                    setIsSlugManuallyEdited(true)
                  }}
                  placeholder="household-expenses"
                />
                <FieldHint>
                  Generated from the group name. You can edit it before creating
                  the group.
                </FieldHint>
              </div>

              {errorMessage ? <FormMessage>{errorMessage}</FormMessage> : null}

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={resetCreateGroupForm}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createGroupMutation.isPending}>
                  {createGroupMutation.isPending
                    ? 'Creating...'
                    : 'Create group'}
                  <ArrowRightIcon data-icon="inline-end" />
                </Button>
              </div>
            </form>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
