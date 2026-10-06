/**
 * UPLOAD ROUTES
 * ==============
 * Handles photo, video, and file uploads.
 */

const router = require('express').Router();
const authMiddleware = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

router.post('/', authMiddleware, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // Determine URL: if Cloudinary, req.file.path starts with http. Otherwise local path /uploads/filename
  let fileUrl = req.file.path;
  if (!fileUrl.startsWith('http')) {
    fileUrl = `/uploads/${req.file.filename}`;
  }

  const mime = req.file.mimetype || '';
  let fileType = 'file';
  if (mime.startsWith('image/')) {
    fileType = 'image';
  } else if (mime.startsWith('video/')) {
    fileType = 'video';
  }

  res.json({
    url: fileUrl,
    type: fileType,
    filename: req.file.originalname,
    mimetype: mime,
    size: req.file.size,
  });
});

module.exports = router;
