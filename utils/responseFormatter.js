 
const successResponse = (res, statusCode, message, data = null) => {
  res.status(statusCode).json({
    success: true,
    message: message,
    data: data,
  });
};

/**
 * Sends a standardized error API response.
 * @param {object} res - The Express response object.
 * @param {number} statusCode - The HTTP status code (e.g., 400, 401, 403, 404, 500).
 * @param {string} errorMessage - A human-readable error message.
 * @param {Array|null} errors - An optional array of specific error details (e.g., validation errors).
 */
const errorResponse = (res, statusCode, errorMessage, errors = null) => {
  res.status(statusCode).json({
    success: false,
    message: errorMessage,
    errors: errors,
    // In development, you might add a stack trace here, similar to errorHandler.js
    // stack: process.env.NODE_ENV === 'production' ? null : new Error().stack,
  });
};

module.exports = {
  successResponse,
  errorResponse,
};