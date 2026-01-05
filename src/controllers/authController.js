const jwt = require('jsonwebtoken')
const { AUTH_CONFIG, loginAttempts, checkRateLimit } = require('../middleware/auth')

// Login endpoint - returns JWT directly
const login = async (req, res) => {
  try {
    const { username, password } = req.body
    const identifier = req.ip
    
    // Rate limiting
    const rateLimit = checkRateLimit(identifier)
    if (!rateLimit.allowed) {
      return res.status(429).json({ success: false, error: rateLimit.message })
    }
    
    // Validate credentials (from env)
    const validUsername = process.env.ADMIN_USERNAME || 'admin'
    const validPassword = process.env.ADMIN_PASSWORD || 'changeme'
    
    if (username !== validUsername || password !== validPassword) {
      // Increment attempts
      const attempts = loginAttempts.get(identifier) || { count: 0, firstAttempt: Date.now() }
      attempts.count++
      loginAttempts.set(identifier, attempts)
      
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid credentials',
        remainingAttempts: rateLimit.remaining - 1
      })
    }
    
    // Reset login attempts on successful credentials
    loginAttempts.delete(identifier)
    
    // Generate JWT directly (no OTP)
    const token = jwt.sign(
      { username, role: 'admin' },
      AUTH_CONFIG.jwtSecret,
      { expiresIn: AUTH_CONFIG.jwtExpiry }
    )
    
    console.log(`✅ Login successful for ${username}`)
    
    res.json({
      success: true,
      token,
      user: { username, role: 'admin' }
    })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
}

// Verify OTP - kept for backward compatibility but not used
const verifyOTP = async (req, res) => {
  res.status(410).json({ success: false, error: 'OTP verification is disabled' })
}

// Verify token endpoint
const verifyTokenEndpoint = async (req, res) => {
  res.json({
    success: true,
    user: req.user
  })
}

// Logout (client-side token removal)
const logout = async (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' })
}

module.exports = {
  login,
  verifyOTP,
  verifyToken: verifyTokenEndpoint,
  logout
}

