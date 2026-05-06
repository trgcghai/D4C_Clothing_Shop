import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent, ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

import { readSignInRedirectPath, useSignUpMutation } from '@/features/auth/hooks'
import { getAccessToken } from '@/features/auth/store'
import { queryClient } from '@/lib/query/client'

const defaultForm = {
  confirmPassword: '',
  email: '',
  fullName: '',
  password: '',
  phoneNumber: '',
  username: '',
}

export const Route = createFileRoute('/signup')({
  component: SignUpRoute,
})

function SignUpRoute() {
  const navigate = useNavigate()
  const signUpMutation = useSignUpMutation()

  const [form, setForm] = useState(defaultForm)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    if (getAccessToken()) {
      readSignInRedirectPath(queryClient).then((redirectPath) => {
        if (redirectPath) {
          navigate({ replace: true, to: redirectPath })
        }
      })
    }
  }, [navigate])

  function onChange(field: keyof typeof defaultForm) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      setForm((current) => ({
        ...current,
        [field]: event.target.value,
      }))
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    if (form.password !== form.confirmPassword) {
      setErrorMessage('Password confirmation does not match')
      return
    }

    try {
      await signUpMutation.mutateAsync({
        email: form.email.trim(),
        fullName: form.fullName.trim(),
        password: form.password,
        phoneNumber: form.phoneNumber.trim(),
        username: form.username.trim(),
      })

      setSuccessMessage('Account created successfully. Redirecting to sign in...')
      setForm(defaultForm)
      await navigate({ replace: true, to: '/signin' })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Sign-up failed')
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-lg px-4 py-12">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Sign up</CardTitle>
          <CardDescription>Create account to manage orders and profile.</CardDescription>
        </CardHeader>
        <CardContent>
          {errorMessage ? (
            <p className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert" aria-live="polite">
              {errorMessage}
            </p>
          ) : null}
          {successMessage ? (
            <p className="mb-4 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700" role="status" aria-live="polite">
              {successMessage}
            </p>
          ) : null}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <Field id="signup-username" label="Username">
              <Input id="signup-username" required value={form.username} onChange={onChange('username')} />
            </Field>
            <Field id="signup-email" label="Email">
              <Input id="signup-email" type="email" required value={form.email} onChange={onChange('email')} />
            </Field>
            <Field id="signup-fullName" label="Full name">
              <Input id="signup-fullName" required value={form.fullName} onChange={onChange('fullName')} />
            </Field>
            <Field id="signup-phoneNumber" label="Phone number">
              <Input id="signup-phoneNumber" required value={form.phoneNumber} onChange={onChange('phoneNumber')} />
            </Field>
            <Field id="signup-password" label="Password">
              <Input id="signup-password" type="password" required minLength={6} value={form.password} onChange={onChange('password')} />
            </Field>
            <div className="space-y-1.5">
              <label htmlFor="signup-confirmPassword" className="text-sm font-medium text-[var(--sea-ink)]">
                Confirm password
              </label>
              <Input
                id="signup-confirmPassword"
                type="password"
                required
                minLength={6}
                value={form.confirmPassword}
                onChange={onChange('confirmPassword')}
                aria-describedby="signup-confirmPassword-hint"
              />
              <p id="signup-confirmPassword-hint" className="text-xs text-[var(--sea-ink-soft)]">
                Must match password exactly.
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={signUpMutation.isPending}>
              {signUpMutation.isPending ? 'Creating account...' : 'Create account'}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-[var(--sea-ink-soft)]">
            Already have account?{' '}
            <Link to="/signin" className="font-medium text-[var(--lagoon-deep)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </section>
  )
}

function Field({
  children,
  id,
  label,
}: {
  children: ReactNode
  id: string
  label: string
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-[var(--sea-ink)]">
        {label}
      </label>
      {children}
    </div>
  )
}
