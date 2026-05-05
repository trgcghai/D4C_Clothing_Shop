import { describe, expect, it } from 'vitest'

import { getAdminGuardRedirect, getAuthGuardRedirect } from '@/features/auth/store'

describe('admin guard', () => {
  it('redirects unauthenticated users to signin', () => {
    expect(getAuthGuardRedirect(null)).toBe('/signin')
  })

  it('redirects non-admin users to home', () => {
    expect(getAdminGuardRedirect('ROLE_USER')).toBe('/')
  })

  it('allows admins to stay in admin route', () => {
    expect(getAdminGuardRedirect('ROLE_ADMIN')).toBeNull()
  })
})
