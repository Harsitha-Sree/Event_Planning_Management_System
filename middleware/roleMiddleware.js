 
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ message: 'Not authorized: User role not found' });
    }

    if (allowedRoles.includes(req.user.role)) {
      next(); // User has the required role, proceed to the next middleware/controller
    } else {
      // User does not have the required role
      res.status(403).json({ message: 'Forbidden: You do not have permission to access this resource' });
    }
  };
};

module.exports = { authorizeRoles };