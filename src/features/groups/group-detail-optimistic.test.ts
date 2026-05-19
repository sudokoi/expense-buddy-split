import { describe, expect, test } from 'vitest'

import {
  applyOptimisticExpenseCreate,
  applyOptimisticExpenseDelete,
  applyOptimisticExpenseUpdate,
} from '@/features/groups/group-detail-optimistic'
import type { GroupDetail } from '@/features/groups/group-repository'

function createEmptyGroupDetail(): GroupDetail {
  return {
    id: 'group-1',
    name: 'Weekend Trip',
    slug: 'weekend-trip',
    currencyCode: 'INR',
    role: 'owner',
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
    invites: [],
    ledgerEntries: [],
    balances: [
      {
        userId: 'user-1',
        displayName: 'Alice',
        userLogin: 'alice',
        avatarUrl: null,
        balanceMinor: 0,
      },
      {
        userId: 'user-2',
        displayName: 'Bob',
        userLogin: 'bob',
        avatarUrl: null,
        balanceMinor: 0,
      },
    ],
  }
}

describe('group detail optimistic updates', () => {
  test('optimistically creates and removes an expense from the ledger cache', () => {
    const created = applyOptimisticExpenseCreate(
      createEmptyGroupDetail(),
      'user-1',
      {
        title: 'Dinner',
        notes: 'Beach shack',
        amount: '30',
        paidByUserId: 'user-1',
        splitMode: 'fixed',
        participantUserIds: ['user-1', 'user-2'],
        fixedShares: {
          'user-1': '15',
          'user-2': '15',
        },
      },
    )

    expect(created.ledgerEntries).toHaveLength(1)
    expect(created.ledgerEntries[0]).toMatchObject({
      type: 'expense',
      title: 'Dinner',
      subtitle: 'Paid by Alice',
      amountMinor: 3000,
    })
    expect(created.balances).toEqual([
      expect.objectContaining({ userId: 'user-1', balanceMinor: 1500 }),
      expect.objectContaining({ userId: 'user-2', balanceMinor: -1500 }),
    ])

    if (created.ledgerEntries[0]?.type !== 'expense') {
      throw new Error('Expected an optimistic expense entry.')
    }

    const removed = applyOptimisticExpenseDelete(
      created,
      'user-1',
      created.ledgerEntries[0].id,
    )

    expect(removed.ledgerEntries).toHaveLength(0)
    expect(removed.balances).toEqual([
      expect.objectContaining({ userId: 'user-1', balanceMinor: 0 }),
      expect.objectContaining({ userId: 'user-2', balanceMinor: 0 }),
    ])
  })

  test('optimistically updates an expense and recalculates balances', () => {
    const created = applyOptimisticExpenseCreate(
      createEmptyGroupDetail(),
      'user-1',
      {
        title: 'Taxi',
        amount: '12',
        paidByUserId: 'user-1',
        splitMode: 'fixed',
        participantUserIds: ['user-1', 'user-2'],
        fixedShares: {
          'user-1': '6',
          'user-2': '6',
        },
      },
    )

    if (created.ledgerEntries[0]?.type !== 'expense') {
      throw new Error('Expected an optimistic expense entry.')
    }

    const updated = applyOptimisticExpenseUpdate(created, 'user-1', {
      expenseId: created.ledgerEntries[0].id,
      title: 'Cab ride',
      amount: '18',
      paidByUserId: 'user-2',
      splitMode: 'fixed',
      participantUserIds: ['user-1', 'user-2'],
      fixedShares: {
        'user-1': '9',
        'user-2': '9',
      },
    })

    expect(updated.ledgerEntries).toHaveLength(1)
    expect(updated.ledgerEntries[0]).toMatchObject({
      type: 'expense',
      title: 'Cab ride',
      subtitle: 'Paid by Bob',
      amountMinor: 1800,
    })
    expect(updated.balances).toEqual([
      expect.objectContaining({ userId: 'user-2', balanceMinor: 900 }),
      expect.objectContaining({ userId: 'user-1', balanceMinor: -900 }),
    ])
  })
})
