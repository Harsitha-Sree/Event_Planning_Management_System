 
const jwt = require('jsonwebtoken');
const User = require('../models/User'); 


const protect = async (req, res, next) => {
  let token;

  
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Find user by ID from the decoded token payload
      // Select '-password' to exclude password hash from req.user
      const user = await User.findById(decoded.id).select('-password');

      if (!user) {
        res.status(401); // Unauthorized
        throw new Error('User not found');
      }

      // Check user status (prevent suspended/deleted users from accessing protected routes)
      if (user.status === 'suspended') {
        res.status(403); // Forbidden
        throw new Error('Your account has been suspended. Please contact support.');
      }
      if (user.status === 'deleted') {
        res.status(404); // Not Found, or 401 if you want to explicitly say it's gone
        throw new Error('Account not found or has been removed.');
      }

      // Attach the user object to the request
      // Now, any subsequent controller can access `req.user`
      req.user = user;
      next(); // Proceed to the next middleware/controller
    } catch (error) {
      console.error('JWT verification error:', error.message);
      // Specific error messages for different JWT issues
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Authorization failed: Token expired' });
      }
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ message: 'Authorization failed: Invalid token' });
      }
      return res.status(401).json({ message: error.message || 'Not authorized, token failed' });
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};

module.exports = { protect };