import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AdminDashboardOverview } from '@/features/admin/components/admin-dashboard-overview'
import { AdminProductForm } from '@/features/admin/components/admin-product-form'
import { AdminProductTable } from '@/features/admin/components/admin-product-table'
import {
  useAdminProductsQuery,
  useCreateAdminProductMutation,
  useDeleteAdminProductMutation,
  useUpdateAdminProductMutation,
} from '@/features/admin/hooks'
import type { UserProfile } from '@/features/auth/api'
import { isUnauthorizedMeError, readAuthenticatedProfile, useMeQuery } from '@/features/auth/hooks'
import {
  clearAccessToken,
  getAccessToken,
  getAdminGuardRedirect,
} from '@/features/auth/store'
import type { Product } from '@/features/catalog/api'
import { queryClient } from '@/lib/query/client'
import { qk } from '@/lib/query/keys'

export const Route = createFileRoute('/admin')({
  beforeLoad: async () => {
    if (!getAccessToken()) {
      throw redirect({ to: '/signin' })
    }

    let profile: UserProfile | undefined
    try {
      profile = await readAuthenticatedProfile(queryClient)
    } catch (error) {
      if (isUnauthorizedMeError(error)) {
        clearAccessToken()
        queryClient.removeQueries({ queryKey: qk.auth.me() })
      }
      throw redirect({ to: '/signin' })
    }

    if (profile) {
      const adminRedirect = getAdminGuardRedirect(profile.role)
      if (adminRedirect) {
        throw redirect({ to: adminRedirect })
      }
    }
  },
  component: AdminRoute,
})

function AdminRoute() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'products'>('dashboard')
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)

  const meQuery = useMeQuery()
  const productsQuery = useAdminProductsQuery()
  const createMutation = useCreateAdminProductMutation()
  const updateMutation = useUpdateAdminProductMutation()
  const deleteMutation = useDeleteAdminProductMutation()
  const products = productsQuery.data?.data ?? []

  if (meQuery.isPending) {
    return <div className="py-10 text-center text-[var(--sea-ink-soft)]">Loading admin access...</div>
  }

  const handleDelete = async (product: Product) => {
    if (!window.confirm(`Xoá sản phẩm "${product.name}"?`)) {
      return
    }
    await deleteMutation.mutateAsync(product.id)
    if (editingProduct?.id === product.id) {
      setEditingProduct(null)
    }
  }

  return (
    <main className="page-wrap px-4 py-10">
      <Card className="mx-auto max-w-5xl">
        <CardHeader>
          <CardTitle>Admin dashboard</CardTitle>
          <CardDescription>Quản lý sản phẩm và tồn kho.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {meQuery.isError ? (
            <p className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800" role="alert" aria-live="polite">
              {meQuery.error instanceof Error ? meQuery.error.message : 'Unable to verify admin access right now.'}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              variant={activeTab === 'dashboard' ? 'default' : 'outline'}
              onClick={() => setActiveTab('dashboard')}
            >
              Dashboard
            </Button>
            <Button
              variant={activeTab === 'products' ? 'default' : 'outline'}
              onClick={() => setActiveTab('products')}
            >
              Sản phẩm
            </Button>
          </div>

          {activeTab === 'dashboard' ? (
            <AdminDashboardOverview products={products} />
          ) : (
            <div className="space-y-6">
              <AdminProductForm
                mode={editingProduct ? 'edit' : 'create'}
                product={editingProduct ?? undefined}
                isSubmitting={createMutation.isPending || updateMutation.isPending}
                onSubmit={async (payload) => {
                  if (payload.id) {
                    await updateMutation.mutateAsync({ id: payload.id, formData: payload.formData })
                    setEditingProduct(null)
                    return
                  }
                  await createMutation.mutateAsync(payload.formData)
                }}
                onCancelEdit={() => setEditingProduct(null)}
              />

              <AdminProductTable
                products={products}
                isLoading={productsQuery.isPending || productsQuery.isFetching}
                isDeleting={deleteMutation.isPending}
                onEdit={setEditingProduct}
                onDelete={(product) => void handleDelete(product)}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
