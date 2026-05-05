import { createFileRoute, redirect } from '@tanstack/react-router'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { UserProfile } from '@/features/auth/api'
import { getMeQueryOptions } from '@/features/auth/hooks'
import {
  clearAccessToken,
  getAccessToken,
  getAdminGuardRedirect,
  getAuthGuardRedirect,
} from '@/features/auth/store'
import { queryClient } from '@/lib/query/client'
import { qk } from '@/lib/query/keys'

export const Route = createFileRoute('/admin')({
  beforeLoad: async () => {
    const authRedirect = getAuthGuardRedirect(getAccessToken())

    if (authRedirect) {
      throw redirect({ to: authRedirect })
    }

    let profile: UserProfile
    try {
      profile = await queryClient.fetchQuery(getMeQueryOptions())
    } catch {
      clearAccessToken()
      queryClient.removeQueries({ queryKey: qk.auth.me() })
      throw redirect({ to: '/signin' })
    }

    const adminRedirect = getAdminGuardRedirect(profile.role)
    if (adminRedirect) {
      throw redirect({ to: adminRedirect })
    }
  },
  component: AdminRoute,
})

function AdminRoute() {
  return (
    <main className="page-wrap px-4 py-10">
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>Admin dashboard</CardTitle>
          <CardDescription>Admin tools are migrating in the next slice.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
            Access guard is active: only authenticated admins can open this page.
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
