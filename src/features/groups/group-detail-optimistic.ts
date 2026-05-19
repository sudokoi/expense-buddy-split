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

export interface OptimisticExpenseUpdateInput extends OptimisticExpenseInput {
  expenseId: string
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
    expenses: LedgerExpenseRecord[]
  }>,
) {
  const ledgerRecords = getLedgerRecords(group)
  const members = group.members
  const invites = group.invites
  const expenses = overrides.expenses ?? ledgerRecords.expenses
  const settlements = ledgerRecords.settlements
  const snapshot = buildLedgerSnapshot({
    members,
    expenses,
    settlements,
    viewerUserId: currentUserId,
  })

  return {
    ...group,
    invites,
    ledgerEntries: snapshot.ledgerEntries,
    balances: snapshot.balances,
  }
}

function buildOptimisticExpenseRecord(
  group: GroupDetail,
  expenseId: string,
  createdByUserId: string,
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
    'Each payer can only appear once.',
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

  return {
    id: expenseId,
    title,
    notes: input.notes?.trim() || null,
    amountMinor,
    currencyCode: group.currencyCode,
    paidByUserId: payers[0]?.userId || input.paidByUserId || '',
    payers,
    splitMode: input.splitMode,
    occurredAt: ensureIsoDate(input.occurredOn),
    createdByUserId,
    participants,
  } satisfies LedgerExpenseRecord
}

export function applyOptimisticExpenseCreate(
  group: GroupDetail,
  currentUserId: string,
  input: OptimisticExpenseInput,
) {
  const expense = buildOptimisticExpenseRecord(
    group,
    createOptimisticId('expense'),
    currentUserId,
    input,
  )

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

export function applyOptimisticExpenseUpdate(
  group: GroupDetail,
  currentUserId: string,
  input: OptimisticExpenseUpdateInput,
) {
  const { expenses } = getLedgerRecords(group)
  const existingExpense = expenses.find(
    (expense) => expense.id === input.expenseId,
  )

  if (!existingExpense) {
    return group
  }

  const nextExpenses = expenses.map((expense) =>
    expense.id === input.expenseId
      ? buildOptimisticExpenseRecord(
          group,
          existingExpense.id,
          existingExpense.createdByUserId,
          input,
        )
      : expense,
  )

  return rebuildGroupDetail(group, currentUserId, {
    expenses: nextExpenses,
  })
}
