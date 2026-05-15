import React from "react";
import { AlertTriangle } from "lucide-react";

interface InventoryItem {
  productName: string;
  size: string;
  color: string;
  currentStock: number;
}

interface InventoryReportCardProps {
  data: {
    items: InventoryItem[];
    threshold: number;
    count: number;
  };
}

const InventoryReportCard: React.FC<InventoryReportCardProps> = ({ data }) => {
  const items = data.items || [];
  
  return (
    <div className="flex w-full flex-col gap-3 rounded-xl border border-orange-100 bg-orange-50/30 p-3">
      <div className="flex items-center gap-2 px-1">
        <AlertTriangle className="size-4 text-orange-500" />
        <h4 className="text-xs font-bold text-orange-800">Cảnh báo tồn kho thấp ({data.count})</h4>
      </div>
      
      <div className="space-y-1.5">
        {items.length > 0 ? (
          items.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between rounded-lg bg-background/60 p-2 text-[11px] shadow-sm">
              <div className="flex flex-col">
                <span className="font-semibold text-foreground line-clamp-1">{item.productName}</span>
                <span className="text-muted-foreground">{item.size} - {item.color}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-red-500">{item.currentStock}</span>
                <div className="size-1.5 rounded-full bg-red-500" />
              </div>
            </div>
          ))
        ) : (
          <p className="py-2 text-center text-xs text-muted-foreground">Mọi thứ đều ổn!</p>
        )}
      </div>
    </div>
  );
};

export default InventoryReportCard;
