const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const { AUTH_CONFIG, otpStore, loginAttempts, checkRateLimit } = require('../middleware/auth')

// Login endpoint
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
    
    // Generate OTP
    const otp = crypto.randomInt(100000, 999999).toString()
    const otpToken = crypto.randomBytes(32).toString('hex')
    
    // Store OTP
    otpStore.set(otpToken, {
      otp,
      username,
      expiresAt: Date.now() + AUTH_CONFIG.otpExpiry
    })
    
    // TODO: Send OTP via email/WhatsApp
    console.log(`🔐 OTP for ${username}: ${otp}`)
    
    // Reset login attempts on successful credentials
    loginAttempts.delete(identifier)
    
    res.json({
      success: true,
      otpToken,
      message: 'OTP sent. Check your console/email.',
      // In production, remove this:
      _dev_otp: process.env.NODE_ENV === 'development' ? otp : undefined
    })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
}

// Verify OTP and issue JWT
const verifyOTP = async (req, res) => {
  try {
    const { otpToken, otp } = req.body
    
    const otpData = otpStore.get(otpToken)
    
    if (!otpData) {
      return res.status(401).json({ success: false, error: 'Invalid or expired OTP token' })
    }
    
    // Check expiry
    if (Date.now() > otpData.expiresAt) {
      otpStore.delete(otpToken)
      return res.status(401).json({ success: false, error: 'OTP expired' })
    }
    
    // Verify OTP
    if (otp !== otpData.otp) {
      return res.status(401).json({ success: false, error: 'Invalid OTP' })
    }
    
    // Generate JWT
    const token = jwt.sign(
      { username: otpData.username, role: 'admin' },
      AUTH_CONFIG.jwtSecret,
      { expiresIn: AUTH_CONFIG.jwtExpiry }
    )
    
    // Clear OTP
    otpStore.delete(otpToken)
    
    res.json({
      success: true,
      token,
      user: { username: otpData.username, role: 'admin' }
    })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
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

