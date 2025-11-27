// Simple authentication middleware (extend as needed)
const authenticate = (req, res, next) => {
  // Add your authentication logic here
  // For now, we'll allow all requests
  next();
};

module.exports = { authenticate };