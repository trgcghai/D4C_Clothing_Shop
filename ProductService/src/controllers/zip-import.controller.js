import { zipImportService } from "../services/zip-import.service.js";

export const importZipProducts = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: "Vui lòng chọn file ZIP" });
    }

    const result = await zipImportService.importZip(file.buffer);

    if (result.success) {
      return res.status(201).json({
        success: true,
        message: `Import thành công ${result.importedCount} sản phẩm`,
        importedCount: result.importedCount,
      });
    } else {
      return res.status(400).json({
        success: false,
        message: `Import thất bại: ${result.errors.length} lỗi tìm thấy`,
        errors: result.errors,
      });
    }
  } catch (error) {
    if (error.message.includes("Chỉ hỗ trợ file ZIP")) {
      return res.status(415).json({ message: error.message });
    }
    if (error.message.includes("vượt quá")) {
      return res.status(413).json({ message: error.message });
    }
    console.error("Lỗi import ZIP:", error);
    res.status(500).json({ message: "Lỗi server khi import ZIP", error: error.message });
  }
};
