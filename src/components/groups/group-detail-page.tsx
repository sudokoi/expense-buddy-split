import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { CopyIcon, LinkIcon, RefreshCwIcon, Trash2Icon } from 'lucide-react'

import { AppShell } from '@/components/groups/app-shell'
import {
  FieldHint,
  FieldLabel,
  FormMessage,
  SelectInput,
  TextArea,
  TextInput,
} from '@/components/groups/form-primitives'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
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
import {
  formatDateOnly,
  formatDateTime,
  formatMinorAmount,
} from '@/features/groups/group-shared'

interface GroupDetailPageProps {
  group: GroupDetail
  redirectedFromSlug: string | null
  currentUserId: string
}

type SplitMode = 'equal' | 'fixed' | 'percentage'

export function GroupDetailPage({
  group,
  redirectedFromSlug,
  currentUserId,
}: GroupDetailPageProps) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [renameSlug, setRenameSlug] = useState(group.slug)
  const [renameError, setRenameError] = useState<string | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [memberError, setMemberError] = useState<string | null>(null)
  const [expenseError, setExpenseError] = useState<string | null>(null)
  const [settlementError, setSettlementError] = useState<string | null>(null)

  const [expenseTitle, setExpenseTitle] = useState('')
  const [expenseNotes, setExpenseNotes] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expensePaidBy, setExpensePaidBy] = useState(
    group.members[0]?.userId || '',
  )
  const [expenseOccurredOn, setExpenseOccurredOn] = useState('')
  const [splitMode, setSplitMode] = useState<SplitMode>('equal')
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<
    string[]
  >(group.members.map((member) => member.userId))
  const [fixedShares, setFixedShares] = useState<Record<string, string>>({})
  const [percentageShares, setPercentageShares] = useState<
    Record<string, string>
  >({})

  const [settlementFromUserId, setSettlementFromUserId] = useState(
    group.members[0]?.userId || '',
  )
  const [settlementToUserId, setSettlementToUserId] = useState(
    group.members[1]?.userId || group.members[0]?.userId || '',
  )
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
      setRenameError(
        error instanceof Error ? error.message : 'Could not rename the group.',
      )
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
        showToast(`Invite copied: ${absoluteUrl}`)
      } catch {
        showToast(`Invite created: ${absoluteUrl}`)
      }
      await invalidateGroup()
    },
    onError: (error) => {
      setInviteError(
        error instanceof Error
          ? error.message
          : 'Could not create an invite link.',
      )
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
      setInviteError(
        error instanceof Error
          ? error.message
          : 'Could not revoke the invite link.',
      )
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
      setExpenseError(
        error instanceof Error ? error.message : 'Could not save the expense.',
      )
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
      setSettlementError(
        error instanceof Error
          ? error.message
          : 'Could not record the settlement.',
      )
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
      setExpenseError(
        error instanceof Error
          ? error.message
          : 'Could not delete the expense.',
      )
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
      setSettlementError(
        error instanceof Error
          ? error.message
          : 'Could not delete the settlement.',
      )
    },
  })

  const updateMemberRoleMutation = useMutation({
    mutationFn: ({
      memberUserId,
      role,
    }: {
      memberUserId: string
      role: 'owner' | 'member'
    }) =>
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
      setMemberError(
        error instanceof Error
          ? error.message
          : 'Could not update the member role.',
      )
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
      setMemberError(
        error instanceof Error
          ? error.message
          : 'Could not remove that member.',
      )
    },
  })

  const memberOptions = useMemo(
    () =>
      group.members.map((member) => ({
        label: member.displayName || member.userLogin,
        value: member.userId,
      })),
    [group.members],
  )

  const recentLedgerEntries = group.ledgerEntries.slice(0, 8)
  const visibleInvites = group.invites.slice(0, 4)
  const canRecordSettlement = group.members.length > 1

  return (
    <AppShell
      title={group.name}
      description={`/${group.slug} · ${group.members.length} ${group.members.length === 1 ? 'member' : 'members'} · ${group.currencyCode}`}
      actions={
        <>
          <Badge variant={group.role === 'owner' ? 'accent' : 'secondary'}>
            {group.role}
          </Badge>
          <Button variant="outline" render={<Link to="/groups" />}>
            Back to groups
          </Button>
        </>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_340px]">
        <div className="space-y-5">
          {redirectedFromSlug ? (
            <Card size="sm" className="border-accent/35 bg-accent/8">
              <CardContent className="py-1 text-sm text-muted-foreground">
                `/{redirectedFromSlug}` now redirects to `/{group.slug}`.
              </CardContent>
            </Card>
          ) : null}

          <Card className="border-border/70 bg-card/75">
            <CardHeader className="gap-2">
              <CardTitle>Add an expense</CardTitle>
              <CardDescription>
                Capture the spend first. Splits and balances update from here.
              </CardDescription>
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
                    <TextInput
                      id="expense-title"
                      value={expenseTitle}
                      onChange={(event) => setExpenseTitle(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel htmlFor="expense-amount">Amount</FieldLabel>
                    <TextInput
                      id="expense-amount"
                      value={expenseAmount}
                      onChange={(event) => setExpenseAmount(event.target.value)}
                      placeholder="1250"
                    />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel htmlFor="expense-date">Date</FieldLabel>
                    <TextInput
                      id="expense-date"
                      type="date"
                      value={expenseOccurredOn}
                      onChange={(event) =>
                        setExpenseOccurredOn(event.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel htmlFor="expense-paid-by">Paid by</FieldLabel>
                    <SelectInput
                      id="expense-paid-by"
                      value={expensePaidBy}
                      onChange={(event) => setExpensePaidBy(event.target.value)}
                    >
                      {memberOptions.map((member) => (
                        <option key={member.value} value={member.value}>
                          {member.label}
                        </option>
                      ))}
                    </SelectInput>
                  </div>
                  <div className="space-y-2">
                    <FieldLabel htmlFor="split-mode">Split mode</FieldLabel>
                    <SelectInput
                      id="split-mode"
                      value={splitMode}
                      onChange={(event) =>
                        setSplitMode(event.target.value as SplitMode)
                      }
                    >
                      <option value="equal">Equal</option>
                      <option value="fixed">Fixed amounts</option>
                      <option value="percentage">Percentages</option>
                    </SelectInput>
                  </div>
                </div>

                <div className="space-y-3 rounded-[1.25rem] border border-border/70 bg-background/70 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <FieldLabel>Participants</FieldLabel>
                    <span className="text-xs text-muted-foreground">
                      {selectedParticipantIds.length} selected
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {group.members.map((member) => {
                      const checked = selectedParticipantIds.includes(
                        member.userId,
                      )
                      return (
                        <label
                          key={member.userId}
                          className="flex items-center gap-3 rounded-[1rem] border border-border/60 bg-card/80 px-3 py-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => {
                              setSelectedParticipantIds((current) =>
                                event.target.checked
                                  ? [...current, member.userId]
                                  : current.filter(
                                      (value) => value !== member.userId,
                                    ),
                              )
                            }}
                          />
                          <span>{member.displayName}</span>
                        </label>
                      )
                    })}
                  </div>
                  <FieldHint>
                    Equal splits divide the amount automatically across selected
                    participants.
                  </FieldHint>
                </div>

                {splitMode !== 'equal' ? (
                  <div className="grid gap-3 rounded-[1.25rem] border border-border/70 bg-background/70 p-4">
                    {selectedParticipantIds.map((participantId) => {
                      const member = group.members.find(
                        (item) => item.userId === participantId,
                      )
                      if (!member) {
                        return null
                      }

                      const valueMap =
                        splitMode === 'fixed' ? fixedShares : percentageShares

                      return (
                        <div
                          key={participantId}
                          className="grid gap-2 sm:grid-cols-[1fr_160px] sm:items-center"
                        >
                          <div className="text-sm font-medium text-foreground">
                            {member.displayName}
                          </div>
                          <TextInput
                            value={valueMap[participantId] || ''}
                            onChange={(event) => {
                              const nextValue = event.target.value
                              if (splitMode === 'fixed') {
                                setFixedShares((current) => ({
                                  ...current,
                                  [participantId]: nextValue,
                                }))
                              } else {
                                setPercentageShares((current) => ({
                                  ...current,
                                  [participantId]: nextValue,
                                }))
                              }
                            }}
                            placeholder={splitMode === 'fixed' ? '250' : '25'}
                          />
                        </div>
                      )
                    })}
                    <FieldHint>
                      {splitMode === 'fixed'
                        ? 'Amounts must add up to the total.'
                        : 'Percentages must add up to 100.'}
                    </FieldHint>
                  </div>
                ) : null}

                <details className="rounded-[1.25rem] border border-border/70 bg-background/70 p-4 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="list-none cursor-pointer text-sm font-medium text-foreground">
                    Add a note
                  </summary>
                  <div className="mt-3 space-y-2">
                    <FieldLabel htmlFor="expense-notes">Notes</FieldLabel>
                    <TextArea
                      id="expense-notes"
                      value={expenseNotes}
                      onChange={(event) => setExpenseNotes(event.target.value)}
                    />
                  </div>
                </details>

                {expenseError ? (
                  <FormMessage>{expenseError}</FormMessage>
                ) : null}

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    size="lg"
                    disabled={createExpenseMutation.isPending}
                  >
                    {createExpenseMutation.isPending
                      ? 'Saving...'
                      : 'Save expense'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/70">
            <CardHeader className="gap-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>Recent activity</CardTitle>
                  <CardDescription>
                    Latest expenses and settle-ups.
                  </CardDescription>
                </div>
                <div className="text-xs text-muted-foreground">
                  {group.ledgerEntries.length
                    ? `${group.ledgerEntries.length} total`
                    : 'No entries yet'}
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3">
              {recentLedgerEntries.length ? (
                recentLedgerEntries.map((entry) => (
                  <div
                    key={`${entry.type}-${entry.id}`}
                    className="rounded-[1.2rem] border border-border/70 bg-background/75 px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium text-foreground">
                          {entry.title}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {entry.subtitle}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <div className="text-sm font-medium text-foreground">
                            {formatMinorAmount(
                              entry.amountMinor,
                              entry.currencyCode,
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDateTime(entry.occurredAt)}
                          </div>
                        </div>
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
                  </div>
                ))
              ) : (
                <div className="rounded-[1.25rem] border border-dashed border-border/80 bg-background/70 p-5 text-sm leading-6 text-muted-foreground">
                  No activity yet. Your first expense will show up here.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card size="sm" className="border-border/70 bg-card/75">
            <CardHeader className="gap-1">
              <CardTitle>Balances</CardTitle>
              <CardDescription>
                Current position for each member.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {group.balances.map((balance) => (
                <div
                  key={balance.userId}
                  className="flex items-center justify-between gap-3 rounded-[1rem] border border-border/70 bg-background/75 px-3 py-3"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">
                      {balance.displayName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      @{balance.userLogin}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-foreground">
                    {formatMinorAmount(
                      balance.balanceMinor,
                      group.currencyCode,
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card size="sm" className="border-border/70 bg-card/75">
            <CardHeader className="gap-1">
              <CardTitle>Group</CardTitle>
              <CardDescription>
                {group.role === 'owner'
                  ? 'You can manage this group.'
                  : 'You are participating in this group.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm text-muted-foreground">
              <div className="flex items-center justify-between gap-3 rounded-[1rem] border border-border/70 bg-background/75 px-3 py-2.5">
                <span>Slug</span>
                <span className="font-medium text-foreground">
                  /{group.slug}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-[1rem] border border-border/70 bg-background/75 px-3 py-2.5">
                <span>Members</span>
                <span className="font-medium text-foreground">
                  {group.members.length}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-[1rem] border border-border/70 bg-background/75 px-3 py-2.5">
                <span>Currency</span>
                <span className="font-medium text-foreground">
                  {group.currencyCode}
                </span>
              </div>
            </CardContent>
          </Card>

          <details className="rounded-[1.5rem] border border-border/70 bg-card/75 p-4 [&_summary::-webkit-details-marker]:hidden">
            <summary className="list-none cursor-pointer">
              <div className="space-y-1">
                <div className="font-medium text-foreground">
                  Record settlement
                </div>
                <div className="text-sm text-muted-foreground">
                  Use this when someone pays another member back directly.
                </div>
              </div>
            </summary>
            <div className="mt-4">
              {canRecordSettlement ? (
                <form
                  className="grid gap-4 md:grid-cols-2"
                  onSubmit={(event) => {
                    event.preventDefault()
                    createSettlementMutation.mutate()
                  }}
                >
                  <div className="space-y-2">
                    <FieldLabel htmlFor="settlement-from">Paid by</FieldLabel>
                    <SelectInput
                      id="settlement-from"
                      value={settlementFromUserId}
                      onChange={(event) =>
                        setSettlementFromUserId(event.target.value)
                      }
                    >
                      {memberOptions.map((member) => (
                        <option key={member.value} value={member.value}>
                          {member.label}
                        </option>
                      ))}
                    </SelectInput>
                  </div>
                  <div className="space-y-2">
                    <FieldLabel htmlFor="settlement-to">Received by</FieldLabel>
                    <SelectInput
                      id="settlement-to"
                      value={settlementToUserId}
                      onChange={(event) =>
                        setSettlementToUserId(event.target.value)
                      }
                    >
                      {memberOptions.map((member) => (
                        <option key={member.value} value={member.value}>
                          {member.label}
                        </option>
                      ))}
                    </SelectInput>
                  </div>
                  <div className="space-y-2">
                    <FieldLabel htmlFor="settlement-amount">Amount</FieldLabel>
                    <TextInput
                      id="settlement-amount"
                      value={settlementAmount}
                      onChange={(event) =>
                        setSettlementAmount(event.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel htmlFor="settlement-date">Date</FieldLabel>
                    <TextInput
                      id="settlement-date"
                      type="date"
                      value={settlementOccurredOn}
                      onChange={(event) =>
                        setSettlementOccurredOn(event.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <FieldLabel htmlFor="settlement-note">Note</FieldLabel>
                    <TextInput
                      id="settlement-note"
                      value={settlementNote}
                      onChange={(event) =>
                        setSettlementNote(event.target.value)
                      }
                    />
                  </div>

                  {settlementError ? (
                    <FormMessage className="md:col-span-2">
                      {settlementError}
                    </FormMessage>
                  ) : null}

                  <div className="md:col-span-2 flex justify-end">
                    <Button
                      type="submit"
                      disabled={createSettlementMutation.isPending}
                    >
                      {createSettlementMutation.isPending
                        ? 'Saving...'
                        : 'Save settlement'}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="rounded-[1rem] border border-dashed border-border/70 bg-background/70 p-4 text-sm text-muted-foreground">
                  Add another member before recording settlements.
                </div>
              )}
            </div>
          </details>

          <details className="rounded-[1.5rem] border border-border/70 bg-card/75 p-4 [&_summary::-webkit-details-marker]:hidden">
            <summary className="list-none cursor-pointer">
              <div className="space-y-1">
                <div className="font-medium text-foreground">
                  Members and settings
                </div>
                <div className="text-sm text-muted-foreground">
                  Owner tools, invites, and member management.
                </div>
              </div>
            </summary>
            <div className="mt-4 space-y-4">
              {group.members.map((member) => (
                <div
                  key={member.userId}
                  className="flex items-center justify-between gap-4 rounded-[1rem] border border-border/70 bg-background/75 px-3 py-3"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">
                      {member.displayName}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      @{member.userLogin}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={member.role === 'owner' ? 'accent' : 'secondary'}
                    >
                      {member.role}
                    </Badge>
                    {group.role === 'owner' &&
                    member.userId !== currentUserId ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            updateMemberRoleMutation.mutate({
                              memberUserId: member.userId,
                              role:
                                member.role === 'owner' ? 'member' : 'owner',
                            })
                          }
                        >
                          {member.role === 'owner'
                            ? 'Make member'
                            : 'Make owner'}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            removeMemberMutation.mutate(member.userId)
                          }
                        >
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
                  <div className="space-y-2 border-t border-border/60 pt-4">
                    <FieldLabel htmlFor="rename-group-slug">
                      Rename slug
                    </FieldLabel>
                    <div className="flex gap-2">
                      <TextInput
                        id="rename-group-slug"
                        value={renameSlug}
                        onChange={(event) => setRenameSlug(event.target.value)}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        disabled={renameGroupMutation.isPending}
                        onClick={() => renameGroupMutation.mutate()}
                      >
                        <RefreshCwIcon className="size-4" />
                      </Button>
                    </div>
                    <FieldHint>
                      Older slugs stay reserved in history and keep redirecting.
                    </FieldHint>
                    {renameError ? (
                      <FormMessage>{renameError}</FormMessage>
                    ) : null}
                  </div>

                  <div className="space-y-2 rounded-[1rem] border border-border/70 bg-background/75 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium text-foreground">
                          Invite links
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Reusable by default. New links expire in 7 days.
                        </div>
                      </div>
                      <Button
                        type="button"
                        onClick={() => createInviteMutation.mutate()}
                        disabled={createInviteMutation.isPending}
                      >
                        <LinkIcon className="size-4" />
                        Create
                      </Button>
                    </div>
                    {inviteError ? (
                      <FormMessage>{inviteError}</FormMessage>
                    ) : null}
                    {visibleInvites.length ? (
                      <div className="grid gap-2 pt-2">
                        {visibleInvites.map((invite) => (
                          <div
                            key={invite.id}
                            className="flex min-w-0 items-center gap-2 rounded-[1rem] border border-border/60 bg-card/80 px-3 py-2 text-sm"
                          >
                            <button
                              type="button"
                              className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden text-left"
                              onClick={async () => {
                                const absoluteUrl = `${window.location.origin}${invite.shareUrl}`
                                try {
                                  await navigator.clipboard.writeText(
                                    absoluteUrl,
                                  )
                                  showToast(`Invite copied: ${absoluteUrl}`)
                                } catch {
                                  showToast(
                                    `Could not copy invite link: ${absoluteUrl}`,
                                  )
                                }
                              }}
                            >
                              <div className="min-w-0 flex-1 overflow-hidden">
                                <div className="truncate font-medium text-foreground">
                                  {invite.shareUrl}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {invite.revokedAt
                                    ? 'Revoked'
                                    : `Expires ${formatDateOnly(invite.expiresAt)}`}
                                </div>
                              </div>
                              <CopyIcon className="size-4 shrink-0 text-muted-foreground" />
                            </button>
                            {!invite.revokedAt ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  revokeInviteMutation.mutate(invite.id)
                                }
                              >
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
            </div>
          </details>
        </div>
      </div>
    </AppShell>
  )
}
