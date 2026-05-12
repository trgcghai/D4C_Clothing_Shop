import axiosInstance from "./_axios";

export type OrderStatus = "PENDING_PAYMENT" | "PAID" | "CANCELLED";

export interface AdminOrderItem {
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

export interface AdminOrder {
  id: number;
  checkoutOrderId: string;
  userId: number;
  status: OrderStatus;
  totalAmount: number;
  items: AdminOrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface AdminOrderListResponse {
  content: AdminOrder[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export interface AdminOrderFilters {
  status?: OrderStatus;
  from?: string;
  to?: string;
  page?: number;
  size?: number;
}

export interface UpdateOrderStatusPayload {
  status: OrderStatus;
  note?: string;
}

export interface AuditLogResponse {
  id: number;
  orderId: number;
  adminUserId: number;
  previousStatus: OrderStatus;
  newStatus: OrderStatus;
  note?: string;
  createdAt: string;
}

export const getAdminOrders = async (
  params?: AdminOrderFilters,
): Promise<AdminOrderListResponse> => {
  return axiosInstance
    .get("/api/orders/admin", { params })
    .then((res) => res.data);
};

export const getAdminOrderById = async (id: number): Promise<AdminOrder> => {
  return axiosInstance.get(`/api/orders/admin/${id}`).then((res) => res.data);
};

export const updateAdminOrderStatus = async (
  id: number,
  payload: UpdateOrderStatusPayload,
): Promise<AdminOrder> => {
  return axiosInstance
    .patch(`/api/orders/admin/${id}/status`, payload)
    .then((res) => res.data);
};

export const getOrderAudits = async (id: number): Promise<AuditLogResponse[]> => {
  return axiosInstance
    .get(`/api/orders/admin/${id}/audits`)
    .then((res) => res.data);
};
