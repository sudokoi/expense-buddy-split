import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'

import { getDb } from '@/db/client'
import { createId } from '@/db/ids'
import {
  expensePayers,
  expenseParticipants,
  expenses,
  groupInvites,
  groupMembers,
  groupSlugHistory,
  groups,
  settlements,
  users,
} from '@/db/schema'
import {
  buildLedgerSnapshot,
  createGroupRecords,
  evaluateInviteState,
  type LedgerEntrySummary,
} from '@/features/groups/group-domain'
import {
  buildSuggestedGroupSlug,
  buildFixedShares,
  buildExpensePayers,
  buildPercentageShares,
  distributeEqualShares,
  ensureIsoDate,
  ensureUniqueValues,
  normalizeGroupSlug,
  parseAmountInputToMinorUnits,
} from '@/features/groups/group-shared'

type GroupMembershipRow = typeof groupMembers.$inferSelect
export interface AuthenticatedAppUser {
  id: string
  githubUserId: number
  userLogin: string
  displayName: string
  avatarUrl: string | null
}

export interface GroupSummary {
  id: string
  name: string
  slug: string
  currencyCode: string
  memberCount: number
  role: GroupMembershipRow['role']
  createdAt: Date
}

export interface GroupMemberSummary {
  userId: string
  userLogin: string
  displayName: string
  avatarUrl: string | null
  role: GroupMembershipRow['role']
}

export interface GroupInviteSummary {
  id: string
  token: string
  shareUrl: string
  expiresAt: Date
  usedCount: number
  maxUses: number | null
  revokedAt: Date | null
  createdAt: Date
}

export interface BalanceSummary {
  userId: string
  displayName: string
  userLogin: string
  avatarUrl: string | null
  balanceMinor: number
}

export interface GroupDetail {
  id: string
  name: string
  slug: string
  currencyCode: string
  role: GroupMembershipRow['role']
  members: GroupMemberSummary[]
  invites: GroupInviteSummary[]
  ledgerEntries: LedgerEntrySummary[]
  balances: BalanceSummary[]
}

interface CreateGroupInput {
  name: string
  slug: string
  currencyCode?: string
}

interface RenameGroupInput {
  groupId: string
  nextSlug: string
}

interface CreateInviteInput {
  groupId: string
  expiresInDays?: number
  maxUses?: number | null
}

interface JoinInviteInput {
  token: string
}

interface RevokeInviteInput {
  groupId: string
  inviteId: string
}

