import React from "react";
import { Bell, Circle } from "lucide-react";

interface Notification {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationListCardProps {
  list: Notification[];
}

const NotificationListCard: React.FC<NotificationListCardProps> = ({ list }) => {
  return (
    <div className="flex w-full flex-col gap-2 rounded-xl border bg-muted/10 p-2">
      <div className="flex items-center gap-2 border-b pb-2 px-2 pt-1">
        <Bell className="size-4 text-primary" />
        <h4 className="text-xs font-bold uppercase tracking-tight">Thông báo mới</h4>
      </div>
      <div className="max-h-[200px] space-y-1 overflow-y-auto pr-1">
        {list.length > 0 ? (
          list.map((item) => (
            <div key={item.id} className="flex gap-3 rounded-lg bg-background p-2.5 shadow-sm">
              <div className="mt-1">
                {!item.isRead ? <Circle className="size-2 fill-primary text-primary" /> : <div className="size-2" />}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold">{item.title}</span>
                <span className="mt-0.5 text-[11px] leading-normal text-muted-foreground line-clamp-2">{item.message}</span>
              </div>
            </div>
          ))
        ) : (
          <p className="py-4 text-center text-xs text-muted-foreground">Không có thông báo mới.</p>
        )}
      </div>
    </div>
  );
};

export default NotificationListCard;
