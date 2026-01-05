const jwt = require('jsonwebtoken')
const crypto = require('crypto')

// Rate limiting storage
const loginAttempts = new Map()

const AUTH_CONFIG = {
  jwtSecret: process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex'),
  jwtExpiry: '24h',
  maxLoginAttempts: 5,
  lockoutDuration: 15 * 60 * 1000 // 15 minutes
}

// Verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  
  if (!token) {
    return res.status(401).json({ success: false, error: 'No token provided' })
  }
  
  try {
    const decoded = jwt.verify(token, AUTH_CONFIG.jwtSecret)
    req.user = decoded
    next()
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Invalid token' })
  }
}

// Rate limiting for login
const checkRateLimit = (identifier) => {
  const attempts = loginAttempts.get(identifier) || { count: 0, firstAttempt: Date.now() }
  
  // Reset if lockout period passed
  if (Date.now() - attempts.firstAttempt > AUTH_CONFIG.lockoutDuration) {
    loginAttempts.delete(identifier)
    return { allowed: true, remaining: AUTH_CONFIG.maxLoginAttempts }
  }
  
  // Check if locked out
  if (attempts.count >= AUTH_CONFIG.maxLoginAttempts) {
    const timeLeft = Math.ceil((AUTH_CONFIG.lockoutDuration - (Date.now() - attempts.firstAttempt)) / 1000 / 60)
    return { allowed: false, remaining: 0, message: `Too many login attempts. Try again in ${timeLeft} minutes.` }
  }
  
  return { allowed: true, remaining: AUTH_CONFIG.maxLoginAttempts - attempts.count }
}

module.exports = {
  verifyToken,
  checkRateLimit,
  AUTH_CONFIG,
  loginAttempts
}

