import type { SplitMode } from '@/features/groups/group-shared'

export interface GroupCreationRecord {
  id: string
  name: string
  slug: string
  currencyCode: string
  createdByUserId: string
  createdAt: Date
  updatedAt: Date
}

export interface GroupMembershipRecord {
  id: string
  groupId: string
  userId: string
  role: 'owner' | 'member'
  joinedAt: Date
}

export interface LedgerMember {
  userId: string
  userLogin: string
  displayName: string
  avatarUrl: string | null
  role: 'owner' | 'member'
}

export interface LedgerExpenseParticipant {
  userId: string
  amountMinor: number
  percentageBasisPoints: number | null
}

export interface LedgerExpenseRecord {
  id: string
  title: string
  notes: string | null
  amountMinor: number
  currencyCode: string
  paidByUserId: string
  splitMode: SplitMode
  occurredAt: Date
  createdByUserId: string
  participants: LedgerExpenseParticipant[]
}

export interface LedgerSettlementRecord {
  id: string
  amountMinor: number
  currencyCode: string
  fromUserId: string
  toUserId: string
  note: string | null
  occurredAt: Date
  createdByUserId: string
}

export type LedgerEntrySummary =
  | {
      id: string
      type: 'expense'
      title: string
      subtitle: string
      amountMinor: number
      currencyCode: string
      occurredAt: Date
      canManage: boolean
      expense: LedgerExpenseRecord
    }
  | {
      id: string
      type: 'settlement'
      title: string
      subtitle: string
      amountMinor: number
      currencyCode: string
      occurredAt: Date
      canManage: boolean
      settlement: LedgerSettlementRecord
    }

export interface BalanceSummary {
  userId: string
  displayName: string
  userLogin: string
  avatarUrl: string | null
  balanceMinor: number
}

interface CreateGroupRecordsInput {
  userId: string
  name: string
  slug: string
  currencyCode?: string
  now: Date
  createId: () => string
}

interface InviteStateInput {
  expiresAt: Date
  maxUses: number | null
  usedCount: number
  revokedAt: Date | null
  alreadyMember: boolean
  now?: Date
}

interface BuildLedgerSnapshotInput {
  members: LedgerMember[]
  expenses: LedgerExpenseRecord[]
  settlements: LedgerSettlementRecord[]
  viewerUserId: string
}

function getDisplayName(
  userId: string,
  membersByUserId: Map<string, LedgerMember>,
) {
  const member = membersByUserId.get(userId)
  return member?.displayName || member?.userLogin || 'Unknown member'
}

export function createGroupRecords(input: CreateGroupRecordsInput) {
  const groupId = input.createId()

  const group: GroupCreationRecord = {
    id: groupId,
    name: input.name,
    slug: input.slug,
    currencyCode: input.currencyCode || 'INR',
    createdByUserId: input.userId,
    createdAt: input.now,
    updatedAt: input.now,
  }

  const membership: GroupMembershipRecord = {
    id: input.createId(),
    groupId,
    userId: input.userId,
    role: 'owner',
    joinedAt: input.now,
  }

  return {
    group,
    membership,
  }
}

export function evaluateInviteState(input: InviteStateInput) {
  const now = input.now || new Date()
  const isExpired = input.expiresAt.valueOf() < now.valueOf()
  const isExhausted = input.maxUses !== null && input.usedCount >= input.maxUses
  const isRevoked = Boolean(input.revokedAt)

  return {
    alreadyMember: input.alreadyMember,
    isExpired,
    isExhausted,
    isRevoked,
    canJoin: !(input.alreadyMember || isExpired || isExhausted || isRevoked),
  }
}

export function buildLedgerSnapshot(input: BuildLedgerSnapshotInput) {
  const membersByUserId = new Map(
    input.members.map((member) => [member.userId, member]),
  )
  const viewerRole = membersByUserId.get(input.viewerUserId)?.role
  const balances = new Map<string, number>(
    input.members.map((member) => [member.userId, 0]),
  )

  const ledgerEntries: LedgerEntrySummary[] = [
    ...input.expenses.map((expense) => ({
      id: expense.id,
      type: 'expense' as const,
      title: expense.title,
      subtitle: `Paid by ${getDisplayName(expense.paidByUserId, membersByUserId)}`,
      amountMinor: expense.amountMinor,
      currencyCode: expense.currencyCode,
      occurredAt: expense.occurredAt,
      canManage:
        viewerRole === 'owner' ||
        expense.createdByUserId === input.viewerUserId,
      expense,
    })),
    ...input.settlements.map((settlement) => ({
      id: settlement.id,
      type: 'settlement' as const,
      title: 'Settlement',
      subtitle: `${getDisplayName(settlement.fromUserId, membersByUserId)} paid ${getDisplayName(settlement.toUserId, membersByUserId)}${settlement.note ? ` · ${settlement.note}` : ''}`,
      amountMinor: settlement.amountMinor,
      currencyCode: settlement.currencyCode,
      occurredAt: settlement.occurredAt,
      canManage:
        viewerRole === 'owner' ||
        settlement.createdByUserId === input.viewerUserId,
      settlement,
    })),
  ].sort(
    (left, right) => right.occurredAt.valueOf() - left.occurredAt.valueOf(),
  )

  for (const expense of input.expenses) {
    balances.set(
      expense.paidByUserId,
      (balances.get(expense.paidByUserId) || 0) + expense.amountMinor,
    )

    for (const participant of expense.participants) {
      balances.set(
        participant.userId,
        (balances.get(participant.userId) || 0) - participant.amountMinor,
      )
    }
  }

  for (const settlement of input.settlements) {
    balances.set(
      settlement.fromUserId,
      (balances.get(settlement.fromUserId) || 0) + settlement.amountMinor,
    )
    balances.set(
      settlement.toUserId,
      (balances.get(settlement.toUserId) || 0) - settlement.amountMinor,
    )
  }

  const balanceSummary: BalanceSummary[] = input.members
    .map((member) => ({
      userId: member.userId,
      displayName: member.displayName,
      userLogin: member.userLogin,
      avatarUrl: member.avatarUrl,
      balanceMinor: balances.get(member.userId) || 0,
    }))
    .sort((left, right) => right.balanceMinor - left.balanceMinor)

  return {
    ledgerEntries,
    balances: balanceSummary,
  }
}
