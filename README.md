# BalanceBuddy

BalanceBuddy is a TanStack Start web app for shared expense groups.

This repository is open source under the GNU Affero General Public License v3.0 only (`AGPL-3.0-only`). See `LICENSE`.

The app is built around a few core ideas:

- GitHub sign-in for identity
- group-based expense sharing
- percentage and fixed-amount splits
- settle-up entries in the same ledger model
- readable group slugs with redirectable slug history
- Turso/libSQL persistence for Vercel deployment

## Tech Stack

- TanStack Start
- TanStack Router
- TanStack Query
- React 19
- TypeScript
- Tailwind CSS v4
- shadcn/ui with Base UI primitives
- Nitro deployment adapter

## Local Development

Install dependencies:

```bash
pnpm install
```

Start the app:

```bash
pnpm dev
```

## Scripts

```bash
pnpm dev
pnpm build
pnpm preview
pnpm db:generate
pnpm db:push
pnpm lint
pnpm typecheck
pnpm test
pnpm format
pnpm format:check
```

## Current Build Status

BalanceBuddy currently includes:

- GitHub OAuth sign-in with cookie-backed sessions
- homepage-first auth flow that preserves the intended destination
- groups dashboard with first-group empty state
- group creation with slug-based URLs
- redirectable slug history for renamed groups
- reusable invite links with authenticated join flow
- expenses, settlements, and derived balance summaries
- Turso/libSQL persistence through Drizzle
- mirrored app assets and manifest branding

Core routes:

- `/`
- `/groups`
- `/groups/:groupSlug`
- `/join/:token`
- `/auth/github/callback`

Verification:

- `pnpm typecheck`
- `pnpm test`
- `pnpm lint`
- `pnpm build`

## Environment Variables

Copy `.env.example` and provide real values:

```bash
cp .env.example .env
```

Required variables:

- `SESSION_PASSWORD`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`

Optional variables:

- `APP_ORIGIN`

Notes:

- Local development defaults to `http://localhost:3000` when `APP_ORIGIN` is unset.
- Production should set `APP_ORIGIN=https://balancebuddy.sudh.online`.

## Deployment

This app currently uses Nitro as the deployment adapter.

For remote Turso deployments, the app uses the HTTP libSQL client path instead of the native sqlite transport. That keeps Vercel/Linux deployments from depending on the macOS-native `libsql` binary traced during local builds.

This repository deploys automatically on Vercel when changes are pushed to GitHub. Ensure the Vercel project is configured with the same environment variables listed above, especially:

- `APP_ORIGIN=https://balancebuddy.sudh.online`
- `SESSION_PASSWORD`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`

```bash
pnpm build
node .output/server/index.mjs
```

For host-specific presets and deployment notes, see https://v3.nitro.build/deploy.

## License

This project is licensed under the GNU Affero General Public License v3.0 only (`AGPL-3.0-only`).
