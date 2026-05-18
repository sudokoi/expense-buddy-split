import { eq } from 'drizzle-orm'

import { getDb } from '@/db/client'
import { createId } from '@/db/ids'
import { users } from '@/db/schema'

interface UpsertGitHubUserInput {
  githubUserId: number
  userLogin: string
  displayName: string
  avatarUrl: string | null
}

export async function upsertGitHubUser(input: UpsertGitHubUserInput) {
  const db = getDb()
  const existingUser = await db.query.users.findFirst({
    where: eq(users.githubUserId, input.githubUserId),
  })

  const now = new Date()

  if (existingUser) {
    await db
      .update(users)
      .set({
        userLogin: input.userLogin,
        displayName: input.displayName,
        avatarUrl: input.avatarUrl,
        updatedAt: now,
      })
      .where(eq(users.id, existingUser.id))

    return {
      ...existingUser,
      userLogin: input.userLogin,
      displayName: input.displayName,
      avatarUrl: input.avatarUrl,
      updatedAt: now,
    }
  }

  const newUser = {
    id: createId(),
    githubUserId: input.githubUserId,
    userLogin: input.userLogin,
    displayName: input.displayName,
    avatarUrl: input.avatarUrl,
    createdAt: now,
    updatedAt: now,
  }

  await db.insert(users).values(newUser)

  return newUser
}
