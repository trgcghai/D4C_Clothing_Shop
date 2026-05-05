import { describe, expect, it } from 'vitest'
import { qk } from './keys'

describe('query keys', () => {
  it('builds serializable hierarchical auth keys', () => {
    expect(qk.auth.me()).toEqual(['auth', 'me'])
  })

  it('includes dependencies in catalog list key', () => {
    expect(qk.catalog.list({ page: 1, q: 'shirt' })).toEqual([
      'catalog',
      'list',
      { page: 1, q: 'shirt' },
    ])
  })
})
