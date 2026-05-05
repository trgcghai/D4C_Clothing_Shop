// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Header from '../Header'

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
    className,
  }: {
    to: string
    children: React.ReactNode
    className?: string
  }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}))

vi.mock('../ThemeToggle', () => ({
  default: () => <button type="button">Theme</button>,
}))

describe('Header accessibility baseline', () => {
  it('renders an accessible primary navigation with keyboard-focusable touch targets', () => {
    render(<Header />)

    expect(
      screen.getByRole('navigation', {
        name: /primary navigation/i,
      }),
    ).toBeTruthy()

    const productsLink = screen.getByRole('link', { name: /products/i })
    expect(productsLink).toBeTruthy()
    expect(productsLink.className).toContain('focus-visible:ring-2')
    expect(productsLink.className).toContain('min-h-10')
  })
})
