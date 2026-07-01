const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const http = require('http'); // Required to create HTTP server for Socket.IO
const path = require('path'); // Required for serving static files

// --- Load environment variables from .env file FIRST ---
dotenv.config();

// --- Configuration Imports ---
const connectDB = require('./config/db'); // MongoDB connection

// --- Middleware Imports ---
const { notFound, errorHandler } = require('./middleware/errorHandler'); // Custom error handlers

// --- Socket.IO Import ---
const initSocket = require('./socket'); // Socket.IO server initialization

// --- Route Imports ---
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const organizerRoutes = require('./routes/organizerRoutes');
const vendorRoutes = require('./routes/vendorRoutes');
const eventRoutes = require('./routes/eventRoutes');
const messageRoutes = require('./routes/messageRoutes');

// --- Connect to MongoDB database ---
connectDB();

// --- Initialize Express App ---
const app = express();

// --- Create an HTTP server from the Express app (required for Socket.IO) ---
const server = http.createServer(app);

// --- Initialize Socket.IO and attach it to the HTTP server ---
// The returned `io` instance can be stored on the app object for access in controllers
const io = initSocket(server);
app.set('socketio', io); // Makes `io` instance accessible via `req.app.get('socketio')` in Express routes

// --- Global Middleware ---

// Debug: Check if env variables are loaded
console.log('EMAIL_HOST:', process.env.EMAIL_HOST);
console.log('EMAIL_PORT:', process.env.EMAIL_PORT);
console.log('EMAIL_USER:', process.env.EMAIL_USER);

// 1. Body parser for JSON data
app.use(express.json());

// 2. Body parser for URL-encoded data
app.use(express.urlencoded({ extended: true }));

// 3. CORS (Cross-Origin Resource Sharing)
//    In production, specify your actual frontend domain(s) instead of '*' for security.
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? 'http://yourproductionfrontend.com' : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  credentials: true, // If you're using cookies/sessions with CORS
}));

// 4. Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- API Routes (MUST BE BEFORE CATCH-ALL ROUTES) ---
// Mount your API route modules under their respective base paths
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/organizer', organizerRoutes);
app.use('/api/vendor', vendorRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/messages', messageRoutes);

// Debug: Log all registered API routes (optional - remove in production)
console.log('\n=== REGISTERED API ROUTES ===');
console.log('✓ /api/auth');
console.log('✓ /api/admin');
console.log('✓ /api/organizer');
console.log('✓ /api/vendor');
console.log('✓ /api/events');
console.log('✓ /api/messages');
console.log('=============================\n');

// --- Serve Static Frontend Files ---
// Serve files from the 'public' directory
// This allows clients to request HTML, CSS, JS, images directly from `backend/public`
app.use(express.static(path.join(__dirname, 'public')));

// --- Fallback for Frontend Routing (Catch-all for non-API routes) ---
// IMPORTANT: This must come AFTER API routes but BEFORE error handlers
app.get('*', (req, res, next) => {
  // If it's an API route that didn't match any defined endpoints,
  // pass it to the next middleware (which will be the notFound handler)
  if (req.originalUrl.startsWith('/api')) {
    console.log(`⚠️  Unmatched API route: ${req.method} ${req.originalUrl}`);
    return next(); // Pass to notFound middleware
  }
  
  // For any other non-API route, if express.static didn't find a direct file,
  // we serve the main index.html for client-side routing.
  // This ensures all frontend paths (like /organizer/events.html) gracefully load the app.
  res.sendFile(path.resolve(__dirname, 'public', 'index.html'));
});

// --- Error Handling Middleware (MUST BE LAST) ---
// These must be placed after all other app.use() and app.get() calls

// 1. 404 Handler - Catches unmatched routes
app.use(notFound);

// 2. General Error Handler - Catches all other errors
app.use(errorHandler);

// --- Define the port for the server to listen on ---
const PORT = process.env.PORT || 5000;

// --- Start the HTTP server (which also hosts the Socket.IO server) ---
server.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log(`🚀 Server running in ${process.env.NODE_ENV || 'development'} mode`);
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌐 Access: http://localhost:${PORT}`);
  console.log(`💾 Database: ${process.env.MONGO_URI ? 'Connected' : 'Not configured'}`);
  console.log('='.repeat(50));
});