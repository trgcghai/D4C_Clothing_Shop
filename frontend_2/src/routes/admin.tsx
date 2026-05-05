import { createFileRoute, redirect } from '@tanstack/react-router'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { UserProfile } from '@/features/auth/api'
import { isUnauthorizedMeError, readAuthenticatedProfile, useMeQuery } from '@/features/auth/hooks'
import {
  clearAccessToken,
  getAccessToken,
  getAdminGuardRedirect,
} from '@/features/auth/store'
import { queryClient } from '@/lib/query/client'
import { qk } from '@/lib/query/keys'

export const Route = createFileRoute('/admin')({
  beforeLoad: async () => {
    if (typeof window === 'undefined') {
      return
    }

    if (!getAccessToken()) {
      throw redirect({ to: '/signin' })
    }

    let profile: UserProfile | undefined
    try {
      profile = await readAuthenticatedProfile(queryClient)
    } catch (error) {
      if (isUnauthorizedMeError(error)) {
        clearAccessToken()
        queryClient.removeQueries({ queryKey: qk.auth.me() })
        throw redirect({ to: '/signin' })
      }
    }

    if (profile) {
      const adminRedirect = getAdminGuardRedirect(profile.role)
      if (adminRedirect) {
        throw redirect({ to: adminRedirect })
      }
    }
  },
  component: AdminRoute,
})

function AdminRoute() {
  const meQuery = useMeQuery()

  if (meQuery.isPending) {
    return <div className="py-10 text-center text-[var(--sea-ink-soft)]">Loading admin access...</div>
  }

  return (
    <main className="page-wrap px-4 py-10">
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>Admin dashboard</CardTitle>
          <CardDescription>Admin tools are migrating in the next slice.</CardDescription>
        </CardHeader>
        <CardContent>
          {meQuery.isError ? (
            <p className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800" role="alert" aria-live="polite">
              {meQuery.error instanceof Error ? meQuery.error.message : 'Unable to verify admin access right now.'}
            </p>
          ) : null}
          <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
            Access guard is active: only authenticated admins can open this page.
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
