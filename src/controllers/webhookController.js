const fs = require('fs')
const path = require('path')
const { sessions, validateSession } = require('../sessions')

const WEBHOOKS_FILE = path.join(__dirname, '../../sessions/webhooks-data.json')
const HISTORY_FILE = path.join(__dirname, '../../sessions/webhooks-history.json')

// Helper to read webhooks from file
function readWebhooks() {
  try {
    if (fs.existsSync(WEBHOOKS_FILE)) {
      const data = fs.readFileSync(WEBHOOKS_FILE, 'utf8')
      return JSON.parse(data)
    }
  } catch (error) {
    console.error('Error reading webhooks file:', error)
  }
  return []
}

// Helper to write webhooks to file
function writeWebhooks(webhooks) {
  try {
    fs.writeFileSync(WEBHOOKS_FILE, JSON.stringify(webhooks, null, 2))
  } catch (error) {
    console.error('Error writing webhooks file:', error)
  }
}

// Helper to read history from file
function readHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, 'utf8')
      return JSON.parse(data)
    }
  } catch (error) {
    console.error('Error reading history file:', error)
  }
  return []
}

// Helper to add history entry
function addHistory(webhookId, entry) {
  try {
    let history = readHistory()
    
    history.push({
      id: 'hist_' + Date.now(),
      webhookId,
      timestamp: new Date().toISOString(),
      ...entry
    })
    
    // Keep only last 500 entries
    if (history.length > 500) {
      history = history.slice(-500)
    }
    
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2))
  } catch (error) {
    console.error('Error writing history:', error)
  }
}

// Rate limiting check
const rateLimitMap = new Map()

function checkRateLimit(webhookId, limit = 10) {
  const now = Date.now()
  const timeWindow = 60 * 1000 // 1 minute
  
  if (!rateLimitMap.has(webhookId)) {
    rateLimitMap.set(webhookId, [])
  }
  
  const requests = rateLimitMap.get(webhookId)
  
  // Remove old requests
  const validRequests = requests.filter(timestamp => now - timestamp < timeWindow)
  
  if (validRequests.length >= limit) {
    const oldestRequest = Math.min(...validRequests)
    const resetIn = Math.ceil((timeWindow - (now - oldestRequest)) / 1000)
    
    return {
      allowed: false,
      remaining: 0,
      resetIn,
      message: `Rate limit exceeded. Try again in ${resetIn} seconds.`
    }
  }
  
  validRequests.push(now)
  rateLimitMap.set(webhookId, validRequests)
  
  return {
    allowed: true,
    remaining: limit - validRequests.length,
    resetIn: 60
  }
}