interface CreateExpenseInput {
  groupId: string
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

interface CreateSettlementInput {
  groupId: string
  fromUserId: string
  toUserId: string
  amount: string
  note?: string
  occurredOn?: string
}

interface UpdateExpenseInput extends CreateExpenseInput {
  expenseId: string
}

interface DeleteExpenseInput {
  groupId: string
  expenseId: string
}

interface UpdateSettlementInput extends CreateSettlementInput {
  settlementId: string
}

interface DeleteSettlementInput {
  groupId: string
  settlementId: string
}

interface UpdateMemberRoleInput {
  groupId: string
  memberUserId: string
  role: 'owner' | 'member'
}

interface RemoveMemberInput {
  groupId: string
  memberUserId: string
}

function createInviteToken() {
  return crypto.randomUUID().replace(/-/g, '')
}

export async function requirePersistedUserByGitHubId(githubUserId: number) {
  const db = getDb()

  const user = await db.query.users.findFirst({
    where: eq(users.githubUserId, githubUserId),
  })

  if (!user) {
    throw new Error('Your account is not available yet. Please sign in again.')
  }

  return user satisfies AuthenticatedAppUser
}

export async function listGroupsForUser(
  userId: string,
): Promise<GroupSummary[]> {
  const db = getDb()
  const memberCounts = alias(groupMembers, 'member_counts')

  const memberships = await db
    .select({
      id: groups.id,
      name: groups.name,
      slug: groups.slug,
      currencyCode: groups.currencyCode,
      role: groupMembers.role,
      createdAt: groups.createdAt,
      memberCount: count(memberCounts.id),
    })
    .from(groupMembers)
    .innerJoin(groups, eq(groupMembers.groupId, groups.id))
    .innerJoin(memberCounts, eq(memberCounts.groupId, groups.id))
    .where(eq(groupMembers.userId, userId))
    .groupBy(
      groups.id,
      groups.name,
      groups.slug,
      groups.currencyCode,
      groupMembers.role,
      groups.createdAt,
    )
    .orderBy(desc(groups.updatedAt), asc(groups.name))

  return memberships.map((membership) => ({
    ...membership,
    createdAt: membership.createdAt,
  }))
}

async function getGroupMembership(groupId: string, userId: string) {
  const db = getDb()

  return db.query.groupMembers.findFirst({
    where: and(
      eq(groupMembers.groupId, groupId),
      eq(groupMembers.userId, userId),
    ),
  })
}

async function requireGroupMembership(groupId: string, userId: string) {
  const membership = await getGroupMembership(groupId, userId)

  if (!membership) {
    throw new Error('You do not have access to this group.')
  }

  return membership
}

async function requireGroupOwner(groupId: string, userId: string) {
  const membership = await requireGroupMembership(groupId, userId)
  if (membership.role !== 'owner') {
    throw new Error('Only group owners can do that.')
  }

  return membership
}

async function requireDistinctSlug(slug: string, currentGroupId?: string) {
  const db = getDb()

  const existingGroup = await db.query.groups.findFirst({
    where: eq(groups.slug, slug),
  })

  if (existingGroup && existingGroup.id !== currentGroupId) {
    throw new Error('That slug is already taken.')
  }

  const historicalGroup = await db.query.groupSlugHistory.findFirst({
    where: eq(groupSlugHistory.slug, slug),
  })

  if (historicalGroup && historicalGroup.groupId !== currentGroupId) {
    throw new Error('That slug has already been used and cannot be reused.')
  }
}

async function isSlugTaken(slug: string, currentGroupId?: string) {
  const db = getDb()

  const existingGroup = await db.query.groups.findFirst({
    where: eq(groups.slug, slug),
  })

  if (existingGroup && existingGroup.id !== currentGroupId) {
    return true
  }

  const historicalGroup = await db.query.groupSlugHistory.findFirst({
    where: eq(groupSlugHistory.slug, slug),
  })

  return Boolean(historicalGroup && historicalGroup.groupId !== currentGroupId)
}

export async function suggestAvailableGroupSlug(name: string) {
  for (let sequence = 1; sequence < 1_000; sequence += 1) {
    const slug = buildSuggestedGroupSlug(name, sequence)

    if (!(await isSlugTaken(slug))) {
      return { slug }
    }
  }

  throw new Error('Could not generate an available group slug.')
}

export async function createGroupForUser(
  user: AuthenticatedAppUser,
  input: CreateGroupInput,
) {
  const db = getDb()
  const slug = normalizeGroupSlug(input.slug)
  const name = input.name.trim()

  if (!name) {
    throw new Error('Enter a group name.')
  }

  await requireDistinctSlug(slug)

  const now = new Date()
  const records = createGroupRecords({
    userId: user.id,
    name,
    slug,
    currencyCode: input.currencyCode?.trim() || 'INR',
    now,
    createId,
  })

  await db.transaction(async (tx) => {
    await tx.insert(groups).values(records.group)
    await tx.insert(groupMembers).values(records.membership)
  })

  return { groupId: records.group.id, slug: records.group.slug }
}

export async function renameGroupForOwner(
  userId: string,
  input: RenameGroupInput,
) {
  const db = getDb()
  const nextSlug = normalizeGroupSlug(input.nextSlug)
  const membership = await requireGroupOwner(input.groupId, userId)
  const group = await db.query.groups.findFirst({
    where: eq(groups.id, membership.groupId),
  })

  if (!group) {
    throw new Error('Group not found.')
  }

  if (group.slug === nextSlug) {
    return { slug: group.slug }
  }

  await requireDistinctSlug(nextSlug, group.id)

  const now = new Date()

  await db.transaction(async (tx) => {
    await tx.insert(groupSlugHistory).values({
      id: createId(),
      groupId: group.id,
      slug: group.slug,
      createdAt: now,
    })

    await tx
      .update(groups)
      .set({ slug: nextSlug, updatedAt: now })
      .where(eq(groups.id, group.id))
  })

  return { slug: nextSlug }
}

export async function findGroupAccessBySlug(slug: string, userId: string) {
  const db = getDb()
  const currentGroup = await db.query.groups.findFirst({
    where: eq(groups.slug, slug),
  })

  if (currentGroup) {
    const membership = await getGroupMembership(currentGroup.id, userId)
    return {
      groupId: currentGroup.id,
      currentSlug: currentGroup.slug,
      redirectedFromSlug: null as string | null,
      hasAccess: Boolean(membership),
      role: membership?.role,
    }
  }

  const historicalSlug = await db.query.groupSlugHistory.findFirst({
    where: eq(groupSlugHistory.slug, slug),
  })

  if (!historicalSlug) {
    return null
  }

  const targetGroup = await db.query.groups.findFirst({
    where: eq(groups.id, historicalSlug.groupId),
  })

  if (!targetGroup) {
    return null
  }

  const membership = await getGroupMembership(targetGroup.id, userId)

  return {
    groupId: targetGroup.id,
    currentSlug: targetGroup.slug,
    redirectedFromSlug: slug,
    hasAccess: Boolean(membership),
    role: membership?.role,
  }
}

async function listGroupMembers(
  groupId: string,
): Promise<GroupMemberSummary[]> {
  const db = getDb()

  const rows = await db
    .select({
      userId: users.id,
      userLogin: users.userLogin,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      role: groupMembers.role,
    })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(eq(groupMembers.groupId, groupId))
    .orderBy(
      desc(sql`${groupMembers.role} = 'owner'`),
      asc(users.displayName),
      asc(users.userLogin),
    )

  return rows
}

async function listGroupInvites(
  groupId: string,
): Promise<GroupInviteSummary[]> {
  const db = getDb()

  const rows = await db.query.groupInvites.findMany({
    where: eq(groupInvites.groupId, groupId),
    orderBy: [desc(groupInvites.createdAt)],
  })

  return rows.map((row) => ({
    id: row.id,
    token: row.tokenHash,
    shareUrl: `/join/${row.tokenHash}`,
    expiresAt: row.expiresAt,
    usedCount: row.usedCount,
    maxUses: row.maxUses,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
  }))
}

async function getLedgerRecords(groupId: string) {
  const db = getDb()
  const expenseRows = await db.query.expenses.findMany({
    where: eq(expenses.groupId, groupId),
    with: {
      payers: true,
      participants: true,
    },
  })

  const settlementRows = await db.query.settlements.findMany({
    where: eq(settlements.groupId, groupId),
  })

  return {
    expenses: expenseRows.map((expense) => ({
      id: expense.id,
      title: expense.title,
      notes: expense.notes,
      amountMinor: expense.amountMinor,
      currencyCode: expense.currencyCode,
      paidByUserId: expense.paidByUserId,
      payers: expense.payers.length
        ? expense.payers.map((payer) => ({
            userId: payer.userId,
            amountMinor: payer.amountMinor,
          }))
        : [
            {
              userId: expense.paidByUserId,
              amountMinor: expense.amountMinor,
            },
          ],
      splitMode: expense.splitMode,
      occurredAt: expense.occurredAt,
      createdByUserId: expense.createdByUserId,
      participants: expense.participants,
    })),
    settlements: settlementRows.map((settlement) => ({
      id: settlement.id,
      amountMinor: settlement.amountMinor,
      currencyCode: settlement.currencyCode,
      fromUserId: settlement.fromUserId,
      toUserId: settlement.toUserId,
      note: settlement.note,
      occurredAt: settlement.occurredAt,
      createdByUserId: settlement.createdByUserId,
    })),
  }
}

export async function getGroupDetailForUser(
  groupId: string,
  userId: string,
): Promise<GroupDetail> {
  const db = getDb()
  const membership = await requireGroupMembership(groupId, userId)
  const group = await db.query.groups.findFirst({
    where: eq(groups.id, groupId),
  })

  if (!group) {
    throw new Error('Group not found.')
  }

  const [members, invites, ledgerRecords] = await Promise.all([
    listGroupMembers(group.id),
    listGroupInvites(group.id),
    getLedgerRecords(group.id),
  ])

  const snapshot = buildLedgerSnapshot({
    members,
    expenses: ledgerRecords.expenses,
    settlements: ledgerRecords.settlements,
    viewerUserId: userId,
  })

  return {
    id: group.id,
    name: group.name,
    slug: group.slug,
    currencyCode: group.currencyCode,
    role: membership.role,
    members,
    invites,
    ledgerEntries: snapshot.ledgerEntries,
    balances: snapshot.balances,
  }
}

export async function createInviteForOwner(
  userId: string,
  input: CreateInviteInput,
) {
  const db = getDb()

  await requireGroupOwner(input.groupId, userId)

  const now = new Date()
  const expiresAt = new Date(
    now.valueOf() + (input.expiresInDays ?? 7) * 24 * 60 * 60 * 1000,
  )
  const token = createInviteToken()

  await db.insert(groupInvites).values({
    id: createId(),
    groupId: input.groupId,
    tokenHash: token,
    createdByUserId: userId,
    expiresAt,
    maxUses: input.maxUses ?? null,
    usedCount: 0,
    revokedAt: null,
    createdAt: now,
  })

  return { token, shareUrl: `/join/${token}` }
}

export async function revokeInviteForOwner(
  userId: string,
  input: RevokeInviteInput,
) {
  const db = getDb()

  await requireGroupOwner(input.groupId, userId)

  const invite = await db.query.groupInvites.findFirst({
    where: and(
      eq(groupInvites.id, input.inviteId),
      eq(groupInvites.groupId, input.groupId),
    ),
  })

  if (!invite) {
    throw new Error('Invite not found.')
  }

  await db
    .update(groupInvites)
    .set({ revokedAt: new Date() })
    .where(eq(groupInvites.id, invite.id))
}

export async function getInviteForUser(token: string, userId: string) {
  const db = getDb()

  const invite = await db.query.groupInvites.findFirst({
    where: eq(groupInvites.tokenHash, token),
  })

  if (!invite) {
    return null
  }

  const group = await db.query.groups.findFirst({
    where: eq(groups.id, invite.groupId),
  })
  if (!group) {
    return null
  }

  const membership = await getGroupMembership(group.id, userId)
  const inviteState = evaluateInviteState({
    expiresAt: invite.expiresAt,
    maxUses: invite.maxUses,
    usedCount: invite.usedCount,
    revokedAt: invite.revokedAt,
    alreadyMember: Boolean(membership),
  })

  return {
    token,
    groupId: group.id,
    groupName: group.name,
    groupSlug: group.slug,
    expiresAt: invite.expiresAt,
    isExpired: inviteState.isExpired,
    isExhausted: inviteState.isExhausted,
    isRevoked: inviteState.isRevoked,
    alreadyMember: inviteState.alreadyMember,
  }
}

export async function joinGroupViaInvite(
  user: AuthenticatedAppUser,
  input: JoinInviteInput,
) {
  const db = getDb()
  const invite = await db.query.groupInvites.findFirst({
    where: eq(groupInvites.tokenHash, input.token),
  })

  if (!invite) {
    throw new Error('Invite link not found.')
  }

  if (invite.revokedAt) {
    throw new Error('Invite link has been revoked.')
  }

  if (invite.expiresAt.valueOf() < Date.now()) {
    throw new Error('Invite link has expired.')
  }

  if (invite.maxUses !== null && invite.usedCount >= invite.maxUses) {
    throw new Error(
      'Invite link has already been used the maximum number of times.',
    )
  }

  const existingMembership = await getGroupMembership(invite.groupId, user.id)
  if (existingMembership) {
    const group = await db.query.groups.findFirst({
      where: eq(groups.id, invite.groupId),
    })

    if (!group) {
      throw new Error('Group not found.')
    }

    return { slug: group.slug }
  }

  const group = await db.query.groups.findFirst({
    where: eq(groups.id, invite.groupId),
  })

  if (!group) {
    throw new Error('Group not found.')
  }

  await db.transaction(async (tx) => {
    await tx.insert(groupMembers).values({
      id: createId(),
      groupId: group.id,
      userId: user.id,
      role: 'member',
      joinedAt: new Date(),
    })

    await tx
      .update(groupInvites)
      .set({ usedCount: invite.usedCount + 1 })
      .where(eq(groupInvites.id, invite.id))
  })

  return { slug: group.slug }
}

async function requireUsersInGroup(groupId: string, userIds: string[]) {
  const db = getDb()
  const uniqueUserIds = ensureUniqueValues(
    userIds,
    'Each participant can only appear once.',
  )

  const rows = await db.query.groupMembers.findMany({
    where: and(
      eq(groupMembers.groupId, groupId),
      inArray(groupMembers.userId, uniqueUserIds),
    ),
  })

  if (rows.length !== uniqueUserIds.length) {
    throw new Error('All selected users must already be group members.')
  }

  return uniqueUserIds
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

export async function createExpenseForUser(
  userId: string,
  input: CreateExpenseInput,
) {
  const db = getDb()
  const membership = await requireGroupMembership(input.groupId, userId)
  const group = await db.query.groups.findFirst({
    where: eq(groups.id, membership.groupId),
  })

  if (!group) {
    throw new Error('Group not found.')
  }

  const title = input.title.trim()
  if (!title) {
    throw new Error('Enter an expense title.')
  }

  const amountMinor = parseAmountInputToMinorUnits(input.amount)
  const participantUserIds = await requireUsersInGroup(
    group.id,
    input.participantUserIds,
  )
  const payers = buildExpensePayers(
    amountMinor,
    input.payerAmounts,
    input.paidByUserId,
  )
  const payerUserIds = await requireUsersInGroup(
    group.id,
    payers.map((payer) => payer.userId),
  )
  const occurredAt = ensureIsoDate(input.occurredOn)

  const shares =
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

  await requireUsersInGroup(
    group.id,
    shares.map((share) => share.userId),
  )

  const now = new Date()
  const expenseId = createId()

  await db.transaction(async (tx) => {
    await tx.insert(expenses).values({
      id: expenseId,
      groupId: group.id,
      title,
      notes: input.notes?.trim() || null,
      amountMinor,
      currencyCode: group.currencyCode,
      paidByUserId: payerUserIds[0],
      splitMode: input.splitMode,
      occurredAt,
      createdByUserId: userId,
      createdAt: now,
      updatedAt: now,
    })

    await tx.insert(expensePayers).values(
      payers.map((payer) => ({
        id: createId(),
        expenseId,
        userId: payer.userId,
        amountMinor: payer.amountMinor,
      })),
    )

    await tx.insert(expenseParticipants).values(
      shares.map((share) => ({
        id: createId(),
        expenseId,
        userId: share.userId,
        amountMinor: share.amountMinor,
        percentageBasisPoints: share.percentageBasisPoints,
      })),
    )

    await tx
      .update(groups)
      .set({ updatedAt: now })
      .where(eq(groups.id, group.id))
  })
}

export async function updateExpenseForUser(
  userId: string,
  input: UpdateExpenseInput,
) {
  const db = getDb()
  const expense = await db.query.expenses.findFirst({
    where: eq(expenses.id, input.expenseId),
  })

  if (!expense || expense.groupId !== input.groupId) {
    throw new Error('Expense not found.')
  }

  const membership = await requireGroupMembership(expense.groupId, userId)
  if (membership.role !== 'owner' && expense.createdByUserId !== userId) {
    throw new Error('You cannot edit this expense.')
  }

  const group = await db.query.groups.findFirst({
    where: eq(groups.id, expense.groupId),
  })
  if (!group) {
    throw new Error('Group not found.')
  }

  const title = input.title.trim()
  if (!title) {
    throw new Error('Enter an expense title.')
  }

  const amountMinor = parseAmountInputToMinorUnits(input.amount)
  const participantUserIds = await requireUsersInGroup(
    group.id,
    input.participantUserIds,
  )
  const payers = buildExpensePayers(
    amountMinor,
    input.payerAmounts,
    input.paidByUserId,
  )
  const payerUserIds = await requireUsersInGroup(
    group.id,
    payers.map((payer) => payer.userId),
  )
  const occurredAt = ensureIsoDate(input.occurredOn)

  const shares =
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

  const now = new Date()

  await db.transaction(async (tx) => {
    await tx
      .update(expenses)
      .set({
        title,
        notes: input.notes?.trim() || null,
        amountMinor,
        currencyCode: group.currencyCode,
        paidByUserId: payerUserIds[0],
        splitMode: input.splitMode,
        occurredAt,
        updatedAt: now,
      })
      .where(eq(expenses.id, expense.id))

    await tx.delete(expensePayers).where(eq(expensePayers.expenseId, expense.id))

    await tx.insert(expensePayers).values(
      payers.map((payer) => ({
        id: createId(),
        expenseId: expense.id,
        userId: payer.userId,
        amountMinor: payer.amountMinor,
      })),
    )

    await tx
      .delete(expenseParticipants)
      .where(eq(expenseParticipants.expenseId, expense.id))

    await tx.insert(expenseParticipants).values(
      shares.map((share) => ({
        id: createId(),
        expenseId: expense.id,
        userId: share.userId,
        amountMinor: share.amountMinor,
        percentageBasisPoints: share.percentageBasisPoints,
      })),
    )

    await tx
      .update(groups)
      .set({ updatedAt: now })
      .where(eq(groups.id, group.id))
  })
}

export async function deleteExpenseForUser(
  userId: string,
  input: DeleteExpenseInput,
) {
  const db = getDb()
  const expense = await db.query.expenses.findFirst({
    where: eq(expenses.id, input.expenseId),
  })

  if (!expense || expense.groupId !== input.groupId) {
    throw new Error('Expense not found.')
  }

  const membership = await requireGroupMembership(expense.groupId, userId)
  if (membership.role !== 'owner' && expense.createdByUserId !== userId) {
    throw new Error('You cannot delete this expense.')
  }

  await db.transaction(async (tx) => {
    await tx.delete(expensePayers).where(eq(expensePayers.expenseId, expense.id))
    await tx
      .delete(expenseParticipants)
      .where(eq(expenseParticipants.expenseId, expense.id))
    await tx.delete(expenses).where(eq(expenses.id, expense.id))
    await tx
      .update(groups)
      .set({ updatedAt: new Date() })
      .where(eq(groups.id, expense.groupId))
  })
}

export async function createSettlementForUser(
  userId: string,
  input: CreateSettlementInput,
) {
  const db = getDb()
  const membership = await requireGroupMembership(input.groupId, userId)
  const group = await db.query.groups.findFirst({
    where: eq(groups.id, membership.groupId),
  })

  if (!group) {
    throw new Error('Group not found.')
  }

  const [fromUserId, toUserId] = await requireUsersInGroup(group.id, [
    input.fromUserId,
    input.toUserId,
  ])
  if (fromUserId === toUserId) {
    throw new Error('Choose two different members for a settlement.')
  }

  const amountMinor = parseAmountInputToMinorUnits(input.amount)
  const occurredAt = ensureIsoDate(input.occurredOn)
  const now = new Date()

  await db.transaction(async (tx) => {
    await tx.insert(settlements).values({
      id: createId(),
      groupId: group.id,
      fromUserId,
      toUserId,
      amountMinor,
      currencyCode: group.currencyCode,
      note: input.note?.trim() || null,
      occurredAt,
      createdByUserId: userId,
      createdAt: now,
    })

    await tx
      .update(groups)
      .set({ updatedAt: now })
      .where(eq(groups.id, group.id))
  })
}

export async function updateSettlementForUser(
  userId: string,
  input: UpdateSettlementInput,
) {
  const db = getDb()
  const settlement = await db.query.settlements.findFirst({
    where: eq(settlements.id, input.settlementId),
  })

  if (!settlement || settlement.groupId !== input.groupId) {
    throw new Error('Settlement not found.')
  }

  const membership = await requireGroupMembership(settlement.groupId, userId)
  if (membership.role !== 'owner' && settlement.createdByUserId !== userId) {
    throw new Error('You cannot edit this settlement.')
  }

  const group = await db.query.groups.findFirst({
    where: eq(groups.id, settlement.groupId),
  })
  if (!group) {
    throw new Error('Group not found.')
  }

  const [fromUserId, toUserId] = await requireUsersInGroup(group.id, [
    input.fromUserId,
    input.toUserId,
  ])
  if (fromUserId === toUserId) {
    throw new Error('Choose two different members for a settlement.')
  }

  await db
    .update(settlements)
    .set({
      fromUserId,
      toUserId,
      amountMinor: parseAmountInputToMinorUnits(input.amount),
      currencyCode: group.currencyCode,
      note: input.note?.trim() || null,
      occurredAt: ensureIsoDate(input.occurredOn),
    })
    .where(eq(settlements.id, settlement.id))
}

export async function deleteSettlementForUser(
  userId: string,
  input: DeleteSettlementInput,
) {
  const db = getDb()
  const settlement = await db.query.settlements.findFirst({
    where: eq(settlements.id, input.settlementId),
  })

  if (!settlement || settlement.groupId !== input.groupId) {
    throw new Error('Settlement not found.')
  }

  const membership = await requireGroupMembership(settlement.groupId, userId)
  if (membership.role !== 'owner' && settlement.createdByUserId !== userId) {
    throw new Error('You cannot delete this settlement.')
  }

  await db.delete(settlements).where(eq(settlements.id, settlement.id))
}

export async function updateMemberRoleForOwner(
  userId: string,
  input: UpdateMemberRoleInput,
) {
  const db = getDb()

  await requireGroupOwner(input.groupId, userId)

  const membership = await db.query.groupMembers.findFirst({
    where: and(
      eq(groupMembers.groupId, input.groupId),
      eq(groupMembers.userId, input.memberUserId),
    ),
  })

  if (!membership) {
    throw new Error('Member not found.')
  }

  if (membership.userId === userId && input.role !== 'owner') {
    throw new Error('You cannot remove your own owner role.')
  }

  await db
    .update(groupMembers)
    .set({ role: input.role })
    .where(eq(groupMembers.id, membership.id))
}

export async function removeMemberForOwner(
  userId: string,
  input: RemoveMemberInput,
) {
  const db = getDb()

  await requireGroupOwner(input.groupId, userId)

  const membership = await db.query.groupMembers.findFirst({
    where: and(
      eq(groupMembers.groupId, input.groupId),
      eq(groupMembers.userId, input.memberUserId),
    ),
  })

  if (!membership) {
    throw new Error('Member not found.')
  }

  if (membership.userId === userId) {
    throw new Error('You cannot remove yourself from the group.')
  }

  await db.delete(groupMembers).where(eq(groupMembers.id, membership.id))
}

export async function getDashboardForUser(user: AuthenticatedAppUser) {
  const userGroups = await listGroupsForUser(user.id)

  return {
    groups: userGroups,
    hasGroups: userGroups.length > 0,
    userLogin: user.userLogin,
  }
}
