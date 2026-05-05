import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Product } from '@/features/catalog/api'

const CATEGORY_OPTIONS = ['Áo', 'Quần', 'Giày', 'Phụ kiện']
const GENDER_OPTIONS = ['Nam', 'Nữ', 'Unisex']
const BRAND_OPTIONS = ['D4C', 'Nike', 'Adidas', 'Zara', 'H&M', 'Uniqlo', 'Local Brand']
const COLOR_OPTIONS = ['Đen', 'Trắng', 'Xám', 'Đỏ', 'Xanh Navy', 'Xanh Dương', 'Xanh Lá', 'Vàng', 'Hồng', 'Nâu']
const SIZE_LIST = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const

interface StockInput { readonly size: string; readonly quantity: number }
interface AdminProductFormState {
  readonly name: string; readonly description: string; readonly price: string
  readonly category: string; readonly gender: string; readonly brand: string
  readonly colors: readonly string[]; readonly tags: readonly string[]
  readonly isFeatured: boolean; readonly stock: readonly StockInput[]
}
interface AdminProductFormSubmitPayload { readonly id?: string; readonly formData: FormData }
interface AdminProductFormProps {
  readonly mode: 'create' | 'edit'; readonly product?: Product
  readonly isSubmitting: boolean
  readonly onSubmit: (payload: AdminProductFormSubmitPayload) => Promise<void>
  readonly onCancelEdit?: () => void
}

function buildDefaultStock(stock: readonly { size: string; quantity: number | string }[] | undefined): readonly StockInput[] {
  return SIZE_LIST.map((size) => {
    const current = stock?.find((item) => item.size === size)
    return { size, quantity: Number(current?.quantity ?? 0) }
  })
}

function toInitialState(product?: Product): AdminProductFormState {
  return {
    name: product?.name ?? '', description: product?.description ?? '',
    price: product?.price != null ? String(product.price) : '',
    category: product?.category ?? 'Áo', gender: product?.gender ?? 'Unisex',
    brand: product?.brand ?? 'D4C', colors: product?.colors ?? [],
    tags: product?.tags ?? [], isFeatured: Boolean(product?.isFeatured),
    stock: buildDefaultStock(product?.stock),
  }
}

function createFormData(state: AdminProductFormState, imageFile: File | null) {
  const payload = new FormData()
  payload.append('name', state.name); payload.append('description', state.description)
  payload.append('price', state.price); payload.append('stock', JSON.stringify(state.stock))
  payload.append('category', state.category); payload.append('gender', state.gender)
  payload.append('brand', state.brand); payload.append('colors', JSON.stringify(state.colors))
  payload.append('tags', JSON.stringify(state.tags)); payload.append('isFeatured', String(state.isFeatured))
  if (imageFile) payload.append('productImage', imageFile)
  return payload
}

export function AdminProductForm({ mode, product, isSubmitting, onSubmit, onCancelEdit }: AdminProductFormProps) {
  const [state, setState] = useState<AdminProductFormState>(() => toInitialState(product))
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [tagInput, setTagInput] = useState(state.tags.join(', '))

  useEffect(() => {
    const next = toInitialState(product); setState(next); setTagInput(next.tags.join(', ')); setImageFile(null)
  }, [product])

  const previewUrl = useMemo(() => (imageFile ? URL.createObjectURL(imageFile) : null), [imageFile])
  useEffect(() => { if (!previewUrl) return; return () => URL.revokeObjectURL(previewUrl) }, [previewUrl])

  const handleStockChange = (size: string, quantity: number) => {
    setState((prev) => ({ ...prev, stock: prev.stock.map((item) => (item.size === size ? { ...item, quantity } : item)) }))
  }

  const toggleColor = (color: string) => {
    setState((prev) => ({ ...prev, colors: prev.colors.includes(color) ? prev.colors.filter((c) => c !== color) : [...prev.colors, color] }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = createFormData(state, imageFile)
    await onSubmit({ id: mode === 'edit' ? product?.id : undefined, formData })
    if (mode === 'create') { const next = toInitialState(); setState(next); setTagInput(''); setImageFile(null) }
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
            <div className="space-y-2">
              <Label htmlFor="product-name">Tên sản phẩm</Label>
              <Input id="product-name" value={state.name} onChange={(e) => setState((p) => ({ ...p, name: e.target.value }))} required disabled={isSubmitting} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-description">Mô tả</Label>
              <textarea id="product-description" className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" value={state.description} onChange={(e) => setState((p) => ({ ...p, description: e.target.value }))} required disabled={isSubmitting} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-price">Giá (VNĐ)</Label>
              <Input id="product-price" type="number" min={0} value={state.price} onChange={(e) => setState((p) => ({ ...p, price: e.target.value }))} required disabled={isSubmitting} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-image">Ảnh sản phẩm</Label>
              <Input id="product-image" type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} disabled={isSubmitting} required={mode === 'create'} />
            </div>
            {(previewUrl || product?.imageUrl) && (
              <img src={previewUrl ?? product?.imageUrl} alt={state.name || 'Product preview'} className="h-24 w-24 rounded-lg border border-border object-cover" />
            )}
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="product-category">Danh mục</Label>
                <Select value={state.category} onValueChange={(v) => setState((p) => ({ ...p, category: v }))} disabled={isSubmitting}>
                  <SelectTrigger id="product-category"><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORY_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-gender">Giới tính</Label>
                <Select value={state.gender} onValueChange={(v) => setState((p) => ({ ...p, gender: v }))} disabled={isSubmitting}>
                  <SelectTrigger id="product-gender"><SelectValue /></SelectTrigger>
                  <SelectContent>{GENDER_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-brand">Thương hiệu</Label>
              <Select value={state.brand} onValueChange={(v) => setState((p) => ({ ...p, brand: v }))} disabled={isSubmitting}>
                <SelectTrigger id="product-brand"><SelectValue /></SelectTrigger>
                <SelectContent>{BRAND_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-tags">Tags (ngăn cách bởi dấu phẩy)</Label>
              <Input id="product-tags" value={tagInput} onChange={(e) => { setTagInput(e.target.value); setState((p) => ({ ...p, tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })) }} disabled={isSubmitting} />
            </div>

            <div className="space-y-2">
              <Label>Màu sắc</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map((color) => (
                  <Button key={color} type="button" size="sm" variant={state.colors.includes(color) ? 'default' : 'outline'} onClick={() => toggleColor(color)} disabled={isSubmitting}>{color}</Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Số lượng theo size</Label>
              <div className="grid grid-cols-3 gap-2">
                {state.stock.map((item) => (
                  <div key={item.size} className="space-y-1">
                    <Label htmlFor={`stock-${item.size}`} className="text-xs text-muted-foreground">{item.size}</Label>
                    <Input id={`stock-${item.size}`} type="number" min={0} value={item.quantity} onChange={(e) => handleStockChange(item.size, Number(e.target.value))} disabled={isSubmitting} />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox id="product-featured" checked={state.isFeatured} onCheckedChange={(c) => setState((p) => ({ ...p, isFeatured: c === true }))} disabled={isSubmitting} />
              <Label htmlFor="product-featured">Đánh dấu sản phẩm nổi bật</Label>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Đang lưu...' : mode === 'edit' ? 'Cập nhật sản phẩm' : 'Thêm sản phẩm'}</Button>
              {mode === 'edit' && <Button type="button" variant="outline" onClick={onCancelEdit} disabled={isSubmitting}>Huỷ sửa</Button>}
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
