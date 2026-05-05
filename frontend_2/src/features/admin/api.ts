import { http } from '@/lib/api/http'
import { getProducts, type PaginatedProducts, type Product, type ProductListParams } from '@/features/catalog/api'

export interface UpdateProductInput {
  readonly id: string
  readonly formData: FormData
}

export async function listAdminProducts(params: ProductListParams): Promise<PaginatedProducts<Product>> {
  return await getProducts(params)
}

export async function createAdminProduct(formData: FormData): Promise<Product> {
  return await http<Product>('/api/products', {
    method: 'POST',
    body: formData,
  })
}

export async function updateAdminProduct(input: UpdateProductInput): Promise<Product> {
  return await http<Product>(`/api/products/${input.id}`, {
    method: 'PUT',
    body: input.formData,
  })
}

export async function deleteAdminProduct(id: string): Promise<void> {
  await http(`/api/products/${id}`, {
    method: 'DELETE',
  })
}
