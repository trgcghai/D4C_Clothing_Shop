import type { PaymentMethod } from "@/src/services/paymentApi";

const getStatusBadgeVariant = (status: string) => {
  if (status === "PAID") return "default";
  if (status === "CANCELLED") return "destructive";
  return "secondary";
};

const getStatusLabel = (status: string) => {
  if (status === "PENDING_PAYMENT") return "Chờ thanh toán";
  if (status === "PAID") return "Đã thanh toán";
  if (status === "CANCELLED") return "Đã hủy";
  return status;
};

const getPaymentMethodLabel = (method: PaymentMethod) => {
  return method === "QR" ? "QR Code" : "Tiền mặt";
};

const getPaymentMethodBadgeVariant = (method: PaymentMethod) => {
  return method === "QR" ? "default" : "secondary";
};

export {
  getStatusBadgeVariant,
  getStatusLabel,
  getPaymentMethodLabel,
  getPaymentMethodBadgeVariant,
};
