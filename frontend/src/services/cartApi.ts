import axiosInstance from "./_axios";

export interface CartItem {
  id: number;
  variantId: string;
  productId: string;
  productName: string;
  color: string;
  size: string;
  price: number;
  quantity: number;
  subtotal: number;
  sku?: string;
  imageUrl?: string;
}

export interface Cart {
  cartId: number;
  userId: number;
  items: CartItem[];
  totalAmount: number;
  totalItems: number;
}

export interface AddCartItemPayload {
  productId: string;
  variantId: string;
  quantity: number;
}

export interface UpdateCartItemPayload {
  quantity: number;
}

export interface ValidationError {
  variantId: string;
  reason: string;
  message: string;
}

export interface ValidationResponse {
  valid: boolean;
  errors: ValidationError[];
}

export interface CheckoutItem {
  variantId: string;
  productName: string;
  color: string;
  size: string;
  price: number;
  quantity: number;
  snapshot: {
    priceAtCheckout: number;
    productName: string;
    variantSku: string;
  };
}

export interface CheckoutResponse {
  orderId: string;
  status: string;
  items: CheckoutItem[];
  totalAmount: number;
}

export const getCart = () =>
  axiosInstance.get<Cart>("/api/cart").then((res) => res.data);

export const addItemToCart = (payload: AddCartItemPayload) =>
  axiosInstance.post<Cart>("/api/cart/items", payload).then((res) => res.data);

export const updateCartItem = (itemId: number, payload: UpdateCartItemPayload) =>
  axiosInstance.put<Cart>(`/api/cart/items/${itemId}`, payload).then((res) => res.data);

export const removeCartItem = (itemId: number) =>
  axiosInstance.delete<Cart>(`/api/cart/items/${itemId}`).then((res) => res.data);

export const clearCart = () =>
  axiosInstance.delete<void>("/api/cart").then((res) => res.data);

export const validateCart = () =>
  axiosInstance.post<ValidationResponse>("/api/cart/validate").then((res) => res.data);

export const checkout = () =>
  axiosInstance.post<CheckoutResponse>("/api/cart/checkout").then((res) => res.data);

export interface CartItemsPayload {
  itemIds: number[];
}

export const partialCheckout = async (
  payload: CartItemsPayload,
): Promise<CheckoutResponse> => {
  return axiosInstance.post<CheckoutResponse>("/api/cart/checkout/partial", payload).then((res) => res.data);
};

export const removeCartItemsBulk = async (
  payload: CartItemsPayload,
): Promise<Cart> => {
  return axiosInstance.delete<Cart>("/api/cart/items/bulk", { data: payload }).then((res) => res.data);
};

export const clearCartAfterCheckout = () =>
  axiosInstance.post<void>("/api/cart/checkout/clear").then((res) => res.data);
