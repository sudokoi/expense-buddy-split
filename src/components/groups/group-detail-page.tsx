import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { CopyIcon, LinkIcon, ReceiptIndianRupeeIcon, RefreshCwIcon, ScaleIcon, Trash2Icon, UsersIcon } from 'lucide-react'

import { AppShell } from '@/components/groups/app-shell'
import { FieldHint, FieldLabel, FormMessage, SelectInput, TextArea, TextInput } from '@/components/groups/form-primitives'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  createExpense,
  createGroupInvite,
  createSettlement,
  deleteExpense,
  deleteSettlement,
  renameGroup,
  removeGroupMember,
  revokeGroupInvite,
  updateMemberRole,
} from '@/features/groups/group.functions'
import type { GroupDetail } from '@/features/groups/group-repository'
import { groupBySlugQueryOptions } from '@/features/groups/group-query'
import { formatDateOnly, formatDateTime, formatMinorAmount } from '@/features/groups/group-shared'

interface GroupDetailPageProps {
  group: GroupDetail
  redirectedFromSlug: string | null
  currentUserId: string
}

type SplitMode = 'equal' | 'fixed' | 'percentage'

export function GroupDetailPage({ group, redirectedFromSlug, currentUserId }: GroupDetailPageProps) {
  const queryClient = useQueryClient()
  const [renameSlug, setRenameSlug] = useState(group.slug)
  const [renameError, setRenameError] = useState<string | null>(null)
  const [inviteMessage, setInviteMessage] = useState<string | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [memberError, setMemberError] = useState<string | null>(null)
  const [expenseError, setExpenseError] = useState<string | null>(null)
  const [settlementError, setSettlementError] = useState<string | null>(null)

  const [expenseTitle, setExpenseTitle] = useState('')
  const [expenseNotes, setExpenseNotes] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expensePaidBy, setExpensePaidBy] = useState(group.members[0]?.userId || '')
  const [expenseOccurredOn, setExpenseOccurredOn] = useState('')
  const [splitMode, setSplitMode] = useState<SplitMode>('equal')
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>(group.members.map((member) => member.userId))
  const [fixedShares, setFixedShares] = useState<Record<string, string>>({})
  const [percentageShares, setPercentageShares] = useState<Record<string, string>>({})

  const [settlementFromUserId, setSettlementFromUserId] = useState(group.members[0]?.userId || '')
  const [settlementToUserId, setSettlementToUserId] = useState(group.members[1]?.userId || group.members[0]?.userId || '')
  const [settlementAmount, setSettlementAmount] = useState('')
  const [settlementNote, setSettlementNote] = useState('')
  const [settlementOccurredOn, setSettlementOccurredOn] = useState('')

  const invalidateGroup = () =>
    queryClient.invalidateQueries({
      queryKey: groupBySlugQueryOptions(group.slug).queryKey,
    })

  const renameGroupMutation = useMutation({
    mutationFn: () =>
      renameGroup({
        data: {
          groupId: group.id,
          nextSlug: renameSlug,
        },
      }),
    onSuccess: (result) => {
      setRenameError(null)
      if (result.slug !== group.slug) {
        window.location.assign(`/groups/${result.slug}`)
      }
    },
    onError: (error) => {
      setRenameError(error instanceof Error ? error.message : 'Could not rename the group.')
    },
  })

  const createInviteMutation = useMutation({
    mutationFn: () =>
      createGroupInvite({
        data: {
          groupId: group.id,
          expiresInDays: 7,
          maxUses: null,
        },
      }),
    onSuccess: async (result) => {
      setInviteError(null)
      const absoluteUrl = `${window.location.origin}${result.shareUrl}`
      try {
        await navigator.clipboard.writeText(absoluteUrl)
        setInviteMessage(`Invite copied: ${absoluteUrl}`)
      } catch {
        setInviteMessage(`Invite created: ${absoluteUrl}`)
      }
      await invalidateGroup()
    },
    onError: (error) => {
      setInviteError(error instanceof Error ? error.message : 'Could not create an invite link.')
    },
  })

  const revokeInviteMutation = useMutation({
    mutationFn: (inviteId: string) =>
      revokeGroupInvite({
        data: {
          groupId: group.id,
          inviteId,
        },
      }),
    onSuccess: async () => {
      setInviteError(null)
      await invalidateGroup()
    },
    onError: (error) => {
      setInviteError(error instanceof Error ? error.message : 'Could not revoke the invite link.')
    },
  })

  const createExpenseMutation = useMutation({
    mutationFn: () =>
      createExpense({
        data: {
          groupId: group.id,
          title: expenseTitle,
          notes: expenseNotes,
          amount: expenseAmount,
          paidByUserId: expensePaidBy,
          splitMode,
          participantUserIds: selectedParticipantIds,
          fixedShares,
          percentageShares,
          occurredOn: expenseOccurredOn,
        },
      }),
    onSuccess: async () => {
      setExpenseError(null)
      setExpenseTitle('')
      setExpenseNotes('')
      setExpenseAmount('')
      setExpenseOccurredOn('')
      setSplitMode('equal')
      setSelectedParticipantIds(group.members.map((member) => member.userId))
      setFixedShares({})
      setPercentageShares({})
      await invalidateGroup()
    },
    onError: (error) => {
      setExpenseError(error instanceof Error ? error.message : 'Could not save the expense.')
    },
  })

  const createSettlementMutation = useMutation({
    mutationFn: () =>
      createSettlement({
        data: {
          groupId: group.id,
          fromUserId: settlementFromUserId,
          toUserId: settlementToUserId,
          amount: settlementAmount,
          note: settlementNote,
          occurredOn: settlementOccurredOn,
        },
      }),
    onSuccess: async () => {
      setSettlementError(null)
      setSettlementAmount('')
      setSettlementNote('')
      setSettlementOccurredOn('')
      await invalidateGroup()
    },
    onError: (error) => {
      setSettlementError(error instanceof Error ? error.message : 'Could not record the settlement.')
    },
  })

  const deleteExpenseMutation = useMutation({
    mutationFn: (expenseId: string) =>
      deleteExpense({
        data: {
          groupId: group.id,
          expenseId,
        },
      }),
    onSuccess: async () => {
      setExpenseError(null)
      await invalidateGroup()
    },
    onError: (error) => {
      setExpenseError(error instanceof Error ? error.message : 'Could not delete the expense.')
    },
  })

  const deleteSettlementMutation = useMutation({
    mutationFn: (settlementId: string) =>
      deleteSettlement({
        data: {
          groupId: group.id,
          settlementId,
        },
      }),
    onSuccess: async () => {
      setSettlementError(null)
      await invalidateGroup()
    },
    onError: (error) => {
      setSettlementError(error instanceof Error ? error.message : 'Could not delete the settlement.')
    },
  })

  const updateMemberRoleMutation = useMutation({
    mutationFn: ({ memberUserId, role }: { memberUserId: string; role: 'owner' | 'member' }) =>
      updateMemberRole({
        data: {
          groupId: group.id,
          memberUserId,
          role,
        },
      }),
    onSuccess: async () => {
      setMemberError(null)
      await invalidateGroup()
    },
    onError: (error) => {
      setMemberError(error instanceof Error ? error.message : 'Could not update the member role.')
    },
  })

  const removeMemberMutation = useMutation({
    mutationFn: (memberUserId: string) =>
      removeGroupMember({
        data: {
          groupId: group.id,
          memberUserId,
        },
      }),
    onSuccess: async () => {
      setMemberError(null)
      await invalidateGroup()
    },
    onError: (error) => {
      setMemberError(error instanceof Error ? error.message : 'Could not remove that member.')
    },
  })

  const memberOptions = useMemo(
    () => group.members.map((member) => ({ label: member.displayName || member.userLogin, value: member.userId })),
    [group.members],
  )

  return (
    <AppShell
      title={group.name}
      description={`/${group.slug} · ${group.currencyCode} group ledger with ${group.members.length} members.`}
      actions={
        <>
          <Badge variant={group.role === 'owner' ? 'accent' : 'secondary'}>{group.role}</Badge>
          <Button variant="outline" render={<Link to="/groups" />}>
            Back to groups
          </Button>
        </>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-5">
          {redirectedFromSlug ? (
            <Card className="border-accent/35 bg-accent/8">
              <CardHeader>
                <CardTitle>Redirected from old slug</CardTitle>
                <CardDescription>
                  `/{redirectedFromSlug}` now points to `/{group.slug}`. Old links keep working after owner-managed slug changes.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : null}

          <Card className="border-border/70 bg-card/70">
            <CardHeader>
              <div className="mb-2 flex size-11 items-center justify-center rounded-[1rem] bg-primary/18 text-primary">
                <ReceiptIndianRupeeIcon className="size-5" />
              </div>
              <CardTitle>Ledger</CardTitle>
              <CardDescription>Expenses and settle-ups share one timeline so balances stay explainable.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {group.ledgerEntries.length ? (
                group.ledgerEntries.map((entry) => (
                  <div key={`${entry.type}-${entry.id}`} className="rounded-[1.25rem] border border-border/70 bg-background/75 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-foreground">{entry.title}</div>
                        <div className="text-sm text-muted-foreground">{entry.subtitle}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={entry.type === 'expense' ? 'outline' : 'secondary'}>{entry.type}</Badge>
                        {entry.canManage ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (entry.type === 'expense') {
                                deleteExpenseMutation.mutate(entry.id)
                              } else {
                                deleteSettlementMutation.mutate(entry.id)
                              }
                            }}
                          >
                            <Trash2Icon className="size-4" />
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-foreground">{formatMinorAmount(entry.amountMinor, entry.currencyCode)}</span>
                      <span className="text-muted-foreground">{formatDateTime(entry.occurredAt)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.35rem] border border-dashed border-border/80 bg-background/70 p-5 text-sm leading-6 text-muted-foreground">
                  Nothing in the ledger yet. Add your first shared expense or settle-up below.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/70">
            <CardHeader>
              <CardTitle>Add an expense</CardTitle>
              <CardDescription>Choose who paid, who participated, and how the amount should be split.</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  createExpenseMutation.mutate()
                }}
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <FieldLabel htmlFor="expense-title">Title</FieldLabel>
                    <TextInput id="expense-title" value={expenseTitle} onChange={(event) => setExpenseTitle(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel htmlFor="expense-amount">Amount</FieldLabel>
                    <TextInput id="expense-amount" value={expenseAmount} onChange={(event) => setExpenseAmount(event.target.value)} placeholder="1250" />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel htmlFor="expense-date">Date</FieldLabel>
                    <TextInput id="expense-date" type="date" value={expenseOccurredOn} onChange={(event) => setExpenseOccurredOn(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel htmlFor="expense-paid-by">Paid by</FieldLabel>
                    <SelectInput id="expense-paid-by" value={expensePaidBy} onChange={(event) => setExpensePaidBy(event.target.value)}>
                      {memberOptions.map((member) => (
                        <option key={member.value} value={member.value}>
                          {member.label}
                        </option>
                      ))}
                    </SelectInput>
                  </div>
                  <div className="space-y-2">
                    <FieldLabel htmlFor="split-mode">Split mode</FieldLabel>
                    <SelectInput id="split-mode" value={splitMode} onChange={(event) => setSplitMode(event.target.value as SplitMode)}>
                      <option value="equal">Equal</option>
                      <option value="fixed">Fixed amounts</option>
                      <option value="percentage">Percentages</option>
                    </SelectInput>
                  </div>
                </div>

                <div className="space-y-3 rounded-[1.25rem] border border-border/70 bg-background/70 p-4">
                  <FieldLabel>Participants</FieldLabel>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {group.members.map((member) => {
                      const checked = selectedParticipantIds.includes(member.userId)
                      return (
                        <label key={member.userId} className="flex items-center gap-3 rounded-[1rem] border border-border/60 bg-card/80 px-3 py-2 text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => {
                              setSelectedParticipantIds((current) =>
                                event.target.checked
                                  ? [...current, member.userId]
                                  : current.filter((value) => value !== member.userId),
                              )
                            }}
                          />
                          <span>{member.displayName}</span>
                        </label>
                      )
                    })}
                  </div>
                  <FieldHint>Equal splits will divide the amount automatically across selected participants.</FieldHint>
                </div>

                {splitMode !== 'equal' ? (
                  <div className="grid gap-3 rounded-[1.25rem] border border-border/70 bg-background/70 p-4">
                    {selectedParticipantIds.map((participantId) => {
                      const member = group.members.find((item) => item.userId === participantId)
                      if (!member) {
                        return null
                      }

                      const valueMap = splitMode === 'fixed' ? fixedShares : percentageShares

                      return (
                        <div key={participantId} className="grid gap-2 sm:grid-cols-[1fr_160px] sm:items-center">
                          <div className="text-sm font-medium text-foreground">{member.displayName}</div>
                          <TextInput
                            value={valueMap[participantId] || ''}
                            onChange={(event) => {
                              const nextValue = event.target.value
                              if (splitMode === 'fixed') {
                                setFixedShares((current) => ({ ...current, [participantId]: nextValue }))
                              } else {
                                setPercentageShares((current) => ({ ...current, [participantId]: nextValue }))
                              }
                            }}
                            placeholder={splitMode === 'fixed' ? '250' : '25'}
                          />
                        </div>
                      )
                    })}
                    <FieldHint>{splitMode === 'fixed' ? 'Amounts must add up to the total.' : 'Percentages must add up to 100.'}</FieldHint>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <FieldLabel htmlFor="expense-notes">Notes</FieldLabel>
                  <TextArea id="expense-notes" value={expenseNotes} onChange={(event) => setExpenseNotes(event.target.value)} />
                </div>

                {expenseError ? <FormMessage>{expenseError}</FormMessage> : null}

                <Button type="submit" size="lg" disabled={createExpenseMutation.isPending}>
                  {createExpenseMutation.isPending ? 'Saving...' : 'Save expense'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/70">
            <CardHeader>
              <CardTitle>Record a settlement</CardTitle>
              <CardDescription>Capture direct repayments so everyone sees why the balance changed.</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-4 md:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  createSettlementMutation.mutate()
                }}
              >
                <div className="space-y-2">
                  <FieldLabel htmlFor="settlement-from">Paid by</FieldLabel>
                  <SelectInput id="settlement-from" value={settlementFromUserId} onChange={(event) => setSettlementFromUserId(event.target.value)}>
                    {memberOptions.map((member) => (
                      <option key={member.value} value={member.value}>
                        {member.label}
                      </option>
                    ))}
                  </SelectInput>
                </div>
                <div className="space-y-2">
                  <FieldLabel htmlFor="settlement-to">Received by</FieldLabel>
                  <SelectInput id="settlement-to" value={settlementToUserId} onChange={(event) => setSettlementToUserId(event.target.value)}>
                    {memberOptions.map((member) => (
                      <option key={member.value} value={member.value}>
                        {member.label}
                      </option>
                    ))}
                  </SelectInput>
                </div>
                <div className="space-y-2">
                  <FieldLabel htmlFor="settlement-amount">Amount</FieldLabel>
                  <TextInput id="settlement-amount" value={settlementAmount} onChange={(event) => setSettlementAmount(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <FieldLabel htmlFor="settlement-date">Date</FieldLabel>
                  <TextInput
                    id="settlement-date"
                    type="date"
                    value={settlementOccurredOn}
                    onChange={(event) => setSettlementOccurredOn(event.target.value)}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <FieldLabel htmlFor="settlement-note">Note</FieldLabel>
                  <TextInput id="settlement-note" value={settlementNote} onChange={(event) => setSettlementNote(event.target.value)} />
                </div>

                {settlementError ? <FormMessage className="md:col-span-2">{settlementError}</FormMessage> : null}

                <div className="md:col-span-2">
                  <Button type="submit" size="lg" disabled={createSettlementMutation.isPending}>
                    {createSettlementMutation.isPending ? 'Saving...' : 'Save settlement'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="border-border/70 bg-card/75">
            <CardHeader>
              <div className="mb-2 flex size-11 items-center justify-center rounded-[1rem] bg-primary/18 text-primary">
                <ScaleIcon className="size-5" />
              </div>
              <CardTitle>Balances</CardTitle>
              <CardDescription>Positive means that member is owed money. Negative means they owe into the group.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {group.balances.map((balance) => (
                <div key={balance.userId} className="rounded-[1.2rem] border border-border/70 bg-background/75 p-4">
                  <div className="font-medium text-foreground">{balance.displayName}</div>
                  <div className="mt-2 text-sm text-muted-foreground">@{balance.userLogin}</div>
                  <div className="mt-3 text-base font-semibold text-foreground">
                    {formatMinorAmount(balance.balanceMinor, group.currencyCode)}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/75">
            <CardHeader>
              <div className="mb-2 flex size-11 items-center justify-center rounded-[1rem] bg-primary/18 text-primary">
                <UsersIcon className="size-5" />
              </div>
              <CardTitle>Members</CardTitle>
              <CardDescription>Owners can rename the group slug and create reusable invite links.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {group.members.map((member) => (
                <div key={member.userId} className="flex items-center justify-between gap-4 rounded-[1.2rem] border border-border/70 bg-background/75 px-4 py-3">
                  <div>
                    <div className="font-medium text-foreground">{member.displayName}</div>
                    <div className="text-sm text-muted-foreground">@{member.userLogin}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={member.role === 'owner' ? 'accent' : 'secondary'}>{member.role}</Badge>
                    {group.role === 'owner' && member.userId !== currentUserId ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            updateMemberRoleMutation.mutate({
                              memberUserId: member.userId,
                              role: member.role === 'owner' ? 'member' : 'owner',
                            })
                          }
                        >
                          {member.role === 'owner' ? 'Make member' : 'Make owner'}
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => removeMemberMutation.mutate(member.userId)}>
                          <Trash2Icon className="size-4" />
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              ))}
              {memberError ? <FormMessage>{memberError}</FormMessage> : null}

              {group.role === 'owner' ? (
                <>
                  <div className="space-y-2 pt-2">
                    <FieldLabel htmlFor="rename-group-slug">Rename slug</FieldLabel>
                    <div className="flex gap-2">
                      <TextInput id="rename-group-slug" value={renameSlug} onChange={(event) => setRenameSlug(event.target.value)} />
                      <Button type="button" variant="outline" disabled={renameGroupMutation.isPending} onClick={() => renameGroupMutation.mutate()}>
                        <RefreshCwIcon className="size-4" />
                      </Button>
                    </div>
                    <FieldHint>Older slugs are preserved in history and cannot be reused by other groups.</FieldHint>
                    {renameError ? <FormMessage>{renameError}</FormMessage> : null}
                  </div>

                  <div className="space-y-2 rounded-[1.2rem] border border-border/70 bg-background/75 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium text-foreground">Invite link</div>
                        <div className="text-sm text-muted-foreground">Reusable by default, expires in 7 days.</div>
                      </div>
                      <Button type="button" onClick={() => createInviteMutation.mutate()} disabled={createInviteMutation.isPending}>
                        <LinkIcon className="size-4" />
                        Create invite
                      </Button>
                    </div>
                    {inviteError ? <FormMessage>{inviteError}</FormMessage> : null}
                    {inviteMessage ? <div className="text-sm text-muted-foreground">{inviteMessage}</div> : null}
                    {group.invites.length ? (
                      <div className="grid gap-2 pt-2">
                        {group.invites.slice(0, 4).map((invite) => (
                          <div key={invite.id} className="flex items-center justify-between gap-2 rounded-[1rem] border border-border/60 bg-card/80 px-3 py-2 text-sm">
                            <button
                              type="button"
                              className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
                              onClick={async () => {
                                const absoluteUrl = `${window.location.origin}${invite.shareUrl}`
                                try {
                                  await navigator.clipboard.writeText(absoluteUrl)
                                  setInviteMessage(`Invite copied: ${absoluteUrl}`)
                                } catch {
                                  setInviteMessage(`Invite available: ${absoluteUrl}`)
                                }
                              }}
                            >
                              <div className="min-w-0">
                                <div className="truncate font-medium text-foreground">{invite.shareUrl}</div>
                                <div className="text-xs text-muted-foreground">
                                  {invite.revokedAt ? 'Revoked' : `Expires ${formatDateOnly(invite.expiresAt)}`}
                                </div>
                              </div>
                              <CopyIcon className="size-4 shrink-0 text-muted-foreground" />
                            </button>
                            {!invite.revokedAt ? (
                              <Button type="button" size="sm" variant="ghost" onClick={() => revokeInviteMutation.mutate(invite.id)}>
                                <Trash2Icon className="size-4" />
                              </Button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  )
}
