import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'

import { dbEnv } from '@/lib/env.server'

import { schema } from './schema'

let database: ReturnType<typeof drizzle<typeof schema>> | null = null

export function getDb() {
  if (database) {
    return database
  }

  const client = createClient({
    url: dbEnv.tursoDatabaseUrl(),
    authToken: dbEnv.tursoAuthToken(),
  })

  database = drizzle(client, { schema })
  return database
}
