import {
  ArrowRightIcon,
  CoinsIcon,
  HandCoinsIcon,
  ShieldCheckIcon,
  UsersIcon,
} from 'lucide-react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import { HomeScene } from '@/components/home/home-scene'
import { ImmersiveShell } from '@/components/immersive-shell'
import { getAuthErrorMessage } from '@/features/auth/errors'
import { optionalSessionQueryOptions } from '@/features/auth/session-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/')({
  validateSearch: (search) => ({
    authError: typeof search.authError === 'string' ? search.authError : undefined,
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(optionalSessionQueryOptions())
  },
  component: Home,
})

const features = [
  {
    title: 'Flexible split modes',
    description: 'Start with equal-feeling workflows that still honor exact percentage and fixed-amount validations.',
    icon: CoinsIcon,
  },
  {
    title: 'Invite-by-link groups',
    description: 'Create shareable group links, gate access with GitHub identity, and keep membership scoped to the group.',
    icon: UsersIcon,
  },
  {
    title: 'Ledger-first balances',
    description: 'Balances are derived from expenses and settle-ups, so they stay explainable instead of drifting over time.',
    icon: HandCoinsIcon,
  },
] as const

function Home() {
  const { authError } = Route.useSearch()
  const authErrorMessage = getAuthErrorMessage(authError)
  const { data: session } = useSuspenseQuery(optionalSessionQueryOptions())

  return (
    <ImmersiveShell scene={<HomeScene />} contentClassName="max-w-6xl items-center py-10 sm:py-12">
      <div className="flex w-full flex-col gap-8">
        <section className="home-hero-section relative grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-6">
            <Badge variant="outline" className="border-border/80 bg-white/70 text-foreground shadow-sm">
              TanStack Start, Query, DB, and Turso
            </Badge>

            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                Shared expense groups without the usual spreadsheet cleanup.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                Expense Buddy Split is the web companion for group spending: percentage splits, fixed-amount splits, settle-up entries, and shareable group slugs that stay human-readable.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {session ? (
                <>
                  <Button size="lg" render={<a href="/groups" />}>
                    Open groups
                    <ArrowRightIcon data-icon="inline-end" />
                  </Button>
                  <Button size="lg" variant="outline" render={<a href="/logout" />}>
                    Sign out
                  </Button>
                </>
              ) : (
                <>
                  <Button size="lg" render={<a href="/connect?redirectTo=%2Fgroups" />}>
                    Continue with GitHub
                    <ArrowRightIcon data-icon="inline-end" />
                  </Button>
                  <Button size="lg" variant="outline" render={<a href="#v1-scope" />}>
                    Explore v1 scope
                  </Button>
                </>
              )}
            </div>

            <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
              <div className="rounded-[1.4rem] border border-border/70 bg-white/55 px-4 py-3 backdrop-blur-sm">
                GitHub sign-in for identity
              </div>
              <div className="rounded-[1.4rem] border border-border/70 bg-white/55 px-4 py-3 backdrop-blur-sm">
                Group-level INR to start
              </div>
              <div className="rounded-[1.4rem] border border-border/70 bg-white/55 px-4 py-3 backdrop-blur-sm">
                Owner-managed editable slugs
              </div>
            </div>

            {session ? (
              <p className="text-sm text-muted-foreground">
                Signed in as <span className="font-medium text-foreground">{session.userLogin}</span>.
              </p>
            ) : null}
          </div>

          <Card className="immersive-overlay-card relative border-white/35 bg-white/55 lg:ml-auto lg:max-w-xl">
            <CardHeader>
              <Badge variant="accent" className="w-fit">
                Thoughtful guardrails
              </Badge>
              <CardTitle>Built for multi-user groups, not just personal tracking.</CardTitle>
              <CardDescription>
                The app starts with the validations people actually trip over: split totals must match, group members must be unique participants, and historical slug links should keep working.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="rounded-[1.2rem] border border-border/70 bg-background/70 p-4">
                <div className="flex items-center gap-2 font-medium">
                  <CoinsIcon className="size-4 text-primary" />
                  Exact money math
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Amounts are stored in integer minor units so percentage and fixed splits can validate without floating-point surprises.
                </p>
              </div>
              <div className="rounded-[1.2rem] border border-border/70 bg-background/70 p-4">
                <div className="flex items-center gap-2 font-medium">
                  <ShieldCheckIcon className="size-4 text-primary" />
                  Stable group links
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Group URLs use readable slugs, while old slugs redirect through history instead of breaking shared links.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {authErrorMessage ? (
          <Card className="border-destructive/30 bg-destructive/5 shadow-sm">
            <CardHeader>
              <CardTitle>GitHub sign-in could not be completed</CardTitle>
              <CardDescription>{authErrorMessage}</CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        <section id="how-it-works" className="grid gap-4 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon

            return (
              <Card key={feature.title} className="relative border-border/70 bg-card/65">
                <CardHeader>
                  <div className="mb-2 flex size-11 items-center justify-center rounded-[1rem] bg-primary/18 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            )
          })}
        </section>

        <section id="v1-scope" className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-border/70 bg-card/60">
            <CardHeader>
              <CardTitle>What the first version is optimizing for</CardTitle>
              <CardDescription>
                Ship the multi-user core first, then layer in refinements once the data model and balance math are locked.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
              <div className="rounded-[1.2rem] border border-border/60 bg-white/55 p-4">
                GitHub identity, reusable invite links, and direct group routing via shareable slugs.
              </div>
              <div className="rounded-[1.2rem] border border-border/60 bg-white/55 p-4">
                Percentage splits, fixed-amount splits, and settle-up entries in one ledger model.
              </div>
              <div className="rounded-[1.2rem] border border-border/60 bg-white/55 p-4">
                Owner-only slug edits with redirectable slug history so older links remain valid.
              </div>
              <div className="rounded-[1.2rem] border border-border/60 bg-white/55 p-4">
                Group balances derived from events instead of mutable cached totals.
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/70">
            <CardHeader>
              <Badge variant="secondary" className="w-fit">
                Next build slices
              </Badge>
              <CardTitle>What comes right after this foundation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
              <div className="flex items-start gap-3 rounded-[1.1rem] border border-border/60 bg-white/55 px-4 py-3">
                <UsersIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                GitHub OAuth identity and session-aware routing.
              </div>
              <div className="flex items-start gap-3 rounded-[1.1rem] border border-border/60 bg-white/55 px-4 py-3">
                <CoinsIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                Turso-backed schema, migrations, and group onboarding.
              </div>
              <div className="flex items-start gap-3 rounded-[1.1rem] border border-border/60 bg-white/55 px-4 py-3">
                <HandCoinsIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                Expense entry, settlements, and TanStack DB live balance views.
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </ImmersiveShell>
  )
}
