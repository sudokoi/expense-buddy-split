import { defineConfig } from 'drizzle-kit'

const databaseUrl = process.env.TURSO_DATABASE_URL?.trim()

if (!databaseUrl) {
  throw new Error('Missing required environment variable: TURSO_DATABASE_URL')
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'turso',
  dbCredentials: {
    url: databaseUrl,
    authToken: process.env.TURSO_AUTH_TOKEN?.trim(),
  },
  verbose: true,
  strict: true,
})
