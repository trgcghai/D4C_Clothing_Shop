import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  getMeQueryOptions,
  readAuthenticatedProfile,
  useChangePasswordMutation,
  useMeQuery,
  useUpdateProfileMutation,
} from '@/features/auth/hooks'
import { clearAccessToken, getAccessToken } from '@/features/auth/store'
import { queryClient } from '@/lib/query/client'
import { qk } from '@/lib/query/keys'

export const Route = createFileRoute('/profile')({
  beforeLoad: async () => {
    if (!getAccessToken()) {
      throw redirect({ to: '/signin' })
    }

    try {
      await queryClient.fetchQuery(getMeQueryOptions())
    } catch {
      clearAccessToken()
      queryClient.removeQueries({ queryKey: qk.auth.me() })
      throw redirect({ to: '/signin' })
    }
  },
  component: ProfileRoute,
})

function ProfileRoute() {
  const meQuery = useMeQuery()
  const updateProfileMutation = useUpdateProfileMutation()
  const changePasswordMutation = useChangePasswordMutation()

  const [profileMessage, setProfileMessage] = useState<string | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const [profileForm, setProfileForm] = useState({
    avatar: '',
    fullName: '',
    phoneNumber: '',
  })
  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    oldPassword: '',
  })

  useEffect(() => {
    if (!meQuery.data) {
      return
    }

    setProfileForm({
      avatar: meQuery.data.avatar ?? '',
      fullName: meQuery.data.fullName,
      phoneNumber: meQuery.data.phoneNumber,
    })
  }, [meQuery.data])

  async function refreshProfileFromServer() {
    await readAuthenticatedProfile(queryClient)
  }

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setProfileError(null)
    setProfileMessage(null)

    try {
      await updateProfileMutation.mutateAsync({
        avatar: profileForm.avatar.trim(),
        fullName: profileForm.fullName.trim(),
        phoneNumber: profileForm.phoneNumber.trim(),
      })
      setProfileMessage('Profile updated successfully')
      await refreshProfileFromServer()
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Failed to update profile')
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPasswordError(null)
    setPasswordMessage(null)

    try {
      const response = await changePasswordMutation.mutateAsync(passwordForm)
      setPasswordMessage(response.message || 'Password changed successfully')
      setPasswordForm({ newPassword: '', oldPassword: '' })
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'Failed to change password')
    }
  }

  if (meQuery.isPending) {
    return <div className="py-10 text-center text-[var(--sea-ink-soft)]">Loading profile...</div>
  }

  return (
    <section className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>View and update account information.</CardDescription>
        </CardHeader>
        <CardContent>
          {profileError ? (
            <p className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert" aria-live="polite">
              {profileError}
            </p>
          ) : null}
          {profileMessage ? (
            <p className="mb-4 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700" role="status" aria-live="polite">
              {profileMessage}
            </p>
          ) : null}

          <div className="mb-4 rounded-md border border-[var(--line)] bg-[var(--surface-strong)] p-3 text-sm text-[var(--sea-ink-soft)]">
            <p>
              <strong className="text-[var(--sea-ink)]">Username:</strong> {meQuery.data?.username ?? '-'}
            </p>
            <p>
              <strong className="text-[var(--sea-ink)]">Email:</strong> {meQuery.data?.email ?? '-'}
            </p>
            <p>
              <strong className="text-[var(--sea-ink)]">Role:</strong> {meQuery.data?.role ?? '-'}
            </p>
          </div>

          <form className="space-y-3" onSubmit={handleProfileSubmit}>
            <Field id="profile-fullName" label="Full name">
              <Input
                id="profile-fullName"
                required
                value={profileForm.fullName}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,
                    fullName: event.target.value,
                  }))
                }
              />
            </Field>

            <Field id="profile-phoneNumber" label="Phone number">
              <Input
                id="profile-phoneNumber"
                required
                value={profileForm.phoneNumber}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,
                    phoneNumber: event.target.value,
                  }))
                }
              />
            </Field>

            <Field id="profile-avatar" label="Avatar URL">
              <Input
                id="profile-avatar"
                type="url"
                value={profileForm.avatar}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,
                    avatar: event.target.value,
                  }))
                }
              />
            </Field>

            <Button type="submit" className="w-full" disabled={updateProfileMutation.isPending}>
              {updateProfileMutation.isPending ? 'Saving...' : 'Save profile'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>Use current password to set a new one.</CardDescription>
        </CardHeader>
        <CardContent>
          {passwordError ? (
            <p className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert" aria-live="polite">
              {passwordError}
            </p>
          ) : null}
          {passwordMessage ? (
            <p className="mb-4 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700" role="status" aria-live="polite">
              {passwordMessage}
            </p>
          ) : null}

          <form className="space-y-3" onSubmit={handlePasswordSubmit}>
            <Field id="password-old" label="Current password">
              <Input
                id="password-old"
                type="password"
                required
                minLength={6}
                autoComplete="current-password"
                value={passwordForm.oldPassword}
                onChange={(event) =>
                  setPasswordForm((current) => ({
                    ...current,
                    oldPassword: event.target.value,
                  }))
                }
              />
            </Field>

            <Field id="password-new" label="New password">
              <Input
                id="password-new"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={passwordForm.newPassword}
                onChange={(event) =>
                  setPasswordForm((current) => ({
                    ...current,
                    newPassword: event.target.value,
                  }))
                }
              />
            </Field>

            <Button type="submit" className="w-full" disabled={changePasswordMutation.isPending}>
              {changePasswordMutation.isPending ? 'Updating...' : 'Update password'}
            </Button>
          </form>
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
