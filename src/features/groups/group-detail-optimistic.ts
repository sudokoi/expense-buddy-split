import {
  buildLedgerSnapshot
  
  
} from '@/features/groups/group-domain'
import type {LedgerExpenseRecord, LedgerSettlementRecord} from '@/features/groups/group-domain';
import type { GroupDetail } from '@/features/groups/group-repository'
import {
  buildExpensePayers,
  buildFixedShares,
  buildPercentageShares,
  distributeEqualShares,
  ensureIsoDate,
  ensureUniqueValues,
  parseAmountInputToMinorUnits,
} from '@/features/groups/group-shared'

export interface OptimisticExpenseInput {
  title: string
  notes?: string
  amount: string
  paidByUserId?: string
  payerAmounts?: Record<string, string>
  splitMode: 'equal' | 'fixed' | 'percentage'
  participantUserIds: string[]
  fixedShares?: Record<string, string>
  percentageShares?: Record<string, string>
  occurredOn?: string
}

export interface OptimisticSettlementInput {
  fromUserId: string
  toUserId: string
  amount: string
  note?: string
  occurredOn?: string
}

function createOptimisticId(prefix: string) {
  return `optimistic-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function selectShareInputs(
  userIds: string[],
  valuesByUserId: Record<string, string> | undefined,
) {
  return Object.fromEntries(
    userIds.flatMap((userId) => {
      const value = valuesByUserId?.[userId]?.trim()
      return value ? [[userId, value]] : []
    }),
  )
}

function assertGroupMembersExist(
  group: GroupDetail,
  userIds: string[],
  duplicateErrorMessage: string,
) {
  const uniqueUserIds = ensureUniqueValues(userIds, duplicateErrorMessage)
  const groupMemberIds = new Set(group.members.map((member) => member.userId))

  if (uniqueUserIds.some((userId) => !groupMemberIds.has(userId))) {
    throw new Error('All selected users must already be group members.')
  }

  return uniqueUserIds
}

function getLedgerRecords(group: GroupDetail) {
  const expenses: LedgerExpenseRecord[] = []
  const settlements: LedgerSettlementRecord[] = []

  for (const entry of group.ledgerEntries) {
    if (entry.type === 'expense') {
      expenses.push(entry.expense)
      continue
    }

    settlements.push(entry.settlement)
  }

  return { expenses, settlements }
}

function rebuildGroupDetail(
  group: GroupDetail,
  currentUserId: string,
  overrides: Partial<{
    members: GroupDetail['members']
    invites: GroupDetail['invites']
    expenses: LedgerExpenseRecord[]
    settlements: LedgerSettlementRecord[]
  }>,
) {
  const ledgerRecords = getLedgerRecords(group)
  const members = overrides.members ?? group.members
  const invites = overrides.invites ?? group.invites
  const expenses = overrides.expenses ?? ledgerRecords.expenses
  const settlements = overrides.settlements ?? ledgerRecords.settlements
  const snapshot = buildLedgerSnapshot({
    members,
    expenses,
    settlements,
    viewerUserId: currentUserId,
  })

  return {
    ...group,
    members,
    invites,
    ledgerEntries: snapshot.ledgerEntries,
    balances: snapshot.balances,
  }
}

export function applyOptimisticExpenseCreate(
  group: GroupDetail,
  currentUserId: string,
  input: OptimisticExpenseInput,
) {
  const title = input.title.trim()
  if (!title) {
    throw new Error('Enter an expense title.')
  }

  const amountMinor = parseAmountInputToMinorUnits(input.amount)
  const participantUserIds = assertGroupMembersExist(
    group,
    input.participantUserIds,
    'Each participant can only appear once.',
  )
  const payers = buildExpensePayers(
    amountMinor,
    input.payerAmounts,
    input.paidByUserId,
  )

  assertGroupMembersExist(
    group,
    payers.map((payer) => payer.userId),
    'Each participant can only appear once.',
  )

  const participants =
    input.splitMode === 'equal'
      ? distributeEqualShares(amountMinor, participantUserIds)
      : input.splitMode === 'fixed'
        ? buildFixedShares(
            amountMinor,
            selectShareInputs(participantUserIds, input.fixedShares),
          )
        : buildPercentageShares(
            amountMinor,
            selectShareInputs(participantUserIds, input.percentageShares),
          )

  const expense: LedgerExpenseRecord = {
    id: createOptimisticId('expense'),
    title,
    notes: input.notes?.trim() || null,
    amountMinor,
    currencyCode: group.currencyCode,
    paidByUserId: payers[0]?.userId || input.paidByUserId || '',
    payers,
    splitMode: input.splitMode,
    occurredAt: ensureIsoDate(input.occurredOn),
    createdByUserId: currentUserId,
    participants,
  }

  const { expenses } = getLedgerRecords(group)

  return rebuildGroupDetail(group, currentUserId, {
    expenses: [...expenses, expense],
  })
}

export function applyOptimisticExpenseDelete(
  group: GroupDetail,
  currentUserId: string,
  expenseId: string,
) {
  const { expenses } = getLedgerRecords(group)
  const nextExpenses = expenses.filter((expense) => expense.id !== expenseId)

  if (nextExpenses.length === expenses.length) {
    return group
  }

  return rebuildGroupDetail(group, currentUserId, {
    expenses: nextExpenses,
  })
}

export function applyOptimisticSettlementCreate(
  group: GroupDetail,
  currentUserId: string,
  input: OptimisticSettlementInput,
) {
  const [fromUserId, toUserId] = assertGroupMembersExist(
    group,
    [input.fromUserId, input.toUserId],
    'Each participant can only appear once.',
  )

  const settlement: LedgerSettlementRecord = {
    id: createOptimisticId('settlement'),
    amountMinor: parseAmountInputToMinorUnits(input.amount),
    currencyCode: group.currencyCode,
    fromUserId,
    toUserId,
    note: input.note?.trim() || null,
    occurredAt: ensureIsoDate(input.occurredOn),
    createdByUserId: currentUserId,
  }

  const { settlements } = getLedgerRecords(group)

  return rebuildGroupDetail(group, currentUserId, {
    settlements: [...settlements, settlement],
  })
}

export function applyOptimisticSettlementDelete(
  group: GroupDetail,
  currentUserId: string,
  settlementId: string,
) {
  const { settlements } = getLedgerRecords(group)
  const nextSettlements = settlements.filter(
    (settlement) => settlement.id !== settlementId,
  )

  if (nextSettlements.length === settlements.length) {
    return group
  }

  return rebuildGroupDetail(group, currentUserId, {
    settlements: nextSettlements,
  })
}

export function applyOptimisticInviteRevoke(
  group: GroupDetail,
  inviteId: string,
) {
  return {
    ...group,
    invites: group.invites.map((invite) =>
      invite.id === inviteId ? { ...invite, revokedAt: new Date() } : invite,
    ),
  }
}

export function applyOptimisticMemberRoleUpdate(
  group: GroupDetail,
  currentUserId: string,
  memberUserId: string,
  role: 'owner' | 'member',
) {
  const members = group.members.map((member) =>
    member.userId === memberUserId ? { ...member, role } : member,
  )
  const nextGroup = memberUserId === currentUserId ? { ...group, role } : group

  return rebuildGroupDetail(nextGroup, currentUserId, { members })
}

export function applyOptimisticMemberRemoval(
  group: GroupDetail,
  currentUserId: string,
  memberUserId: string,
) {
  const members = group.members.filter(
    (member) => member.userId !== memberUserId,
  )

  if (members.length === group.members.length) {
    return group
  }

  return rebuildGroupDetail(group, currentUserId, { members })
}
