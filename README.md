# Expense Buddy Split

Expense Buddy Split is a TanStack Start web app for shared expense groups.

The app is being built around a few core ideas:

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
pnpm lint
pnpm typecheck
pnpm test
pnpm format
pnpm format:check
```

## Current Build Status

The first slice sets up:

- TanStack Start app scaffolding
- shared pastel design system
- query-aware router foundation
- public marketing-style homepage

Next slices will add:

- GitHub OAuth and session middleware
- Drizzle + Turso schema and migrations
- groups, invites, expenses, settlements, and balances

## Deployment

This app currently uses Nitro as the deployment adapter.

```bash
pnpm build
node dist/server/index.mjs
```

For host-specific presets and deployment notes, see https://v3.nitro.build/deploy.
