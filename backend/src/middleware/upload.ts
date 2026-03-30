import multer from "multer";

export const upload = multer({
  storage: multer.memoryStorage(), 
  limits: { fileSize: 6 * 1024 * 1024 }, 
});
