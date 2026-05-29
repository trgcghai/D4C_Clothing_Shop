import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Upload, FileArchive, Loader2, X, Download, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { importProductsFromZip } from "@/src/services/productApi";

interface ZipImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export default function ZipImportDialog({ open, onOpenChange, onSuccess }: ZipImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>("");
  const [isImporting, setIsImporting] = useState(false);
  const [importErrors, setImportErrors] = useState<Array<{ row: number; field: string; message: string }>>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (f: File) => {
    setFileError("");
    setImportErrors([]);

    if (!f.name.toLowerCase().endsWith(".zip")) {
      setFileError("Chỉ hỗ trợ file .zip");
      return false;
    }
    if (f.size > MAX_FILE_SIZE) {
      setFileError("File ZIP vượt quá 50MB");
      return false;
    }
    return true;
  };

  const handleFileSelect = (f: File) => {
    if (validateFile(f)) {
      setFile(f);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFileSelect(f);
  };

  const handleImport = async () => {
    if (!file) return;
    setIsImporting(true);
    setImportErrors([]);

    try {
      const result = await importProductsFromZip(file);

      if (result.success) {
        toast.success(result.message);
        handleReset();
        onOpenChange(false);
        onSuccess();
      } else {
        setImportErrors(result.errors || []);
        toast.error(result.message);
      }
    } catch {
      toast.error("Có lỗi xảy ra khi import, vui lòng thử lại");
    } finally {
      setIsImporting(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setFileError("");
    setImportErrors([]);
    setIsDragOver(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDownloadSample = () => {
    const link = document.createElement("a");
    link.href = "/sample-product-import.zip";
    link.download = "sample-product-import.zip";
    link.click();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleReset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            <FileArchive className="size-5 text-primary" />
            Import sản phẩm từ ZIP
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Drop Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-all cursor-pointer ${
              isDragOver
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50"
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".zip"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileSelect(f);
                e.target.value = "";
              }}
            />
            <Upload className="size-10 text-muted-foreground mb-3" />
            {file ? (
              <div className="text-center">
                <p className="font-medium text-foreground">{file.name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 text-destructive hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReset();
                  }}
                >
                  <X className="size-3 mr-1" /> Xóa file
                </Button>
              </div>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground">
                  Kéo thả file ZIP vào đây
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Hoặc nhấn để chọn tệp
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  ZIP tối đa 50MB
                </p>
              </>
            )}
          </div>

          {fileError && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertCircle className="size-4" /> {fileError}
            </p>
          )}

          {/* Error Table */}
          {importErrors.length > 0 && (
            <div className="rounded-lg border overflow-hidden">
              <div className="bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive flex items-center gap-2">
                <AlertCircle className="size-4" />
                {importErrors.length} lỗi tìm thấy
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Dòng</TableHead>
                    <TableHead className="w-24">Trường</TableHead>
                    <TableHead>Lỗi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importErrors.map((err, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-sm">
                        {err.row === 0 ? "—" : err.row}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {err.field}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-destructive">
                        {err.message}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Sample Download */}
          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadSample}
              className="gap-1.5"
            >
              <Download className="size-3.5" />
              Tải file mẫu ZIP
            </Button>
            <span className="text-xs text-muted-foreground">
              Bao gồm CSV mẫu và thư mục images/
            </span>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-muted/30">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isImporting}>
            Đóng
          </Button>
          <Button
            onClick={handleImport}
            disabled={!file || !!fileError || isImporting}
          >
            {isImporting && <Loader2 className="mr-2 size-4 animate-spin" />}
            {isImporting ? "Đang import..." : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
