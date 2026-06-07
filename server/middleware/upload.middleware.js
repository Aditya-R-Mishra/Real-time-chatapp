/**
 * UPLOAD MIDDLEWARE (Cloudinary + Multer)
 * =======================================
 * Handles file uploads from the client and stores them in Cloudinary.
 * 
 * HOW FILE UPLOADS WORK:
 * 1. Client sends a multipart/form-data request with a file
 * 2. Multer (a Node.js middleware) intercepts the file from the request
 * 3. Instead of saving to local disk, CloudinaryStorage sends it to Cloudinary
 * 4. Cloudinary returns a CDN URL (e.g., https://res.cloudinary.com/...)
 * 5. We store that URL as the message content
 * 
 * WHY CLOUDINARY?
 * - CDN: Files are served from edge servers worldwide (fast!)
 * - Auto-optimization: Images are automatically compressed
 * - Transformations: You can resize, crop, etc. via URL params
 * - Free tier: 25 credits/month, 25GB storage
 * 
 * WHY NOT upload directly from client to Cloudinary?
 * → That would expose your API secret in the client-side code!
 *   Always proxy uploads through your server.
 * 
 * SETUP REQUIRED:
 * Fill in CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 * in your .env file. Get these from your Cloudinary dashboard.
 */

const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary with your credentials
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Create a Cloudinary-backed storage engine for Multer
const storage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => ({
    folder: 'chatapp',  // All uploads go into a "chatapp" folder in Cloudinary
    // Use 'image' resource type for images, 'raw' for everything else (PDFs, docs)
    resource_type: file.mimetype.startsWith('image/') ? 'image' : 'raw',
    // Unique filename: timestamp + original name
    public_id: `${Date.now()}-${file.originalname}`,
  }),
});

// Export the configured multer instance
// limits.fileSize: 10MB max (10 * 1024 * 1024 bytes)
module.exports = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});
