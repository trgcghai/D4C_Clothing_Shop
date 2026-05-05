import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { Product } from '@/features/catalog/api'

const CATEGORY_OPTIONS = ['Áo', 'Quần', 'Giày', 'Phụ kiện']
const GENDER_OPTIONS = ['Nam', 'Nữ', 'Unisex']
const BRAND_OPTIONS = ['D4C', 'Nike', 'Adidas', 'Zara', 'H&M', 'Uniqlo', 'Local Brand']
const COLOR_OPTIONS = ['Đen', 'Trắng', 'Xám', 'Đỏ', 'Xanh Navy', 'Xanh Dương', 'Xanh Lá', 'Vàng', 'Hồng', 'Nâu']
const SIZE_LIST = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const

interface StockInput {
  readonly size: string
  readonly quantity: number
}

interface AdminProductFormState {
  readonly name: string
  readonly description: string
  readonly price: string
  readonly category: string
  readonly gender: string
  readonly brand: string
  readonly colors: readonly string[]
  readonly tags: readonly string[]
  readonly isFeatured: boolean
  readonly stock: readonly StockInput[]
}

interface AdminProductFormSubmitPayload {
  readonly id?: string
  readonly formData: FormData
}

interface AdminProductFormProps {
  readonly mode: 'create' | 'edit'
  readonly product?: Product
  readonly isSubmitting: boolean
  readonly onSubmit: (payload: AdminProductFormSubmitPayload) => Promise<void>
  readonly onCancelEdit?: () => void
}

function buildDefaultStock(stock: readonly { size: string; quantity: number | string }[] | undefined): readonly StockInput[] {
  return SIZE_LIST.map((size) => {
    const current = stock?.find((item) => item.size === size)
    return {
      size,
      quantity: Number(current?.quantity ?? 0),
    }
  })
}

function toInitialState(product?: Product): AdminProductFormState {
  return {
    name: product?.name ?? '',
    description: product?.description ?? '',
    price: product?.price != null ? String(product.price) : '',
    category: product?.category ?? 'Áo',
    gender: product?.gender ?? 'Unisex',
    brand: product?.brand ?? 'D4C',
    colors: product?.colors ?? [],
    tags: product?.tags ?? [],
    isFeatured: Boolean(product?.isFeatured),
    stock: buildDefaultStock(product?.stock),
  }
}

function createFormData(state: AdminProductFormState, imageFile: File | null) {
  const payload = new FormData()
  payload.append('name', state.name)
  payload.append('description', state.description)
  payload.append('price', state.price)
  payload.append('stock', JSON.stringify(state.stock))
  payload.append('category', state.category)
  payload.append('gender', state.gender)
  payload.append('brand', state.brand)
  payload.append('colors', JSON.stringify(state.colors))
  payload.append('tags', JSON.stringify(state.tags))
  payload.append('isFeatured', String(state.isFeatured))
  if (imageFile) {
    payload.append('productImage', imageFile)
  }
  return payload
}

