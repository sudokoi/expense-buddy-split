import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'

import { getDb } from '@/db/client'
import { createId } from '@/db/ids'
import {
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
  buildFixedShares,
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

export interface LedgerEntrySummary {
  id: string
  type: 'expense' | 'settlement'
  title: string
  subtitle: string
  amountMinor: number
  currencyCode: string
  occurredAt: Date
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

interface CreateExpenseInput {
  groupId: string
  title: string
  notes?: string
  amount: string
  paidByUserId: string
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

export async function listGroupsForUser(userId: string): Promise<GroupSummary[]> {
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
    .groupBy(groups.id, groups.name, groups.slug, groups.currencyCode, groupMembers.role, groups.createdAt)
    .orderBy(desc(groups.updatedAt), asc(groups.name))

  return memberships.map((membership) => ({
    ...membership,
    createdAt: membership.createdAt,
  }))
}

async function getGroupMembership(groupId: string, userId: string) {
  const db = getDb()

  return db.query.groupMembers.findFirst({
    where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
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

export async function createGroupForUser(user: AuthenticatedAppUser, input: CreateGroupInput) {
  const db = getDb()
  const slug = normalizeGroupSlug(input.slug)
  const name = input.name.trim()

  if (!name) {
    throw new Error('Enter a group name.')
  }

  await requireDistinctSlug(slug)

  const now = new Date()
  const groupId = createId()

  await db.transaction(async (tx) => {
    await tx.insert(groups).values({
      id: groupId,
      name,
      slug,
      currencyCode: input.currencyCode?.trim() || 'INR',
      createdByUserId: user.id,
      createdAt: now,
      updatedAt: now,
    })

    await tx.insert(groupMembers).values({
      id: createId(),
      groupId,
      userId: user.id,
      role: 'owner',
      joinedAt: now,
    })
  })

  return { groupId, slug }
}

export async function renameGroupForOwner(userId: string, input: RenameGroupInput) {
  const db = getDb()
  const nextSlug = normalizeGroupSlug(input.nextSlug)
  const membership = await requireGroupOwner(input.groupId, userId)
  const group = await db.query.groups.findFirst({ where: eq(groups.id, membership.groupId) })

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

async function listGroupMembers(groupId: string): Promise<GroupMemberSummary[]> {
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
    .orderBy(desc(sql`${groupMembers.role} = 'owner'`), asc(users.displayName), asc(users.userLogin))

  return rows
}

async function listGroupInvites(groupId: string): Promise<GroupInviteSummary[]> {
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

async function listLedgerEntries(groupId: string): Promise<LedgerEntrySummary[]> {
  const db = getDb()
  const fromUser = alias(users, 'from_user')
  const toUser = alias(users, 'to_user')

  const expenseRows = await db
    .select({
      id: expenses.id,
      title: expenses.title,
      amountMinor: expenses.amountMinor,
      currencyCode: expenses.currencyCode,
      occurredAt: expenses.occurredAt,
      paidByDisplayName: users.displayName,
    })
    .from(expenses)
    .innerJoin(users, eq(expenses.paidByUserId, users.id))
    .where(eq(expenses.groupId, groupId))

  const settlementRows = await db
    .select({
      id: settlements.id,
      amountMinor: settlements.amountMinor,
      currencyCode: settlements.currencyCode,
      occurredAt: settlements.occurredAt,
      fromDisplayName: fromUser.displayName,
      toDisplayName: toUser.displayName,
      note: settlements.note,
    })
    .from(settlements)
    .innerJoin(fromUser, eq(fromUser.id, settlements.fromUserId))
    .innerJoin(toUser, eq(toUser.id, settlements.toUserId))
    .where(eq(settlements.groupId, groupId))

  return [
    ...expenseRows.map((row) => ({
      id: row.id,
      type: 'expense' as const,
      title: row.title,
      subtitle: `Paid by ${row.paidByDisplayName}`,
      amountMinor: row.amountMinor,
      currencyCode: row.currencyCode,
      occurredAt: row.occurredAt,
    })),
    ...settlementRows.map((row) => ({
      id: row.id,
      type: 'settlement' as const,
      title: 'Settlement',
      subtitle: `${row.fromDisplayName} paid ${row.toDisplayName}${row.note ? ` · ${row.note}` : ''}`,
      amountMinor: row.amountMinor,
      currencyCode: row.currencyCode,
      occurredAt: row.occurredAt,
    })),
  ].sort((left, right) => right.occurredAt.valueOf() - left.occurredAt.valueOf())
}

async function listBalanceSummary(groupId: string): Promise<BalanceSummary[]> {
  const db = getDb()
  const members = await listGroupMembers(groupId)

  const expenseRows = await db.query.expenses.findMany({
    where: eq(expenses.groupId, groupId),
    with: {
      participants: true,
    },
  })

  const settlementRows = await db.query.settlements.findMany({
    where: eq(settlements.groupId, groupId),
  })

  const balances = new Map<string, number>(members.map((member) => [member.userId, 0]))

  for (const expense of expenseRows) {
    balances.set(expense.paidByUserId, (balances.get(expense.paidByUserId) || 0) + expense.amountMinor)

    for (const participant of expense.participants) {
      balances.set(participant.userId, (balances.get(participant.userId) || 0) - participant.amountMinor)
    }
  }

  for (const settlement of settlementRows) {
    balances.set(settlement.fromUserId, (balances.get(settlement.fromUserId) || 0) + settlement.amountMinor)
    balances.set(settlement.toUserId, (balances.get(settlement.toUserId) || 0) - settlement.amountMinor)
  }

  return members
    .map((member) => ({
      userId: member.userId,
      displayName: member.displayName,
      userLogin: member.userLogin,
      avatarUrl: member.avatarUrl,
      balanceMinor: balances.get(member.userId) || 0,
    }))
    .sort((left, right) => right.balanceMinor - left.balanceMinor)
}

export async function getGroupDetailForUser(groupId: string, userId: string): Promise<GroupDetail> {
  const db = getDb()
  const membership = await requireGroupMembership(groupId, userId)
  const group = await db.query.groups.findFirst({ where: eq(groups.id, groupId) })

  if (!group) {
    throw new Error('Group not found.')
  }

  const [members, invites, ledgerEntries, balances] = await Promise.all([
    listGroupMembers(group.id),
    listGroupInvites(group.id),
    listLedgerEntries(group.id),
    listBalanceSummary(group.id),
  ])

  return {
    id: group.id,
    name: group.name,
    slug: group.slug,
    currencyCode: group.currencyCode,
    role: membership.role,
    members,
    invites,
    ledgerEntries,
    balances,
  }
}

export async function createInviteForOwner(userId: string, input: CreateInviteInput) {
  const db = getDb()

  await requireGroupOwner(input.groupId, userId)

  const now = new Date()
  const expiresAt = new Date(now.valueOf() + (input.expiresInDays ?? 7) * 24 * 60 * 60 * 1000)
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

export async function getInviteForUser(token: string, userId: string) {
  const db = getDb()

  const invite = await db.query.groupInvites.findFirst({
    where: eq(groupInvites.tokenHash, token),
  })

  if (!invite) {
    return null
  }

  const group = await db.query.groups.findFirst({ where: eq(groups.id, invite.groupId) })
  if (!group) {
    return null
  }

  const membership = await getGroupMembership(group.id, userId)
  const isExpired = invite.expiresAt.valueOf() < Date.now()
  const isExhausted = invite.maxUses !== null && invite.usedCount >= invite.maxUses
  const isRevoked = Boolean(invite.revokedAt)

  return {
    token,
    groupId: group.id,
    groupName: group.name,
    groupSlug: group.slug,
    expiresAt: invite.expiresAt,
    isExpired,
    isExhausted,
    isRevoked,
    alreadyMember: Boolean(membership),
  }
}

export async function joinGroupViaInvite(user: AuthenticatedAppUser, input: JoinInviteInput) {
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
    throw new Error('Invite link has already been used the maximum number of times.')
  }

  const existingMembership = await getGroupMembership(invite.groupId, user.id)
  if (existingMembership) {
    const group = await db.query.groups.findFirst({ where: eq(groups.id, invite.groupId) })

    if (!group) {
      throw new Error('Group not found.')
    }

    return { slug: group.slug }
  }

  const group = await db.query.groups.findFirst({ where: eq(groups.id, invite.groupId) })

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
  const uniqueUserIds = ensureUniqueValues(userIds, 'Each participant can only appear once.')

  const rows = await db.query.groupMembers.findMany({
    where: and(eq(groupMembers.groupId, groupId), inArray(groupMembers.userId, uniqueUserIds)),
  })

  if (rows.length !== uniqueUserIds.length) {
    throw new Error('All selected users must already be group members.')
  }

  return uniqueUserIds
}

export async function createExpenseForUser(userId: string, input: CreateExpenseInput) {
  const db = getDb()
  const membership = await requireGroupMembership(input.groupId, userId)
  const group = await db.query.groups.findFirst({ where: eq(groups.id, membership.groupId) })

  if (!group) {
    throw new Error('Group not found.')
  }

  const title = input.title.trim()
  if (!title) {
    throw new Error('Enter an expense title.')
  }

  const amountMinor = parseAmountInputToMinorUnits(input.amount)
  const participantUserIds = await requireUsersInGroup(group.id, input.participantUserIds)
  const paidByUserIds = await requireUsersInGroup(group.id, [input.paidByUserId])
  const occurredAt = ensureIsoDate(input.occurredOn)

  const shares =
    input.splitMode === 'equal'
      ? distributeEqualShares(amountMinor, participantUserIds)
      : input.splitMode === 'fixed'
        ? buildFixedShares(amountMinor, input.fixedShares || {})
        : buildPercentageShares(amountMinor, input.percentageShares || {})

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
      paidByUserId: paidByUserIds[0],
      splitMode: input.splitMode,
      occurredAt,
      createdByUserId: userId,
      createdAt: now,
      updatedAt: now,
    })

    await tx.insert(expenseParticipants).values(
      shares.map((share) => ({
        id: createId(),
        expenseId,
        userId: share.userId,
        amountMinor: share.amountMinor,
        percentageBasisPoints: share.percentageBasisPoints,
      })),
    )

    await tx.update(groups).set({ updatedAt: now }).where(eq(groups.id, group.id))
  })
}

export async function createSettlementForUser(userId: string, input: CreateSettlementInput) {
  const db = getDb()
  const membership = await requireGroupMembership(input.groupId, userId)
  const group = await db.query.groups.findFirst({ where: eq(groups.id, membership.groupId) })

  if (!group) {
    throw new Error('Group not found.')
  }

  const [fromUserId, toUserId] = await requireUsersInGroup(group.id, [input.fromUserId, input.toUserId])
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

    await tx.update(groups).set({ updatedAt: now }).where(eq(groups.id, group.id))
  })
}

export async function getDashboardForUser(user: AuthenticatedAppUser) {
  const userGroups = await listGroupsForUser(user.id)

  return {
    groups: userGroups,
    hasGroups: userGroups.length > 0,
  }
}
