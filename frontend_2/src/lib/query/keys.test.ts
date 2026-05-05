import { describe, expect, it } from 'vitest'
import { qk } from './keys'

describe('query keys', () => {
  it('builds serializable hierarchical auth keys', () => {
    expect(qk.auth.me()).toEqual(['auth', 'me'])
  })

  it('includes dependencies in catalog list key', () => {
    expect(qk.catalog.list({ page: 1, limit: 12, q: 'shirt' })).toEqual([
      'catalog',
      'list',
      { page: 1, limit: 12, q: 'shirt' },
    ])
  })

  it('builds detail and related keys', () => {
    expect(qk.catalog.detail('abc')).toEqual(['catalog', 'detail', 'abc'])
    expect(qk.catalog.related('abc')).toEqual(['catalog', 'related', 'abc'])
  })
})
