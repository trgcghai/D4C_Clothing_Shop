import { describe, expect, it } from 'vitest'

import { qk } from '@/lib/query/keys'

describe('catalog keys', () => {
  it('includes pagination and search dependencies', () => {
    expect(
      qk.catalog.list({
        page: 2,
        limit: 24,
        q: 'hoodie',
        category: 'Áo',
        gender: 'Unisex',
        sort_by: 'price',
        sort_order: 'asc',
      }),
    ).toEqual([
      'catalog',
      'list',
      {
        page: 2,
        limit: 24,
        q: 'hoodie',
        category: 'Áo',
        gender: 'Unisex',
        sort_by: 'price',
        sort_order: 'asc',
      },
    ])
  })

  it('builds detail and related keys', () => {
    expect(qk.catalog.detail('p-123')).toEqual(['catalog', 'detail', 'p-123'])
    expect(qk.catalog.related('p-123')).toEqual(['catalog', 'related', 'p-123'])
  })
})
