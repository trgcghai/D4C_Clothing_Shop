import axiosInstance from "./_axios";

export type PaymentMethod = "QR" | "CASH";

export interface CheckoutSnapshot {
  priceAtCheckout: number;
  productName: string;
  variantSku: string;
}

export interface CheckoutItem {
  productName: string;
  color: string;
  size: string;
  price: number;
  quantity: number;
  variantId: string;
  snapshot: CheckoutSnapshot;
}

export interface CreateOrderPayload {
  orderId: string;
  items: CheckoutItem[];
  totalAmount: number;
  paymentMethod: PaymentMethod;
  email: string;
}

export interface OrderItemResponse {
  id: number;
  productId: number;
  productName: string;
  color: string;
  size: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  snapshotProductName: string;
  snapshotVariantSku: string;
  snapshotPriceAtCheckout: number;
}

export interface OrderResponse {
  id: number;
  userId: number;
  checkoutOrderId: string;
  status: string;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  items: OrderItemResponse[];
  createdAt: string;
  updatedAt: string;
}

export const createOrderFromCheckout = async (
  payload: CreateOrderPayload,
): Promise<OrderResponse> => {
  return axiosInstance.post("/api/orders", payload).then((res) => res.data);
};

export const getOrderById = async (id: number): Promise<OrderResponse> => {
  return axiosInstance.get(`/api/orders/${id}`).then((res) => res.data);
};

export const getOrdersByUser = async (): Promise<OrderResponse[]> => {
  return axiosInstance.get("/api/orders/user/me").then((res) => res.data);
};

export interface UserOrdersPaginatedResponse {
  content: OrderResponse[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export const getOrdersByUserPaginated = async (params: {
  page: number;
  size: number;
}): Promise<UserOrdersPaginatedResponse> => {
  return axiosInstance.get("/api/orders", { params }).then((res) => res.data);
};

export const getUserOrderDetail = async (
  orderId: number,
): Promise<OrderResponse> => {
  return axiosInstance.get(`/api/orders/${orderId}`).then((res) => res.data);
};

export const cancelOrder = async (orderId: number): Promise<OrderResponse> => {
  return axiosInstance
    .patch(`/api/orders/${orderId}/status`, { status: "CANCELLED" })
    .then((res) => res.data);
};
