/**
 * UPLOAD MIDDLEWARE (Cloudinary + Local Disk Fallback)
 * ====================================================
 * Handles image, video, and document uploads.
 * If Cloudinary keys are configured, uploads to Cloudinary CDN.
 * If Cloudinary keys are placeholders or not set, safely stores locally in /public/uploads.
 */

const path = require('path');
const fs = require('fs');
const multer = require('multer');

const hasCloudinary = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET &&
  process.env.CLOUDINARY_CLOUD_NAME !== 'your_cloud_name'
);

let storage;

if (hasCloudinary) {
  const cloudinary = require('cloudinary').v2;
  const { CloudinaryStorage } = require('multer-storage-cloudinary');

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  storage = new CloudinaryStorage({
    cloudinary,
    params: (req, file) => {
      let resource_type = 'raw';
      if (file.mimetype.startsWith('image/')) resource_type = 'image';
      else if (file.mimetype.startsWith('video/')) resource_type = 'video';

      return {
        folder: 'chatapp',
        resource_type,
        public_id: `${Date.now()}-${path.parse(file.originalname).name}`,
      };
    },
  });
} else {
  // Ensure local uploads directory exists
  const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const ext = path.extname(file.originalname);
      cb(null, `${uniqueSuffix}${ext}`);
    },
  });
}

module.exports = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max for video & photos
});
