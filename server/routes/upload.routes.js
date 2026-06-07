/**
 * UPLOAD ROUTES
 * ==============
 * Handles file upload to Cloudinary.
 * 
 * The flow:
 * 1. Client sends a multipart/form-data request with a file field
 * 2. authMiddleware verifies the user is logged in
 * 3. upload.single('file') tells Multer to expect ONE file in the 'file' field
 * 4. Multer streams the file to Cloudinary
 * 5. req.file is populated with the Cloudinary response (URL, etc.)
 * 6. We return the URL so the client can send it as a message
 */

const router = require('express').Router();
const authMiddleware = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

router.post('/', authMiddleware, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  res.json({
    url: req.file.path,         // Cloudinary CDN URL
    type: req.file.mimetype.startsWith('image/') ? 'image' : 'file',
    filename: req.file.originalname,
  });
});

module.exports = router;
