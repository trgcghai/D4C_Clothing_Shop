// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
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
    <a href={to} className={className} data-router-link="true">
      {children}
    </a>
  ),
}))

vi.mock('../ThemeToggle', () => ({
  default: () => <button type="button">Theme</button>,
}))

describe('Header accessibility baseline', () => {
  it('supports accessible navigation labels and keyboard interaction', () => {
    render(<Header />)

    expect(
      screen.getByRole('navigation', {
        name: /primary navigation/i,
      }),
    ).toBeTruthy()

    expect(screen.getByRole('link', { name: /products/i })).toBeTruthy()
    expect(screen.getByRole('link', { name: /about/i })).toBeTruthy()
    expect(screen.getByRole('link', { name: /docs/i })).toBeTruthy()

    const demosToggle = screen.getByText(/demos/i)
    const demosMenu = demosToggle.closest('details')
    expect(demosMenu).toBeTruthy()
    expect(demosMenu?.hasAttribute('open')).toBe(false)

    demosToggle.focus()
    fireEvent.keyDown(demosToggle, { key: 'Enter', code: 'Enter' })
    fireEvent.click(demosToggle)
    expect(demosMenu?.hasAttribute('open')).toBe(true)

    expect(screen.getByRole('link', { name: /tanstack table/i })).toBeTruthy()
    expect(screen.getByRole('link', { name: /^store$/i })).toBeTruthy()

    const tableLink = screen.getByRole('link', { name: /tanstack table/i })
    const storeLink = screen.getByRole('link', { name: /^store$/i })

    expect(tableLink.getAttribute('data-router-link')).toBe('true')
    expect(storeLink.getAttribute('data-router-link')).toBe('true')
  })
})
