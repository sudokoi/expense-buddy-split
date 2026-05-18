import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import {
  createExpenseForUser,
  createGroupForUser,
  createInviteForOwner,
  createSettlementForUser,
  findGroupAccessBySlug,
  getDashboardForUser,
  getGroupDetailForUser,
  getInviteForUser,
  joinGroupViaInvite,
  renameGroupForOwner,
  requirePersistedUserByGitHubId,
} from '@/features/groups/group-repository'
import { requireAuthenticatedSessionMiddleware } from '@/server/auth-middleware'

async function requireCurrentUser(githubUserId: number) {
  return requirePersistedUserByGitHubId(githubUserId)
}

function requireSessionGitHubUserId(githubUserId: number | undefined) {
  if (!githubUserId) {
    throw new Error('Your session is missing a GitHub user id. Please sign in again.')
  }

  return githubUserId
}

const createGroupSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  currencyCode: z.string().optional(),
})

const renameGroupSchema = z.object({
  groupId: z.string().min(1),
  nextSlug: z.string().min(1),
})

const groupIdSchema = z.object({
  groupId: z.string().min(1),
})

const groupSlugSchema = z.object({
  slug: z.string().min(1),
})

const inviteTokenSchema = z.object({
  token: z.string().min(1),
})

const createInviteSchema = z.object({
  groupId: z.string().min(1),
  expiresInDays: z.number().int().min(1).max(30).optional(),
  maxUses: z.number().int().min(1).max(500).nullable().optional(),
})

const createExpenseSchema = z.object({
  groupId: z.string().min(1),
  title: z.string().min(1),
  notes: z.string().optional(),
  amount: z.string().min(1),
  paidByUserId: z.string().min(1),
  splitMode: z.enum(['equal', 'fixed', 'percentage']),
  participantUserIds: z.array(z.string().min(1)).min(1),
  fixedShares: z.record(z.string(), z.string()).optional(),
  percentageShares: z.record(z.string(), z.string()).optional(),
  occurredOn: z.string().optional(),
})

const createSettlementSchema = z.object({
  groupId: z.string().min(1),
  fromUserId: z.string().min(1),
  toUserId: z.string().min(1),
  amount: z.string().min(1),
  note: z.string().optional(),
  occurredOn: z.string().optional(),
})

export const getGroupsDashboard = createServerFn({ method: 'GET' })
  .middleware([requireAuthenticatedSessionMiddleware])
  .handler(async ({ context }) => {
    const user = await requireCurrentUser(requireSessionGitHubUserId(context.auth.session.githubUserId))
    return getDashboardForUser(user)
  })

export const createGroup = createServerFn({ method: 'POST' })
  .middleware([requireAuthenticatedSessionMiddleware])
  .inputValidator(createGroupSchema)
  .handler(async ({ context, data }) => {
    const user = await requireCurrentUser(requireSessionGitHubUserId(context.auth.session.githubUserId))
    return createGroupForUser(user, data)
  })

export const renameGroup = createServerFn({ method: 'POST' })
  .middleware([requireAuthenticatedSessionMiddleware])
  .inputValidator(renameGroupSchema)
  .handler(async ({ context, data }) => {
    const user = await requireCurrentUser(requireSessionGitHubUserId(context.auth.session.githubUserId))
    return renameGroupForOwner(user.id, data)
  })

export const getGroupBySlug = createServerFn({ method: 'GET' })
  .middleware([requireAuthenticatedSessionMiddleware])
  .inputValidator(groupSlugSchema)
  .handler(async ({ context, data }) => {
    const user = await requireCurrentUser(requireSessionGitHubUserId(context.auth.session.githubUserId))
    const access = await findGroupAccessBySlug(data.slug, user.id)

    if (!access) {
      return null
    }

    if (!access.hasAccess) {
      return {
        kind: 'forbidden' as const,
        currentSlug: access.currentSlug,
        redirectedFromSlug: access.redirectedFromSlug,
      }
    }

    const detail = await getGroupDetailForUser(access.groupId, user.id)

    return {
      kind: 'group' as const,
      currentSlug: access.currentSlug,
      redirectedFromSlug: access.redirectedFromSlug,
      group: detail,
    }
  })

export const createGroupInvite = createServerFn({ method: 'POST' })
  .middleware([requireAuthenticatedSessionMiddleware])
  .inputValidator(createInviteSchema)
  .handler(async ({ context, data }) => {
    const user = await requireCurrentUser(requireSessionGitHubUserId(context.auth.session.githubUserId))
    return createInviteForOwner(user.id, data)
  })

export const getInvitePreview = createServerFn({ method: 'GET' })
  .middleware([requireAuthenticatedSessionMiddleware])
  .inputValidator(inviteTokenSchema)
  .handler(async ({ context, data }) => {
    const user = await requireCurrentUser(requireSessionGitHubUserId(context.auth.session.githubUserId))
    return getInviteForUser(data.token, user.id)
  })

export const joinGroupInvite = createServerFn({ method: 'POST' })
  .middleware([requireAuthenticatedSessionMiddleware])
  .inputValidator(inviteTokenSchema)
  .handler(async ({ context, data }) => {
    const user = await requireCurrentUser(requireSessionGitHubUserId(context.auth.session.githubUserId))
    return joinGroupViaInvite(user, data)
  })

export const createExpense = createServerFn({ method: 'POST' })
  .middleware([requireAuthenticatedSessionMiddleware])
  .inputValidator(createExpenseSchema)
  .handler(async ({ context, data }) => {
    const user = await requireCurrentUser(requireSessionGitHubUserId(context.auth.session.githubUserId))
    await createExpenseForUser(user.id, data)
    return { ok: true }
  })

export const createSettlement = createServerFn({ method: 'POST' })
  .middleware([requireAuthenticatedSessionMiddleware])
  .inputValidator(createSettlementSchema)
  .handler(async ({ context, data }) => {
    const user = await requireCurrentUser(requireSessionGitHubUserId(context.auth.session.githubUserId))
    await createSettlementForUser(user.id, data)
    return { ok: true }
  })

export const getGroupMembers = createServerFn({ method: 'GET' })
  .middleware([requireAuthenticatedSessionMiddleware])
  .inputValidator(groupIdSchema)
  .handler(async ({ context, data }) => {
    const user = await requireCurrentUser(requireSessionGitHubUserId(context.auth.session.githubUserId))
    const result = await getGroupDetailForUser(data.groupId, user.id)
    return result.members
  })
