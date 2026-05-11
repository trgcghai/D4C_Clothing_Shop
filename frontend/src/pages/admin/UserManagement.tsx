import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Search, Shield, ShieldOff, Users } from "lucide-react";
import { useUsers, useToggleUserStatus } from "@/src/hooks/useUsers";
import ProductPagination from "@/src/components/CustomPagination";
import { toast } from "sonner";

const PAGE_SIZE = 10;

export default function UserManagement() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [disableUserId, setDisableUserId] = useState<number | null>(null);
  const [disableUserName, setDisableUserName] = useState("");

  const { data, isLoading } = useUsers({
    q: debouncedSearch || undefined,
    page,
    size: PAGE_SIZE,
    sort_by: "createdAt",
    sort_order: "desc",
  });

  const toggleMutation = useToggleUserStatus();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleToggle = (userId: number, enabled: boolean, fullName: string) => {
    if (enabled) {
      setDisableUserId(userId);
      setDisableUserName(fullName);
    } else {
      toggleMutation.mutate(userId, {
        onSuccess: () => {
          toast.success("Đã mở khóa tài khoản");
        },
        onError: () => {
          toast.error("Có lỗi xảy ra, vui lòng thử lại");
        },
      });
    }
  };

  const confirmDisable = () => {
    if (disableUserId !== null) {
      toggleMutation.mutate(disableUserId, {
        onSuccess: () => {
          toast.success("Đã khóa tài khoản");
        },
        onError: () => {
          toast.error("Có lỗi xảy ra, vui lòng thử lại");
        },
        onSettled: () => {
          setDisableUserId(null);
          setDisableUserName("");
        },
      });
    }
  };

  const users = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? 0;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="size-6 text-primary" />
            Quản lý người dùng
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {total} người dùng
          </p>
        </div>
      </div>

      <div className="mb-6 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Tìm kiếm theo tên, username, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-10"
        />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">Avatar</TableHead>
              <TableHead>Họ tên</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Vai trò</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="w-[120px]">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-12 text-muted-foreground"
                >
                  Không có người dùng nào
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.fullName}
                        className="size-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="size-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-sm font-medium">
                        {user.fullName?.charAt(0).toUpperCase() || user.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {user.fullName || "---"}
                  </TableCell>
                  <TableCell className="text-sm">{user.username}</TableCell>
                  <TableCell className="text-sm">{user.email}</TableCell>
                  <TableCell>
                    <Badge
                      variant={user.role === "ADMIN" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {user.role === "ADMIN" ? "Admin" : "User"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={user.enabled ? "default" : "destructive"}
                      className="text-xs"
                    >
                      {user.enabled ? "Hoạt động" : "Bị khóa"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant={user.enabled ? "destructive" : "outline"}
                      size="sm"
                      onClick={() =>
                        handleToggle(user.id, user.enabled, user.fullName || user.username)
                      }
                      disabled={toggleMutation.isPending}
                    >
                      {user.enabled ? (
                        <>
                          <ShieldOff className="mr-1.5 size-3.5" />
                          Khóa
                        </>
                      ) : (
                        <>
                          <Shield className="mr-1.5 size-3.5" />
                          Mở khóa
                        </>
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ProductPagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />

      <Dialog
        open={disableUserId !== null}
        onOpenChange={(open: boolean) => {
          if (!open) {
            setDisableUserId(null);
            setDisableUserName("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xác nhận khóa tài khoản</DialogTitle>
            <DialogDescription>
              Bạn có chắc chắn muốn khóa tài khoản "{disableUserName}"? Người dùng này sẽ không thể đăng nhập.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDisableUserId(null); setDisableUserName(""); }}>
              Hủy
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDisable}
            >
              Khóa tài khoản
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
