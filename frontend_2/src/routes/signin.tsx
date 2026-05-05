import { Link, createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import type { FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { queryClient } from '@/lib/query/client'
import { qk } from '@/lib/query/keys'

import { getPostSignInRedirectPath, isUnauthorizedMeError, readAuthenticatedProfile, readSignInRedirectPath, useSignInMutation } from '@/features/auth/hooks'
import { clearAccessToken } from '@/features/auth/store'

export const Route = createFileRoute('/signin')({
  beforeLoad: async () => {
    const redirectPath = await readSignInRedirectPath(queryClient)

    if (redirectPath) {
      throw redirect({ to: redirectPath })
    }
  },
  component: SignInRoute,
})

function SignInRoute() {
  const navigate = useNavigate()
  const signInMutation = useSignInMutation()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const isSubmitting = signInMutation.isPending

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)

    try {
      const response = await signInMutation.mutateAsync({
        password,
        username: username.trim(),
      })

      const profile = await readAuthenticatedProfile(queryClient)
      queryClient.setQueryData(qk.auth.me(), profile)

      await navigate({
        replace: true,
        to: getPostSignInRedirectPath(response.role),
      })
    } catch (error) {
      if (isUnauthorizedMeError(error)) {
        clearAccessToken()
        queryClient.removeQueries({ queryKey: qk.auth.me() })
      }
      setErrorMessage(error instanceof Error ? error.message : 'Sign-in failed')
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-md px-4 py-12">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Use your account to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          {errorMessage ? (
            <p className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert" aria-live="polite">
              {errorMessage}
            </p>
          ) : null}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <label htmlFor="signin-username" className="text-sm font-medium text-[var(--sea-ink)]">
                Username
              </label>
              <Input
                id="signin-username"
                name="username"
                autoComplete="username"
                required
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                aria-describedby="signin-username-hint"
              />
              <p id="signin-username-hint" className="text-xs text-[var(--sea-ink-soft)]">
                Enter your account username.
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="signin-password" className="text-sm font-medium text-[var(--sea-ink)]">
                Password
              </label>
              <Input
                id="signin-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-describedby="signin-password-hint"
              />
              <p id="signin-password-hint" className="text-xs text-[var(--sea-ink-soft)]">
                Password must be at least 6 characters.
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-[var(--sea-ink-soft)]">
            New account?{' '}
            <Link to="/signup" className="font-medium text-[var(--lagoon-deep)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>
    </section>
  )
}