export function AdminProductForm({
  mode,
  product,
  isSubmitting,
  onSubmit,
  onCancelEdit,
}: AdminProductFormProps) {
  const [state, setState] = useState<AdminProductFormState>(() => toInitialState(product))
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [tagInput, setTagInput] = useState(state.tags.join(', '))

  useEffect(() => {
    const next = toInitialState(product)
    setState(next)
    setTagInput(next.tags.join(', '))
    setImageFile(null)
  }, [product])

  const previewUrl = useMemo(() => (imageFile ? URL.createObjectURL(imageFile) : null), [imageFile])

  useEffect(() => {
    if (!previewUrl) {
      return
    }
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const handleStockChange = (size: string, quantity: number) => {
    setState((prev) => ({
      ...prev,
      stock: prev.stock.map((item) => (item.size === size ? { ...item, quantity } : item)),
    }))
  }

  const toggleColor = (color: string) => {
    setState((prev) => ({
      ...prev,
      colors: prev.colors.includes(color)
        ? prev.colors.filter((item) => item !== color)
        : [...prev.colors, color],
    }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = createFormData(state, imageFile)
    await onSubmit({
      id: mode === 'edit' ? product?.id : undefined,
      formData,
    })
    if (mode === 'create') {
      const next = toInitialState()
      setState(next)
      setTagInput('')
      setImageFile(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{mode === 'edit' ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}</CardTitle>
        <CardDescription>{mode === 'edit' ? 'Cập nhật thông tin và tồn kho.' : 'Tạo sản phẩm mới cho catalog.'}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <div className="space-y-3">
            <label className="block text-sm text-[var(--sea-ink-soft)]">
              Tên sản phẩm
              <Input
                className="mt-1"
                value={state.name}
                onChange={(event) => setState((prev) => ({ ...prev, name: event.target.value }))}
                required
                disabled={isSubmitting}
              />
            </label>
            <label className="block text-sm text-[var(--sea-ink-soft)]">
              Mô tả
              <textarea
                className="mt-1 min-h-24 w-full rounded-md border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-sm text-[var(--sea-ink)] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={state.description}
                onChange={(event) => setState((prev) => ({ ...prev, description: event.target.value }))}
                required
                disabled={isSubmitting}
              />
            </label>
            <label className="block text-sm text-[var(--sea-ink-soft)]">
              Giá (VNĐ)
              <Input
                type="number"
                min={0}
                className="mt-1"
                value={state.price}
                onChange={(event) => setState((prev) => ({ ...prev, price: event.target.value }))}
                required
                disabled={isSubmitting}
              />
            </label>
            <label className="block text-sm text-[var(--sea-ink-soft)]">
              Ảnh sản phẩm
              <Input
                type="file"
                accept="image/*"
                className="mt-1"
                onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
                disabled={isSubmitting}
                required={mode === 'create'}
              />
            </label>
            {(previewUrl || product?.imageUrl) ? (
              <img
                src={previewUrl ?? product?.imageUrl}
                alt={state.name || 'Product preview'}
                className="h-24 w-24 rounded-lg border border-[var(--line)] object-cover"
              />
            ) : null}
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-sm text-[var(--sea-ink-soft)]">
                Danh mục
                <select
                  className="mt-1 h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface-strong)] px-3 text-sm text-[var(--sea-ink)] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={state.category}
                  onChange={(event) => setState((prev) => ({ ...prev, category: event.target.value }))}
                  disabled={isSubmitting}
                >
                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm text-[var(--sea-ink-soft)]">
                Giới tính
                <select
                  className="mt-1 h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface-strong)] px-3 text-sm text-[var(--sea-ink)] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={state.gender}
                  onChange={(event) => setState((prev) => ({ ...prev, gender: event.target.value }))}
                  disabled={isSubmitting}
                >
                  {GENDER_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block text-sm text-[var(--sea-ink-soft)]">
              Thương hiệu
              <select
                className="mt-1 h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface-strong)] px-3 text-sm text-[var(--sea-ink)] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={state.brand}
                onChange={(event) => setState((prev) => ({ ...prev, brand: event.target.value }))}
                disabled={isSubmitting}
              >
                {BRAND_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm text-[var(--sea-ink-soft)]">
              Tags (ngăn cách bởi dấu phẩy)
              <Input
                className="mt-1"
                value={tagInput}
                onChange={(event) => {
                  const value = event.target.value
                  setTagInput(value)
                  const nextTags = value.split(',').map((item) => item.trim()).filter(Boolean)
                  setState((prev) => ({ ...prev, tags: nextTags }))
                }}
                disabled={isSubmitting}
              />
            </label>

            <div className="space-y-2">
              <p className="m-0 text-sm text-[var(--sea-ink-soft)]">Màu sắc</p>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map((color) => (
                  <Button
                    key={color}
                    type="button"
                    size="sm"
                    variant={state.colors.includes(color) ? 'default' : 'outline'}
                    onClick={() => toggleColor(color)}
                    disabled={isSubmitting}
                  >
                    {color}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="m-0 text-sm text-[var(--sea-ink-soft)]">Số lượng theo size</p>
              <div className="grid grid-cols-3 gap-2">
                {state.stock.map((item) => (
                  <label key={item.size} className="block text-xs text-[var(--sea-ink-soft)]">
                    {item.size}
                    <Input
                      type="number"
                      min={0}
                      value={item.quantity}
                      onChange={(event) => handleStockChange(item.size, Number(event.target.value))}
                      disabled={isSubmitting}
                    />
                  </label>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-[var(--sea-ink-soft)]">
              <input
                type="checkbox"
                checked={state.isFeatured}
                onChange={(event) => setState((prev) => ({ ...prev, isFeatured: event.target.checked }))}
                disabled={isSubmitting}
              />
              Đánh dấu sản phẩm nổi bật
            </label>

            <div className="flex gap-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Đang lưu...' : mode === 'edit' ? 'Cập nhật sản phẩm' : 'Thêm sản phẩm'}
              </Button>
              {mode === 'edit' ? (
                <Button type="button" variant="outline" onClick={onCancelEdit} disabled={isSubmitting}>
                  Huỷ sửa
                </Button>
              ) : null}
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
