import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  ActivityIcon,
  CopyIcon,
  DownloadIcon,
  LinkIcon,
  ReceiptTextIcon,
  RefreshCwIcon,
  Settings2Icon,
  Trash2Icon,
} from 'lucide-react'

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
import {
  applyOptimisticExpenseCreate,
  applyOptimisticExpenseDelete,
  applyOptimisticInviteRevoke,
  applyOptimisticMemberRemoval,
  applyOptimisticMemberRoleUpdate,
  applyOptimisticSettlementCreate,
  applyOptimisticSettlementDelete
  
  
} from '@/features/groups/group-detail-optimistic'
import type {OptimisticExpenseInput, OptimisticSettlementInput} from '@/features/groups/group-detail-optimistic';
import type { GroupDetail } from '@/features/groups/group-repository'
import {
  groupBySlugQueryOptions
  
} from '@/features/groups/group-query'
import type {GroupBySlugQueryData} from '@/features/groups/group-query';
import {
  formatDateOnly,
  formatDateTime,
  formatMinorAmount,
} from '@/features/groups/group-shared'
import { cn } from '@/lib/utils'

interface GroupDetailPageProps {
  group: GroupDetail
  redirectedFromSlug: string | null
  currentUserId: string
}

type SplitMode = 'fixed' | 'percentage'
type MobileSection = 'expense' | 'activity' | 'group'
type GroupMutationContext = {
  previousData: GroupBySlugQueryData | undefined
}

