import { describe, expect, test } from 'vitest'

import {
  buildLedgerSnapshot,
  createGroupRecords,
  evaluateInviteState,
} from '@/features/groups/group-domain'
import {
  buildPercentageShares,
  buildSuggestedGroupSlug,
  distributeEqualShares,
  normalizeGroupSlug,
} from '@/features/groups/group-shared'

describe('group domain', () => {
  test('createGroupRecords creates owner membership for the creator', () => {
    const now = new Date('2026-05-18T10:00:00.000Z')
    let sequence = 0
    const createId = () => `id-${++sequence}`

    const result = createGroupRecords({
      userId: 'user-1',
      name: 'Weekend Trip',
      slug: 'weekend-trip',
      now,
      createId,
    })

    expect(result.group).toMatchObject({
      id: 'id-1',
      name: 'Weekend Trip',
      slug: 'weekend-trip',
      currencyCode: 'INR',
      createdByUserId: 'user-1',
    })
    expect(result.membership).toMatchObject({
      id: 'id-2',
      groupId: 'id-1',
      userId: 'user-1',
      role: 'owner',
      joinedAt: now,
    })
  })

  test('evaluateInviteState blocks revoked and expired invites', () => {
    const now = new Date('2026-05-18T10:00:00.000Z')

    const activeInvite = evaluateInviteState({
      expiresAt: new Date('2026-05-20T10:00:00.000Z'),
      maxUses: null,
      usedCount: 0,
      revokedAt: null,
      alreadyMember: false,
      now,
    })

    const expiredInvite = evaluateInviteState({
      expiresAt: new Date('2026-05-17T10:00:00.000Z'),
      maxUses: null,
      usedCount: 0,
      revokedAt: null,
      alreadyMember: false,
      now,
    })

    const revokedInvite = evaluateInviteState({
      expiresAt: new Date('2026-05-20T10:00:00.000Z'),
      maxUses: 5,
      usedCount: 1,
      revokedAt: now,
      alreadyMember: false,
      now,
    })

    expect(activeInvite.canJoin).toBe(true)
    expect(expiredInvite.isExpired).toBe(true)
    expect(expiredInvite.canJoin).toBe(false)
    expect(revokedInvite.isRevoked).toBe(true)
    expect(revokedInvite.canJoin).toBe(false)
  })

  test('buildLedgerSnapshot derives balances and marks owner-manageable entries', () => {
    const snapshot = buildLedgerSnapshot({
      viewerUserId: 'user-1',
      members: [
        {
          userId: 'user-1',
          userLogin: 'alice',
          displayName: 'Alice',
          avatarUrl: null,
          role: 'owner',
        },
        {
          userId: 'user-2',
          userLogin: 'bob',
          displayName: 'Bob',
          avatarUrl: null,
          role: 'member',
        },
      ],
      expenses: [
        {
          id: 'expense-1',
          title: 'Dinner',
          notes: null,
          amountMinor: 3000,
          currencyCode: 'INR',
          paidByUserId: 'user-1',
          splitMode: 'equal',
          occurredAt: new Date('2026-05-18T10:00:00.000Z'),
          createdByUserId: 'user-1',
          participants: [
            {
              userId: 'user-1',
              amountMinor: 1500,
              percentageBasisPoints: null,
            },
            {
              userId: 'user-2',
              amountMinor: 1500,
              percentageBasisPoints: null,
            },
          ],
        },
      ],
      settlements: [
        {
          id: 'settlement-1',
          amountMinor: 500,
          currencyCode: 'INR',
          fromUserId: 'user-2',
          toUserId: 'user-1',
          note: 'Paid back',
          occurredAt: new Date('2026-05-19T10:00:00.000Z'),
          createdByUserId: 'user-2',
        },
      ],
    })

    expect(snapshot.ledgerEntries).toHaveLength(2)
    expect(snapshot.ledgerEntries[0]).toMatchObject({
      type: 'settlement',
      canManage: true,
    })
    expect(snapshot.balances).toEqual([
      expect.objectContaining({ userId: 'user-1', balanceMinor: 1000 }),
      expect.objectContaining({ userId: 'user-2', balanceMinor: -1000 }),
    ])
  })
})

describe('group shared helpers', () => {
  test('normalizeGroupSlug normalizes mixed input', () => {
    expect(normalizeGroupSlug('  Goa Trip 2026  ')).toBe('goa-trip-2026')
  })

  test('buildSuggestedGroupSlug derives a usable slug from short names and adds numeric suffixes', () => {
    expect(buildSuggestedGroupSlug('AI')).toBe('ai-group')
    expect(buildSuggestedGroupSlug('Goa Trip 2026', 2)).toBe('goa-trip-2026-2')
  })

  test('distributeEqualShares spreads remainder across first participants', () => {
    expect(distributeEqualShares(1000, ['a', 'b', 'c'])).toEqual([
      { userId: 'a', amountMinor: 334, percentageBasisPoints: null },
      { userId: 'b', amountMinor: 333, percentageBasisPoints: null },
      { userId: 'c', amountMinor: 333, percentageBasisPoints: null },
    ])
  })

  test('buildPercentageShares allocates the rounding remainder to the last participant', () => {
    expect(
      buildPercentageShares(1000, {
        a: '33.33',
        b: '33.33',
        c: '33.34',
      }),
    ).toEqual([
      { userId: 'a', amountMinor: 333, percentageBasisPoints: 3333 },
      { userId: 'b', amountMinor: 333, percentageBasisPoints: 3333 },
      { userId: 'c', amountMinor: 334, percentageBasisPoints: 3334 },
    ])
  })
})
