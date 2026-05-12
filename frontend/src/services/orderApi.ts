import axiosInstance from "./_axios";

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
  snapshot: CheckoutSnapshot;
}

export interface CreateOrderPayload {
  orderId: string;
  items: CheckoutItem[];
  totalAmount: number;
}

export interface OrderItemResponse {
  id: number;
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