export function GroupDetailPage({
  group,
  redirectedFromSlug,
  currentUserId,
}: GroupDetailPageProps) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const groupQueryKey = groupBySlugQueryOptions(group.slug).queryKey
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
  const [payerAmounts, setPayerAmounts] = useState<Record<string, string>>({})
  const [lastEditedPayerUserId, setLastEditedPayerUserId] = useState<
    string | null
  >(null)
  const [expenseOccurredOn, setExpenseOccurredOn] = useState('')
  const [splitMode, setSplitMode] = useState<SplitMode>('fixed')
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
  const [mobileSection, setMobileSection] = useState<MobileSection>('expense')

  const invalidateGroup = () =>
    queryClient.invalidateQueries({
      queryKey: groupQueryKey,
    })

  const rollbackGroupMutation = (context?: GroupMutationContext) => {
    if (context?.previousData !== undefined) {
      queryClient.setQueryData(groupQueryKey, context.previousData)
    }
  }

  const applyOptimisticGroupMutation = async (
    updater: (currentGroup: GroupDetail) => GroupDetail,
  ) => {
    await queryClient.cancelQueries({ queryKey: groupQueryKey })

    const previousData =
      queryClient.getQueryData<GroupBySlugQueryData>(groupQueryKey)

    try {
      queryClient.setQueryData<GroupBySlugQueryData>(
        groupQueryKey,
        (current) => {
          if (!current || current.kind !== 'group') {
            return current
          }

          return {
            ...current,
            group: updater(current.group),
          }
        },
      )
    } catch {
      // Fall back to the server response for invalid client-side drafts.
    }

    return {
      previousData,
    } satisfies GroupMutationContext
  }

  const resetExpenseForm = () => {
    setExpenseTitle('')
    setExpenseNotes('')
    setExpenseAmount('')
    setExpenseOccurredOn('')
    setSplitMode('fixed')
    setSelectedParticipantIds(group.members.map((member) => member.userId))
    setPayerAmounts({})
    setLastEditedPayerUserId(null)
    setFixedShares({})
    setPercentageShares({})
  }

  const resetSettlementForm = () => {
    setSettlementAmount('')
    setSettlementNote('')
    setSettlementOccurredOn('')
  }

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
        showToast(`Invite copied: ${absoluteUrl}`, 'success')
      } catch {
        showToast(`Invite created: ${absoluteUrl}`, 'info')
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
    onMutate: async (inviteId) => {
      setInviteError(null)
      return applyOptimisticGroupMutation((currentGroup) =>
        applyOptimisticInviteRevoke(currentGroup, inviteId),
      )
    },
    onError: (error, _inviteId, context) => {
      rollbackGroupMutation(context)
      setInviteError(
        error instanceof Error
          ? error.message
          : 'Could not revoke the invite link.',
      )
    },
    onSettled: async () => {
      await invalidateGroup()
    },
  })

  const createExpenseMutation = useMutation({
    mutationFn: (input: OptimisticExpenseInput) =>
      createExpense({
        data: {
          groupId: group.id,
          ...input,
        },
      }),
    onMutate: async (input) => {
      setExpenseError(null)
      return applyOptimisticGroupMutation((currentGroup) =>
        applyOptimisticExpenseCreate(currentGroup, currentUserId, input),
      )
    },
    onSuccess: () => {
      resetExpenseForm()
    },
    onError: (error, _input, context) => {
      rollbackGroupMutation(context)
      setExpenseError(
        error instanceof Error ? error.message : 'Could not save the expense.',
      )
    },
    onSettled: async () => {
      await invalidateGroup()
    },
  })

  const createSettlementMutation = useMutation({
    mutationFn: (input: OptimisticSettlementInput) =>
      createSettlement({
        data: {
          groupId: group.id,
          ...input,
        },
      }),
    onMutate: async (input) => {
      setSettlementError(null)
      return applyOptimisticGroupMutation((currentGroup) =>
        applyOptimisticSettlementCreate(currentGroup, currentUserId, input),
      )
    },
    onSuccess: () => {
      resetSettlementForm()
    },
    onError: (error, _input, context) => {
      rollbackGroupMutation(context)
      setSettlementError(
        error instanceof Error
          ? error.message
          : 'Could not record the settlement.',
      )
    },
    onSettled: async () => {
      await invalidateGroup()
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
    onMutate: async (expenseId) => {
      setExpenseError(null)
      return applyOptimisticGroupMutation((currentGroup) =>
        applyOptimisticExpenseDelete(currentGroup, currentUserId, expenseId),
      )
    },
    onError: (error, _expenseId, context) => {
      rollbackGroupMutation(context)
      setExpenseError(
        error instanceof Error
          ? error.message
          : 'Could not delete the expense.',
      )
    },
    onSettled: async () => {
      await invalidateGroup()
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
    onMutate: async (settlementId) => {
      setSettlementError(null)
      return applyOptimisticGroupMutation((currentGroup) =>
        applyOptimisticSettlementDelete(
          currentGroup,
          currentUserId,
          settlementId,
        ),
      )
    },
    onError: (error, _settlementId, context) => {
      rollbackGroupMutation(context)
      setSettlementError(
        error instanceof Error
          ? error.message
          : 'Could not delete the settlement.',
      )
    },
    onSettled: async () => {
      await invalidateGroup()
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
    onMutate: async (input) => {
      setMemberError(null)
      return applyOptimisticGroupMutation((currentGroup) =>
        applyOptimisticMemberRoleUpdate(
          currentGroup,
          currentUserId,
          input.memberUserId,
          input.role,
        ),
      )
    },
    onError: (error, _input, context) => {
      rollbackGroupMutation(context)
      setMemberError(
        error instanceof Error
          ? error.message
          : 'Could not update the member role.',
      )
    },
    onSettled: async () => {
      await invalidateGroup()
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
    onMutate: async (memberUserId) => {
      setMemberError(null)
      return applyOptimisticGroupMutation((currentGroup) =>
        applyOptimisticMemberRemoval(currentGroup, currentUserId, memberUserId),
      )
    },
    onError: (error, _memberUserId, context) => {
      rollbackGroupMutation(context)
      setMemberError(
        error instanceof Error
          ? error.message
          : 'Could not remove that member.',
      )
    },
    onSettled: async () => {
      await invalidateGroup()
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

  const formatMinorInput = (amountMinor: number) => {
    const whole = Math.floor(amountMinor / 100)
    const fraction = amountMinor % 100

    if (fraction === 0) {
      return String(whole)
    }

    return `${whole}.${String(fraction).padStart(2, '0').replace(/0$/, '')}`
  }

  const parseDraftAmountToMinor = (value: string) => {
    const normalized = value.trim()

    if (!normalized) {
      return 0
    }

    if (!/^\d+(?:\.\d{0,2})?$/.test(normalized)) {
      return null
    }

    const [wholePart, fractionPart = ''] = normalized.split('.')

    return (
      Number.parseInt(wholePart, 10) * 100 +
      Number.parseInt(fractionPart.padEnd(2, '0'), 10)
    )
  }

  const buildEqualPercentageValues = (participantIds: string[]) => {
    if (!participantIds.length) {
      return {}
    }

    const baseBasisPoints = Math.floor(10_000 / participantIds.length)
    let remainder = 10_000 - baseBasisPoints * participantIds.length

    return Object.fromEntries(
      participantIds.map((participantId) => {
        const basisPoints = baseBasisPoints + (remainder > 0 ? 1 : 0)
        remainder = Math.max(0, remainder - 1)

        return [
          participantId,
          basisPoints % 100 === 0
            ? String(basisPoints / 100)
            : (basisPoints / 100).toFixed(2),
        ]
      }),
    )
  }

  const rebalanceTwoParticipantPayers = (
    nextPayerAmounts: Record<string, string>,
    controllingUserId: string | null,
    nextParticipantIds = selectedParticipantIds,
    nextExpenseAmount = expenseAmount,
  ) => {
    if (
      !controllingUserId ||
      nextParticipantIds.length !== 2 ||
      !nextParticipantIds.includes(controllingUserId)
    ) {
      return nextPayerAmounts
    }

    const totalMinor = parseDraftAmountToMinor(nextExpenseAmount)
    if (totalMinor === null) {
      return nextPayerAmounts
    }

    const controllingMinor = parseDraftAmountToMinor(
      nextPayerAmounts[controllingUserId] || '',
    )
    if (controllingMinor === null) {
      return nextPayerAmounts
    }

    const otherUserId = nextParticipantIds.find(
      (participantId) => participantId !== controllingUserId,
    )

    if (!otherUserId) {
      return nextPayerAmounts
    }

    if (controllingMinor > totalMinor) {
      return {
        ...nextPayerAmounts,
        [otherUserId]: '',
      }
    }

    return {
      ...nextPayerAmounts,
      [otherUserId]: formatMinorInput(totalMinor - controllingMinor),
    }
  }

  const membersByUserId = useMemo(
    () => new Map(group.members.map((member) => [member.userId, member])),
    [group.members],
  )

  const exportableEntries = useMemo(
    () =>
      group.ledgerEntries
        .slice()
        .sort(
          (left, right) =>
            right.occurredAt.valueOf() - left.occurredAt.valueOf(),
        ),
    [group.ledgerEntries],
  )

  const downloadActivityCsv = () => {
    if (!exportableEntries.length) {
      showToast('No expenses or settlements available to export.', 'info')
      return
    }

    const escapeCsvValue = (value: string | number | null | undefined) => {
      const normalized = value == null ? '' : String(value)
      return `"${normalized.replaceAll('"', '""')}"`
    }

    const formatMinorForCsv = (amountMinor: number) =>
      (amountMinor / 100).toFixed(2)

    const rows = exportableEntries.map((entry) => {
      if (entry.type === 'expense') {
        const paidBy = membersByUserId.get(entry.expense.paidByUserId)
        const payers = (
          entry.expense.payers.length
            ? entry.expense.payers
            : [
                {
                  userId: entry.expense.paidByUserId,
                  amountMinor: entry.amountMinor,
                },
              ]
        )
          .map((payer) => {
            const member = membersByUserId.get(payer.userId)
            return [
              member?.displayName || member?.userLogin || payer.userId,
              formatMinorForCsv(payer.amountMinor),
            ].join(':')
          })
          .join(' | ')
        const participants = entry.expense.participants
          .map((participant) => {
            const member = membersByUserId.get(participant.userId)
            const percentage =
              participant.percentageBasisPoints === null
                ? ''
                : (participant.percentageBasisPoints / 100).toFixed(2)

            return [
              member?.displayName || member?.userLogin || participant.userId,
              formatMinorForCsv(participant.amountMinor),
              percentage,
            ].join(':')
          })
          .join(' | ')

        return [
          'expense',
          entry.id,
          entry.title,
          entry.expense.notes || '',
          formatDateTime(entry.occurredAt),
          formatMinorForCsv(entry.amountMinor),
          entry.currencyCode,
          paidBy?.displayName ||
            paidBy?.userLogin ||
            entry.expense.paidByUserId,
          payers,
          entry.expense.splitMode,
          participants,
          '',
          '',
        ]
      }

      const fromMember = membersByUserId.get(entry.settlement.fromUserId)
      const toMember = membersByUserId.get(entry.settlement.toUserId)

      return [
        'settlement',
        entry.id,
        entry.title,
        entry.settlement.note || '',
        formatDateTime(entry.occurredAt),
        formatMinorForCsv(entry.amountMinor),
        entry.currencyCode,
        '',
        '',
        '',
        '',
        fromMember?.displayName ||
          fromMember?.userLogin ||
          entry.settlement.fromUserId,
        toMember?.displayName ||
          toMember?.userLogin ||
          entry.settlement.toUserId,
      ]
    })

    const csvContent = [
      [
        'type',
        'entry_id',
        'title',
        'notes',
        'occurred_at',
        'amount',
        'currency',
        'paid_by',
        'payers',
        'split_mode',
        'participants',
        'settlement_from',
        'settlement_to',
      ],
      ...rows,
    ]
      .map((row) => row.map((value) => escapeCsvValue(value)).join(','))
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' })
    const downloadUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = downloadUrl
    anchor.download = `${group.slug}-activity.csv`
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(downloadUrl)
    showToast(`Downloaded CSV for ${group.name}`, 'success')
  }

  const recentLedgerEntries = group.ledgerEntries.slice(0, 8)
  const visibleInvites = group.invites.slice(0, 4)
  const canRecordSettlement = group.members.length > 1
  const mobileSections: Array<{
    id: MobileSection
    label: string
    icon: typeof ReceiptTextIcon
  }> = [
    { id: 'expense', label: 'Expense', icon: ReceiptTextIcon },
    { id: 'activity', label: 'Activity', icon: ActivityIcon },
    { id: 'group', label: 'Group', icon: Settings2Icon },
  ]

  const focusSection = (section: MobileSection) => {
    setMobileSection(section)

    window.requestAnimationFrame(() => {
      const target = document.getElementById(`${section}-section`)
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

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
      <div className="flex w-full flex-col gap-4 pb-24 sm:gap-5 sm:pb-0">
        {redirectedFromSlug ? (
          <Card size="sm" className="border-accent/35 bg-accent/8">
            <CardContent className="py-1 text-sm text-muted-foreground">
              `/{redirectedFromSlug}` now redirects to `/{group.slug}`.
            </CardContent>
          </Card>
        ) : null}

        <div className="sticky top-3 z-10 hidden sm:flex xl:top-4">
          <div className="flex items-center gap-2 rounded-[1.3rem] border border-border/70 bg-card/85 p-2 shadow-[0_14px_40px_rgba(74,68,88,0.08)] backdrop-blur-xl">
            {mobileSections.map((section) => (
              <Button
                key={section.id}
                type="button"
                size="sm"
                variant={mobileSection === section.id ? 'secondary' : 'ghost'}
                className="h-10 rounded-[1rem] px-3"
                onClick={() => focusSection(section.id)}
              >
                <section.icon className="size-4" />
                {section.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_340px]">
          <div
            id="expense-section"
            className={cn(
              'space-y-5',
              mobileSection === 'group' && 'hidden xl:block',
            )}
          >
            <Card
              className={cn(
                'border-border/70 bg-card/75',
                mobileSection !== 'expense' && 'hidden xl:flex',
              )}
            >
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
                    createExpenseMutation.mutate({
                      title: expenseTitle,
                      notes: expenseNotes,
                      amount: expenseAmount,
                      paidByUserId: expensePaidBy,
                      payerAmounts,
                      splitMode,
                      participantUserIds: selectedParticipantIds,
                      fixedShares,
                      percentageShares,
                      occurredOn: expenseOccurredOn,
                    })
                  }}
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <FieldLabel htmlFor="expense-title">Title</FieldLabel>
                      <TextInput
                        id="expense-title"
                        value={expenseTitle}
                        onChange={(event) =>
                          setExpenseTitle(event.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <FieldLabel htmlFor="expense-amount">Amount</FieldLabel>
                      <TextInput
                        id="expense-amount"
                        value={expenseAmount}
                        onChange={(event) => {
                          const nextAmount = event.target.value
                          setExpenseAmount(nextAmount)
                          setPayerAmounts((current) =>
                            rebalanceTwoParticipantPayers(
                              current,
                              lastEditedPayerUserId,
                              selectedParticipantIds,
                              nextAmount,
                            ),
                          )
                        }}
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
                      <FieldLabel htmlFor="expense-paid-by">
                        Default payer
                      </FieldLabel>
                      <SelectInput
                        id="expense-paid-by"
                        value={expensePaidBy}
                        onChange={(event) =>
                          setExpensePaidBy(event.target.value)
                        }
                      >
                        {memberOptions.map((member) => (
                          <option key={member.value} value={member.value}>
                            {member.label}
                          </option>
                        ))}
                      </SelectInput>
                      <FieldHint>
                        Used as the default payer if you do not split the
                        payment below.
                      </FieldHint>
                    </div>
                    <div className="space-y-2">
                      <FieldLabel htmlFor="split-mode">Split mode</FieldLabel>
                      <SelectInput
                        id="split-mode"
                        value={splitMode}
                        onChange={(event) => {
                          const nextSplitMode = event.target.value as SplitMode
                          setSplitMode(nextSplitMode)

                          if (nextSplitMode === 'percentage') {
                            setPercentageShares((current) => {
                              const hasAllSelectedValues =
                                selectedParticipantIds.every((participantId) =>
                                  current[participantId].trim(),
                                )

                              return hasAllSelectedValues
                                ? current
                                : buildEqualPercentageValues(
                                    selectedParticipantIds,
                                  )
                            })
                          }
                        }}
                      >
                        <option value="fixed">Fixed amounts</option>
                        <option value="percentage">Percentages</option>
                      </SelectInput>
                      <FieldHint>
                        Split the expense by amount or by percentage.
                      </FieldHint>
                    </div>
                  </div>

                  <div className="grid gap-3 rounded-[1.25rem] border border-border/70 bg-background/70 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <FieldLabel>Who paid</FieldLabel>
                      <span className="text-xs text-muted-foreground">
                        Amounts must add up to the total
                      </span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {group.members.map((member) => (
                        <div
                          key={member.userId}
                          className="grid gap-2 sm:grid-cols-[1fr_140px] sm:items-center"
                        >
                          <div className="text-sm font-medium text-foreground">
                            {member.displayName}
                          </div>
                          <TextInput
                            value={payerAmounts[member.userId] || ''}
                            onChange={(event) => {
                              const nextValue = event.target.value
                              setLastEditedPayerUserId(member.userId)
                              setPayerAmounts((current) =>
                                rebalanceTwoParticipantPayers(
                                  {
                                    ...current,
                                    [member.userId]: nextValue,
                                  },
                                  member.userId,
                                ),
                              )
                            }}
                            placeholder={
                              member.userId === expensePaidBy
                                ? expenseAmount || '0'
                                : '0'
                            }
                          />
                        </div>
                      ))}
                    </div>
                    <FieldHint>
                      Leave this blank to treat the selected payer as having
                      paid the full amount. With two participants, the second
                      payer auto-fills from the remaining amount.
                    </FieldHint>
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
                                setSelectedParticipantIds((current) => {
                                  const nextParticipantIds = event.target
                                    .checked
                                    ? [...current, member.userId]
                                    : current.filter(
                                        (value) => value !== member.userId,
                                      )

                                  if (splitMode === 'percentage') {
                                    setPercentageShares(
                                      buildEqualPercentageValues(
                                        nextParticipantIds,
                                      ),
                                    )
                                  }

                                  setPayerAmounts((currentPayerAmounts) =>
                                    rebalanceTwoParticipantPayers(
                                      currentPayerAmounts,
                                      lastEditedPayerUserId,
                                      nextParticipantIds,
                                    ),
                                  )

                                  return nextParticipantIds
                                })
                              }}
                            />
                            <span>{member.displayName}</span>
                          </label>
                        )
                      })}
                    </div>
                    <FieldHint>
                      Choose which members should share this expense.
                    </FieldHint>
                  </div>

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

                  <details className="rounded-[1.25rem] border border-border/70 bg-background/70 p-4 [&_summary::-webkit-details-marker]:hidden">
                    <summary className="list-none cursor-pointer text-sm font-medium text-foreground">
                      Add a note
                    </summary>
                    <div className="mt-3 space-y-2">
                      <FieldLabel htmlFor="expense-notes">Notes</FieldLabel>
                      <TextArea
                        id="expense-notes"
                        value={expenseNotes}
                        onChange={(event) =>
                          setExpenseNotes(event.target.value)
                        }
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

            <Card
              id="activity-section"
              className={cn(
                'border-border/70 bg-card/70',
                mobileSection !== 'activity' && 'hidden xl:flex',
              )}
            >
              <CardHeader className="gap-2">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle>Recent activity</CardTitle>
                    <CardDescription>
                      Latest expenses and settle-ups.
                    </CardDescription>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="text-xs text-muted-foreground">
                      {group.ledgerEntries.length
                        ? `${group.ledgerEntries.length} total`
                        : 'No entries yet'}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={downloadActivityCsv}
                      disabled={!exportableEntries.length}
                    >
                      <DownloadIcon className="size-4" />
                      Download CSV
                    </Button>
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

          <div
            id="group-section"
            className={cn(
              'space-y-5',
              mobileSection !== 'group' && 'hidden xl:block',
            )}
          >
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
                      createSettlementMutation.mutate({
                        fromUserId: settlementFromUserId,
                        toUserId: settlementToUserId,
                        amount: settlementAmount,
                        note: settlementNote,
                        occurredOn: settlementOccurredOn,
                      })
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
                      <FieldLabel htmlFor="settlement-to">
                        Received by
                      </FieldLabel>
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
                      <FieldLabel htmlFor="settlement-amount">
                        Amount
                      </FieldLabel>
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
                    className="flex flex-col gap-3 rounded-[1rem] border border-border/70 bg-background/75 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium text-foreground">
                        {member.displayName}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        @{member.userLogin}
                      </div>
                    </div>
                    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                      <Badge
                        variant={
                          member.role === 'owner' ? 'accent' : 'secondary'
                        }
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
                          onChange={(event) =>
                            setRenameSlug(event.target.value)
                          }
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
                        Older slugs stay reserved in history and keep
                        redirecting.
                      </FieldHint>
                      {renameError ? (
                        <FormMessage>{renameError}</FormMessage>
                      ) : null}
                    </div>

                    <div className="space-y-2 rounded-[1rem] border border-border/70 bg-background/75 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                                    showToast(
                                      `Invite copied: ${absoluteUrl}`,
                                      'success',
                                    )
                                  } catch {
                                    showToast(
                                      `Could not copy invite link: ${absoluteUrl}`,
                                      'error',
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

        <div className="fixed inset-x-4 bottom-4 z-20 sm:hidden">
          <div className="grid grid-cols-3 gap-2 rounded-[1.6rem] border border-border/70 bg-card/90 p-2 shadow-[0_20px_50px_rgba(74,68,88,0.14)] backdrop-blur-xl">
            {mobileSections.map((section) => (
              <Button
                key={section.id}
                type="button"
                variant={mobileSection === section.id ? 'secondary' : 'ghost'}
                className="h-14 flex-col gap-1 rounded-[1.1rem] px-2 text-[0.72rem]"
                onClick={() => focusSection(section.id)}
              >
                <section.icon className="size-4" />
                {section.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
