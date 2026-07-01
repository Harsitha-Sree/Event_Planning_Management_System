 
const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error); 
};

// General error handling middleware
const errorHandler = (err, req, res, next) => {
  // Determine the status code: if a status code was set (e.g., 404), use it; otherwise, default to 500
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode);

  res.json({
    message: err.message, // Send the error message
    // In development, send the stack trace for debugging.
    // In production, avoid sending stack trace for security reasons.
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};

module.exports = {
  notFound,
  errorHandler,
};