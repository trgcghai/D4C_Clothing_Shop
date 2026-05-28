import multer from "multer";

// Sử dụng memoryStorage để lưu file vào RAM tạm thời
const storage = multer.memoryStorage();

// Middleware upload
export const uploadImage = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // Giới hạn file 5MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ hỗ trợ định dạng file ảnh (jpg, png, webp,...)"), false);
    }
  },
});
