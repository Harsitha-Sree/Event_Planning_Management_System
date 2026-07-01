const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const { errorResponse } = require('./responseFormatter'); // For consistent error handling

const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);

// Base uploads directory
const uploadsDir = path.join(__dirname, '../uploads');

// Create directory structure
const createDirectories = () => {
  const dirs = [
    uploadsDir,
    path.join(uploadsDir, 'event_photos'),
    path.join(uploadsDir, 'vendor_photos'),
    path.join(uploadsDir, 'service_photos')
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

createDirectories();


const storage = multer.memoryStorage();

// File filter to allow only image files
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true); // Accept the file
  } else {
    cb(new Error('Only image files are allowed!'), false); // Reject the file
  }
};

// --- Multer Configurations for Specific Use Cases ---

// 1. For a single event photo upload
const uploadEventPhoto = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB file size limit for event photos
  fileFilter: fileFilter,
}).single('eventPhoto'); // 'eventPhoto' is the expected field name from the frontend form

// 2. For vendor profile with one main photo and multiple service photos
const uploadVendorProfile = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB total file size limit for vendor profile uploads
  fileFilter: fileFilter,
}).fields([
  { name: 'photo', maxCount: 1 },          // Main vendor profile photo field
  { name: 'serviceFiles', maxCount: 10 }, // Array of service photos files (up to 10 photos)
]);

/**
 * Uploads a file buffer to local storage.
 * @param {Buffer} fileBuffer - The buffer of the file to upload.
 * @param {string} folder - The folder to upload to (e.g., 'event_photos', 'vendor_photos', 'service_photos').
 * @param {string} originalname - The original filename.
 * @returns {Promise<object>} A promise that resolves with the upload result (contains secure_url, public_id).
 */
const uploadToCloudinary = async (fileBuffer, folder, originalname = 'file') => {
  try {
    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const extension = path.extname(originalname) || '.jpg';
    const filename = `${timestamp}-${randomString}${extension}`;
    
    // Determine directory
    const targetDir = path.join(uploadsDir, folder);
    
    // Ensure directory exists
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    const filepath = path.join(targetDir, filename);
    
    // Save file
    await writeFileAsync(filepath, fileBuffer);
    
    // Return Cloudinary-like response format for compatibility
    return {
      secure_url: `/uploads/${folder}/${filename}`,
      public_id: `${folder}/${filename}`,
      url: `/uploads/${folder}/${filename}`
    };
  } catch (error) {
    console.error('Local upload error:', error);
    throw new Error('Failed to upload image to local storage');
  }
};

/**
 * Deletes a file from local storage.
 * @param {string} publicId - The public_id (relative path) of the file to delete.
 * @returns {Promise<boolean>} A promise that resolves with true if deleted successfully.
 */
const deleteFromLocal = async (publicId) => {
  try {
    const filepath = path.join(uploadsDir, publicId);
    if (fs.existsSync(filepath)) {
      await unlinkAsync(filepath);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Local delete error:', error);
    throw new Error('Failed to delete file from local storage');
  }
};

/**
 * Middleware wrapper to handle Multer errors gracefully and return standardized API responses.
 * @param {Function} uploadMiddleware - The specific Multer middleware (e.g., uploadEventPhoto, uploadVendorProfile).
 * @returns {Function} An Express middleware function.
 */
const multerErrorHandler = (uploadMiddleware) => (req, res, next) => {
  uploadMiddleware(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return errorResponse(res, 400, `File too large. Maximum allowed size is ${err.field === 'eventPhoto' ? '5MB' : '10MB total'}.`, [{ field: err.field, message: 'File size limit exceeded' }]);
      }
      // Handle other Multer errors (e.g., LIMIT_UNEXPECTED_FILE)
      return errorResponse(res, 400, `Upload error: ${err.message}`, [{ field: err.field || 'unknown', message: err.message }]);
    } else if (err) {
      // General error from fileFilter or other non-Multer-specific upload issues
      return errorResponse(res, 400, err.message, [{ message: err.message }]);
    }
    next(); // No error, proceed to the next middleware/controller
  });
};

module.exports = {
  // Export Multer middleware wrapped with the error handler
  uploadEventPhoto: multerErrorHandler(uploadEventPhoto),
  uploadVendorProfile: multerErrorHandler(uploadVendorProfile),
  uploadToCloudinary, // Export the upload function (now saves locally)
  deleteFromLocal, // Export delete function
};