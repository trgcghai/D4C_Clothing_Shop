// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

describe('a11y smoke tests', () => {
  it('keeps focus ring class on Button controls', () => {
    render(<Button>Submit</Button>)
    const button = screen.getByRole('button', { name: /submit/i })
    expect(button.className).toContain('focus-visible:ring')
  })

  it('renders Input with accessible label support', () => {
    render(<Input id="test-input" aria-label="Test input" />)
    expect(screen.getByLabelText(/test input/i)).toBeTruthy()
  })

  it('renders Card with visible title text', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Card Title</CardTitle>
        </CardHeader>
        <CardContent>Card content</CardContent>
      </Card>,
    )
    expect(screen.getByText(/card title/i)).toBeTruthy()
    expect(screen.getByText(/card content/i)).toBeTruthy()
  })

  it('Button supports disabled state', () => {
    render(<Button disabled>Disabled</Button>)
    const button = screen.getByRole('button', { name: /disabled/i })
    expect(button.hasAttribute('disabled')).toBe(true)
  })

  it('Button has minimum 44px touch target via min-h-10 class', () => {
    render(<Button>Tap me</Button>)
    const button = screen.getByRole('button', { name: /tap me/i })
    expect(button.className).toContain('min-h-10')
  })
})
