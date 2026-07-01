 
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');


dotenv.config();

/**
 * Generates a JSON Web Token for user authentication.
 * @param {string} id - The user's MongoDB ObjectId.
 * @param {string} role - The user's role (e.g., 'organizer', 'vendor', 'admin').
 * @param {string} fullName - The user's full name.
 * @param {string} email - The user's email address.
 * @returns {string} The generated JWT.
 */
const generateToken = (id, role, fullName, email) => {
  return jwt.sign(
    { id, role, fullName, email }, // Payload: essential user info
    process.env.JWT_SECRET,        // Secret key from environment variables
    { expiresIn: '1h' }            // Token expiration time
  );
};

module.exports = generateToken;