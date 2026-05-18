import { createFileRoute } from '@tanstack/react-router'
import { ArrowRightIcon, ShieldCheckIcon } from 'lucide-react'

import { ImmersiveShell } from '@/components/immersive-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/_authenticated/groups')({
  component: GroupsPlaceholder,
})

function GroupsPlaceholder() {
  const { auth } = Route.useRouteContext()

  return (
    <ImmersiveShell contentClassName="items-center py-10 sm:py-12">
      <div className="grid w-full max-w-5xl gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-border/70 bg-card/70">
          <CardHeader>
            <Badge variant="accent" className="w-fit">
              Auth slice complete
            </Badge>
            <CardTitle>Signed in as {auth.session.userLogin}</CardTitle>
            <CardDescription>
              GitHub identity, cookie session middleware, and protected group routing are wired. The next slice will replace this placeholder with real group onboarding and slug-aware navigation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div className="rounded-[1.2rem] border border-border/60 bg-white/55 p-4">
              Session display name: <span className="font-medium text-foreground">{auth.session.displayName}</span>
            </div>
            <div className="rounded-[1.2rem] border border-border/60 bg-white/55 p-4">
              Protected UI now routes through `/_authenticated` and sends unauthenticated visitors through the GitHub OAuth flow.
            </div>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" render={<a href="/logout" />}>
                Sign out
              </Button>
              <Button size="lg" variant="outline" render={<a href="/" />}>
                Back to homepage
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/60">
          <CardHeader>
            <div className="mb-2 flex size-11 items-center justify-center rounded-[1rem] bg-primary/18 text-primary">
              <ShieldCheckIcon className="size-5" />
            </div>
            <CardTitle>What’s next</CardTitle>
            <CardDescription>
              The next commit will land the Turso and Drizzle schema so this identity layer can attach to persisted users, groups, and invites.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
            <div className="rounded-[1.1rem] border border-border/60 bg-white/55 px-4 py-3">
              Add local user persistence after successful OAuth callback.
            </div>
            <div className="rounded-[1.1rem] border border-border/60 bg-white/55 px-4 py-3">
              Create owner/member group tables and slug history tables.
            </div>
            <div className="rounded-[1.1rem] border border-border/60 bg-white/55 px-4 py-3">
              Replace `/groups` with onboarding and eventually `/groups/:groupSlug`.
            </div>
            <Button variant="ghost" render={<a href="https://github.com/settings/apps" target="_blank" rel="noreferrer" />}>
              Manage GitHub apps
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </ImmersiveShell>
  )
}
