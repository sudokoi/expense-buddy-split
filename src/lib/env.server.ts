const requiredEnvKeys = [
  'SESSION_PASSWORD',
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
] as const

type RequiredEnvKey = (typeof requiredEnvKeys)[number]

function readRequiredEnv(name: RequiredEnvKey): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

function readOptionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value ? value : undefined
}

function readRequiredDbEnv(name: 'TURSO_DATABASE_URL'): string {
  const value = readOptionalEnv(name)
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

export const env = {
  appOrigin: process.env.APP_ORIGIN?.trim() || 'http://localhost:3000',
  sessionPassword: readRequiredEnv('SESSION_PASSWORD'),
  githubClientId: readRequiredEnv('GITHUB_CLIENT_ID'),
  githubClientSecret: readRequiredEnv('GITHUB_CLIENT_SECRET'),
} as const

export const dbEnv = {
  tursoDatabaseUrl: () => readRequiredDbEnv('TURSO_DATABASE_URL'),
  tursoAuthToken: () => readOptionalEnv('TURSO_AUTH_TOKEN'),
} as const
