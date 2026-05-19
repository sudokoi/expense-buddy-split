import { ArrowRightIcon } from 'lucide-react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'

import { HomeScene } from '@/components/home/home-scene'
import { ImmersiveShell } from '@/components/immersive-shell'
import { getAuthErrorMessage } from '@/features/auth/errors'
import { optionalSessionQueryOptions } from '@/features/auth/session-query'
import { sanitizeRedirectTo } from '@/lib/redirect'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export const Route = createFileRoute('/')({
  validateSearch: (search) => ({
    authError:
      typeof search.authError === 'string' ? search.authError : undefined,
    redirectTo:
      typeof search.redirectTo === 'string'
        ? sanitizeRedirectTo(search.redirectTo)
        : undefined,
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(optionalSessionQueryOptions())
  },
  component: Home,
})

function Home() {
  const { authError, redirectTo } = Route.useSearch()
  const nextDestination = redirectTo ?? '/groups'
  const authErrorMessage = getAuthErrorMessage(authError)
  const { data: session } = useSuspenseQuery(optionalSessionQueryOptions())

  return (
    <ImmersiveShell
      scene={<HomeScene />}
      navigation={null}
      contentClassName="max-w-5xl items-center py-12 sm:py-16"
    >
      <div className="flex w-full flex-col gap-8">
        <section className="home-hero-section relative flex min-h-[70vh] items-center justify-center">
          <Card className="immersive-overlay-card mx-auto w-full max-w-3xl border-white/35 bg-white/60 text-center shadow-[0_24px_90px_rgba(74,68,88,0.12)]">
            <CardHeader className="items-center px-6 pt-8 text-center sm:px-10 sm:pt-10">
              <CardTitle className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                Split group expenses without chasing people in spreadsheets.
              </CardTitle>
              <CardDescription className="max-w-xl text-base leading-7 sm:text-lg">
                Create a group, add expenses, record settle-ups, and keep the
                balance clear for everyone involved.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4 px-6 pb-8 sm:px-10 sm:pb-10">
              {session ? (
                <>
                  <Button size="lg" render={<Link to={nextDestination} />}>
                    Open your groups
                    <ArrowRightIcon data-icon="inline-end" />
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    Signed in as{' '}
                    <span className="font-medium text-foreground">
                      {session.userLogin}
                    </span>
                    .
                  </p>
                </>
              ) : (
                <Button
                  size="lg"
                  render={
                    <Link
                      to="/connect"
                      search={{ redirectTo: nextDestination }}
                      preload={false}
                    />
                  }
                >
                  Continue with GitHub
                  <ArrowRightIcon data-icon="inline-end" />
                </Button>
              )}
            </CardContent>
          </Card>
        </section>

        {authErrorMessage ? (
          <Card className="mx-auto w-full max-w-3xl border-destructive/30 bg-destructive/5 shadow-sm">
            <CardHeader>
              <CardTitle>GitHub sign-in could not be completed</CardTitle>
              <CardDescription>{authErrorMessage}</CardDescription>
            </CardHeader>
          </Card>
        ) : null}
      </div>
    </ImmersiveShell>
  )
}
