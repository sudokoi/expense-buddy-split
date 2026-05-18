import { relations } from 'drizzle-orm'
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    githubUserId: integer('github_user_id').notNull(),
    userLogin: text('user_login').notNull(),
    displayName: text('display_name').notNull(),
    avatarUrl: text('avatar_url'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [uniqueIndex('users_github_user_id_idx').on(table.githubUserId)],
)

export const groups = sqliteTable(
  'groups',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    currencyCode: text('currency_code').notNull(),
    createdByUserId: text('created_by_user_id')
      .notNull()
      .references(() => users.id),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [uniqueIndex('groups_slug_idx').on(table.slug)],
)

export const groupSlugHistory = sqliteTable(
  'group_slug_history',
  {
    id: text('id').primaryKey(),
    groupId: text('group_id')
      .notNull()
      .references(() => groups.id),
    slug: text('slug').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [uniqueIndex('group_slug_history_slug_idx').on(table.slug)],
)

export const groupMembers = sqliteTable(
  'group_members',
  {
    id: text('id').primaryKey(),
    groupId: text('group_id')
      .notNull()
      .references(() => groups.id),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    role: text('role', { enum: ['owner', 'member'] }).notNull(),
    joinedAt: integer('joined_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [uniqueIndex('group_members_group_user_idx').on(table.groupId, table.userId)],
)

export const groupInvites = sqliteTable(
  'group_invites',
  {
    id: text('id').primaryKey(),
    groupId: text('group_id')
      .notNull()
      .references(() => groups.id),
    tokenHash: text('token_hash').notNull(),
    createdByUserId: text('created_by_user_id')
      .notNull()
      .references(() => users.id),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    maxUses: integer('max_uses'),
    usedCount: integer('used_count').notNull().default(0),
    revokedAt: integer('revoked_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [uniqueIndex('group_invites_token_hash_idx').on(table.tokenHash)],
)

export const expenses = sqliteTable(
  'expenses',
  {
    id: text('id').primaryKey(),
    groupId: text('group_id')
      .notNull()
      .references(() => groups.id),
    title: text('title').notNull(),
    notes: text('notes'),
    amountMinor: integer('amount_minor').notNull(),
    currencyCode: text('currency_code').notNull(),
    paidByUserId: text('paid_by_user_id')
      .notNull()
      .references(() => users.id),
    splitMode: text('split_mode', { enum: ['equal', 'fixed', 'percentage'] }).notNull(),
    occurredAt: integer('occurred_at', { mode: 'timestamp_ms' }).notNull(),
    createdByUserId: text('created_by_user_id')
      .notNull()
      .references(() => users.id),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  () => [],
)

export const expenseParticipants = sqliteTable(
  'expense_participants',
  {
    id: text('id').primaryKey(),
    expenseId: text('expense_id')
      .notNull()
      .references(() => expenses.id),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    amountMinor: integer('amount_minor').notNull(),
    percentageBasisPoints: integer('percentage_basis_points'),
  },
  (table) => [uniqueIndex('expense_participants_expense_user_idx').on(table.expenseId, table.userId)],
)

export const settlements = sqliteTable(
  'settlements',
  {
    id: text('id').primaryKey(),
    groupId: text('group_id')
      .notNull()
      .references(() => groups.id),
    fromUserId: text('from_user_id')
      .notNull()
      .references(() => users.id),
    toUserId: text('to_user_id')
      .notNull()
      .references(() => users.id),
    amountMinor: integer('amount_minor').notNull(),
    currencyCode: text('currency_code').notNull(),
    note: text('note'),
    occurredAt: integer('occurred_at', { mode: 'timestamp_ms' }).notNull(),
    createdByUserId: text('created_by_user_id')
      .notNull()
      .references(() => users.id),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  () => [],
)

export const usersRelations = relations(users, ({ many }) => ({
  createdGroups: many(groups),
  memberships: many(groupMembers),
  createdInvites: many(groupInvites),
  paidExpenses: many(expenses, { relationName: 'expense_paid_by_user' }),
  createdExpenses: many(expenses, { relationName: 'expense_created_by_user' }),
  expenseParticipations: many(expenseParticipants),
  outgoingSettlements: many(settlements, { relationName: 'settlement_from_user' }),
  incomingSettlements: many(settlements, { relationName: 'settlement_to_user' }),
  createdSettlements: many(settlements, { relationName: 'settlement_created_by_user' }),
}))

export const groupsRelations = relations(groups, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [groups.createdByUserId],
    references: [users.id],
  }),
  slugHistory: many(groupSlugHistory),
  memberships: many(groupMembers),
  invites: many(groupInvites),
  expenses: many(expenses),
  settlements: many(settlements),
}))

export const groupSlugHistoryRelations = relations(groupSlugHistory, ({ one }) => ({
  group: one(groups, {
    fields: [groupSlugHistory.groupId],
    references: [groups.id],
  }),
}))

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groups, {
    fields: [groupMembers.groupId],
    references: [groups.id],
  }),
  user: one(users, {
    fields: [groupMembers.userId],
    references: [users.id],
  }),
}))

export const groupInvitesRelations = relations(groupInvites, ({ one }) => ({
  group: one(groups, {
    fields: [groupInvites.groupId],
    references: [groups.id],
  }),
  createdBy: one(users, {
    fields: [groupInvites.createdByUserId],
    references: [users.id],
  }),
}))

export const expensesRelations = relations(expenses, ({ one, many }) => ({
  group: one(groups, {
    fields: [expenses.groupId],
    references: [groups.id],
  }),
  paidBy: one(users, {
    relationName: 'expense_paid_by_user',
    fields: [expenses.paidByUserId],
    references: [users.id],
  }),
  createdBy: one(users, {
    relationName: 'expense_created_by_user',
    fields: [expenses.createdByUserId],
    references: [users.id],
  }),
  participants: many(expenseParticipants),
}))

export const expenseParticipantsRelations = relations(expenseParticipants, ({ one }) => ({
  expense: one(expenses, {
    fields: [expenseParticipants.expenseId],
    references: [expenses.id],
  }),
  user: one(users, {
    fields: [expenseParticipants.userId],
    references: [users.id],
  }),
}))

export const settlementsRelations = relations(settlements, ({ one }) => ({
  group: one(groups, {
    fields: [settlements.groupId],
    references: [groups.id],
  }),
  fromUser: one(users, {
    relationName: 'settlement_from_user',
    fields: [settlements.fromUserId],
    references: [users.id],
  }),
  toUser: one(users, {
    relationName: 'settlement_to_user',
    fields: [settlements.toUserId],
    references: [users.id],
  }),
  createdBy: one(users, {
    relationName: 'settlement_created_by_user',
    fields: [settlements.createdByUserId],
    references: [users.id],
  }),
}))

export const schema = {
  users,
  groups,
  groupSlugHistory,
  groupMembers,
  groupInvites,
  expenses,
  expenseParticipants,
  settlements,
  usersRelations,
  groupsRelations,
  groupSlugHistoryRelations,
  groupMembersRelations,
  groupInvitesRelations,
  expensesRelations,
  expenseParticipantsRelations,
  settlementsRelations,
} as const
