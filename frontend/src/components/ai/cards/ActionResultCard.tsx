import React from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";

interface ActionResultCardProps {
  data: {
    success: boolean;
    message: string;
    productId?: string;
  };
}

const ActionResultCard: React.FC<ActionResultCardProps> = ({ data }) => {
  return (
    <div className={`flex w-full items-start gap-3 rounded-xl border p-4 shadow-sm ${
      data.success ? "border-green-100 bg-green-50" : "border-red-100 bg-red-50"
    }`}>
      {data.success ? (
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-green-600" />
      ) : (
        <AlertCircle className="mt-0.5 size-5 shrink-0 text-red-600" />
      )}
      <div>
        <p className={`text-sm font-medium ${data.success ? "text-green-800" : "text-red-800"}`}>
          {data.message}
        </p>
        {data.productId && (
          <p className="mt-1 text-[10px] text-green-600/70">ID: {data.productId}</p>
        )}
      </div>
    </div>
  );
};

export default ActionResultCard;
