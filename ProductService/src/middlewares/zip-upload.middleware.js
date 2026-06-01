import multer from "multer";

const storage = multer.memoryStorage();

export const uploadZip = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "application/zip",
      "application/x-zip-compressed",
      "application/octet-stream",
    ];
    const isZipExt = file.originalname.toLowerCase().endsWith(".zip");
    if (allowedMimes.includes(file.mimetype) || isZipExt) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ hỗ trợ file ZIP"), false);
    }
  },
});
