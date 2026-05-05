// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal() as typeof import('@tanstack/react-router')
  return {
    ...actual,
    Link: ({ to, children, className, activeProps, onClick, 'aria-label': ariaLabel }: {
      to: string
      children: React.ReactNode
      className?: string
      activeProps?: { className?: string }
      onClick?: () => void
      'aria-label'?: string
    }) => (
      <a
        href={to}
        className={className}
        onClick={onClick}
        aria-label={ariaLabel}
        aria-current={to === '/' ? 'page' : undefined}
      >
        {children}
      </a>
    ),
    useNavigate: () => vi.fn(),
  }
})

vi.mock('../ThemeToggle', () => ({
  default: function ThemeToggleMock() {
    return <button type="button" aria-label="Toggle theme">Theme</button>
  },
}))

vi.mock('@/features/auth/hooks', () => ({
  useMeQuery: () => ({ data: null, isLoading: false }),
  useSignOutMutation: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('@/features/auth/store', () => ({
  isAdminRole: () => false,
  getAccessToken: () => null,
}))

const Header = (await import('../Header')).default

describe('Header accessibility', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders D4C brand logo link', () => {
    render(<Header />)
    expect(screen.getByRole('link', { name: /d4c clothing shop home/i })).toBeTruthy()
  })

  it('renders keyboard-focusable primary nav with Products link', () => {
    render(<Header />)
    expect(screen.getByRole('navigation', { name: /primary navigation/i })).toBeTruthy()
    expect(screen.getByRole('link', { name: /products/i })).toBeTruthy()
  })

  it('renders Sign in and Sign up links when unauthenticated', () => {
    render(<Header />)
    expect(screen.getByRole('link', { name: /sign in/i })).toBeTruthy()
    expect(screen.getByRole('link', { name: /sign up/i })).toBeTruthy()
  })

  it('renders search input with accessible label', () => {
    render(<Header />)
    expect(screen.getByLabelText(/search products/i)).toBeTruthy()
  })

  it('renders mobile menu toggle with aria-expanded', () => {
    render(<Header />)
    const toggle = screen.getByRole('button', { name: /open menu/i })
    expect(toggle).toBeTruthy()
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
  })

  it('opens mobile menu when toggle is clicked', () => {
    render(<Header />)
    const toggle = screen.getByRole('button', { name: /open menu/i })
    fireEvent.click(toggle)
    expect(screen.getByRole('navigation', { name: /mobile navigation/i })).toBeTruthy()
  })

  it('has focus-visible ring class on interactive elements', () => {
    render(<Header />)
    const productsLink = screen.getByRole('link', { name: /products/i })
    expect(productsLink.className).toContain('focus-visible:ring')
  })

  it('does not show Admin link for non-admin users', () => {
    render(<Header />)
    expect(screen.queryByRole('link', { name: /admin/i })).toBeNull()
  })
})