// Sync webhooks from frontend localStorage to file
const syncWebhooks = async (req, res) => {
  try {
    const webhooks = req.body
    
    if (!Array.isArray(webhooks)) {
      return res.status(400).json({ success: false, error: 'Invalid webhooks data' })
    }
    
    writeWebhooks(webhooks)
    
    res.json({ success: true, synced: webhooks.length })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
}

// Get webhook history
const getHistory = async (req, res) => {
  try {
    const history = readHistory()
    res.json({ success: true, history })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
}

// Handle incoming webhook request to send message
const handleWebhook = async (req, res) => {
  const webhookId = req.params.webhookId
  const payload = req.body
  
  if (!webhookId) {
    return res.status(400).json({ success: false, error: 'Invalid webhook ID' })
  }
  
  // Validate authorization header
  const authHeader = req.headers.authorization
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    addHistory(webhookId, {
      status: 'error',
      statusCode: 401,
      payload,
      error: 'Missing or invalid Authorization header'
    })
    
    return res.status(401).json({ 
      success: false, 
      error: 'Missing or invalid Authorization header' 
    })
  }
  
  const token = authHeader.split('Bearer ')[1]
  
  // Find webhook
  const webhooks = readWebhooks()
  const webhook = webhooks.find(w => w.id === webhookId)
  
  if (!webhook) {
    addHistory(webhookId, {
      status: 'error',
      statusCode: 404,
      payload,
      error: 'Webhook not found'
    })
    
    return res.status(404).json({ 
      success: false, 
      error: 'Webhook not found' 
    })
  }
  
  // Validate token
  if (webhook.secretToken !== token) {
    addHistory(webhookId, {
      status: 'error',
      statusCode: 401,
      payload,
      error: 'Invalid secret token'
    })
    
    return res.status(401).json({ 
      success: false, 
      error: 'Invalid secret token' 
    })
  }
  
  // Check if webhook is enabled
  if (!webhook.enabled) {
    addHistory(webhookId, {
      status: 'error',
      statusCode: 403,
      payload,
      error: 'Webhook is disabled'
    })
    
    return res.status(403).json({ 
      success: false, 
      error: 'Webhook is disabled' 
    })
  }
  
  // Check rate limit
  const rateLimitCheck = checkRateLimit(webhookId, webhook.rateLimit || 10)
  
  if (!rateLimitCheck.allowed) {
    addHistory(webhookId, {
      status: 'error',
      statusCode: 429,
      payload,
      error: rateLimitCheck.message
    })
    
    res.setHeader('X-RateLimit-Remaining', '0')
    res.setHeader('X-RateLimit-Reset', rateLimitCheck.resetIn.toString())
    return res.status(429).json({ 
      success: false, 
      error: rateLimitCheck.message 
    })
  }
  
  // Validate message
  if (!payload.message || typeof payload.message !== 'string') {
    addHistory(webhookId, {
      status: 'error',
      statusCode: 400,
      payload,
      error: 'Missing or invalid message field'
    })
    
    return res.status(400).json({ 
      success: false, 
      error: 'Missing or invalid message field' 
    })
  }
  
  // Validate chatId format
  const chatId = webhook.chatId
  if (!chatId || (!chatId.endsWith('@c.us') && !chatId.endsWith('@g.us'))) {
    addHistory(webhookId, {
      status: 'error',
      statusCode: 400,
      payload,
      error: 'Invalid chatId format. Must end with @c.us (personal) or @g.us (group)'
    })
    
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid chatId format. Must end with @c.us (personal) or @g.us (group)' 
    })
  }
  
  // Validate session exists and is connected
  const sessionValidation = await validateSession(webhook.sessionId)
  
  if (!sessionValidation.success) {
    let statusCode = 503
    let errorMessage = 'Session not ready'
    
    switch (sessionValidation.message) {
      case 'session_not_found':
        statusCode = 404
        errorMessage = 'Session not found. Please create a new session.'
        break
      case 'session_not_connected':
        statusCode = 503
        errorMessage = `Session not connected. Current state: ${sessionValidation.state || 'unknown'}. Please reconnect.`
        break
      case 'browser tab closed':
      case 'session closed':
        statusCode = 503
        errorMessage = 'Session browser closed. Attempting to reconnect...'
        break
      default:
        errorMessage = sessionValidation.message || 'Session not ready'
    }
    
    addHistory(webhookId, {
      status: 'error',
      statusCode,
      payload,
      error: errorMessage
    })
    
    return res.status(statusCode).json({ 
      success: false, 
      error: errorMessage,
      sessionState: sessionValidation.state
    })
  }
  
  // Get session client (already validated above)
  const client = sessions.get(webhook.sessionId)
  
  try {
    // Send message to WhatsApp
    const message = await client.sendMessage(chatId, payload.message)
    
    addHistory(webhookId, {
      status: 'success',
      statusCode: 200,
      payload,
      response: { messageId: message.id._serialized }
    })
    
    res.setHeader('X-RateLimit-Remaining', rateLimitCheck.remaining.toString())
    res.setHeader('X-RateLimit-Reset', rateLimitCheck.resetIn.toString())
    res.json({ 
      success: true,
      messageId: message.id._serialized,
      webhookId,
      rateLimitRemaining: rateLimitCheck.remaining
    })
    
  } catch (error) {
    addHistory(webhookId, {
      status: 'error',
      statusCode: 500,
      payload,
      error: error.message
    })
    
    res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
}

module.exports = {
  syncWebhooks,
  getHistory,
  handleWebhook
}

