const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const generateToken = (userId, additionalPayload = {}) => {
  const payload = {
    userId: userId,
    ...additionalPayload
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '15m'
  });
};

const generateRefreshToken = () => {
  return crypto.randomBytes(64).toString('hex');
};

const createRefreshTokenExpiry = () => {
  // Refresh tokens expire in 7 days
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
};

const verifyRefreshToken = (token) => {
  // For refresh tokens, we just check if they exist and are valid format
  // The actual validation is done against the database
  return token && typeof token === 'string' && token.length === 128;
};

module.exports = { 
  generateToken, 
  verifyToken,
  generateRefreshToken,
  createRefreshTokenExpiry,
  verifyRefreshToken
};
