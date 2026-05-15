import React from "react";
import { TrendingUp, Package } from "lucide-react";

interface AdminStatsCardProps {
  data: {
    revenue?: number;
    orders?: number;
    users?: number;
    period?: string;
    totalRevenue?: number;
    ordersCount?: number;
  };
}

const AdminStatsCard: React.FC<AdminStatsCardProps> = ({ data }) => {
  const revenue = data.revenue || data.totalRevenue || 0;
  const orders = data.orders || data.ordersCount || 0;
  const period = data.period || "hôm nay";

  const periodLabels: Record<string, string> = {
    today: "hôm nay",
    this_week: "tuần này",
    this_month: "tháng này"
  };

  return (
    <div className="grid w-full grid-cols-2 gap-2 rounded-xl border bg-muted/20 p-3">
      <div className="col-span-2 mb-1 flex items-center justify-between px-1">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Thống kê {periodLabels[period] || period}
        </h4>
        <div className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-600">
          Live
        </div>
      </div>
      
      <div className="flex flex-col rounded-lg bg-background p-2.5 shadow-sm">
        <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
          <TrendingUp className="size-3 text-primary" />
          <span className="text-[10px]">Doanh thu</span>
        </div>
        <p className="text-sm font-bold">
          {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(revenue)}
        </p>
      </div>

      <div className="flex flex-col rounded-lg bg-background p-2.5 shadow-sm">
        <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
          <Package className="size-3 text-orange-500" />
          <span className="text-[10px]">Đơn hàng</span>
        </div>
        <p className="text-sm font-bold">{orders}</p>
      </div>
    </div>
  );
};

export default AdminStatsCard;
