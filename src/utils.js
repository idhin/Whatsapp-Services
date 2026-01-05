const axios = require('axios')
const { globalApiKey, disabledCallbacks } = require('./config')

// Track webhook errors to avoid spamming logs
const webhookErrorCount = new Map()
const WEBHOOK_ERROR_LOG_THRESHOLD = 5 // Only log every N errors per session+dataType

// Trigger webhook endpoint with improved error handling
const triggerWebhook = (webhookURL, sessionId, dataType, data) => {
  // Skip if no webhook URL configured
  if (!webhookURL) {
    return
  }

  axios.post(webhookURL, { dataType, data, sessionId }, { 
    headers: { 'x-api-key': globalApiKey },
    timeout: 10000 // 10 second timeout
  })
    .then(() => {
      // Reset error count on success
      const errorKey = `${sessionId}_${dataType}`
      if (webhookErrorCount.has(errorKey)) {
        webhookErrorCount.delete(errorKey)
      }
    })
    .catch(error => {
      const errorKey = `${sessionId}_${dataType}`
      const count = (webhookErrorCount.get(errorKey) || 0) + 1
      webhookErrorCount.set(errorKey, count)
      
      // Only log every N errors to reduce spam
      if (count === 1 || count % WEBHOOK_ERROR_LOG_THRESHOLD === 0) {
        const errorMsg = error.response?.status 
          ? `HTTP ${error.response.status}` 
          : error.message
        console.warn(`⚠️ Webhook failed [${sessionId}/${dataType}]: ${errorMsg} (error #${count})`)
        
        if (count === 1) {
          console.warn(`   💡 Check your webhook URL: ${webhookURL}`)
        }
      }
    })
}

// Function to send a response with error status and message
const sendErrorResponse = (res, status, message) => {
  res.status(status).json({ success: false, error: message })
}

// Function to wait for a specific item not to be null
const waitForNestedObject = (rootObj, nestedPath, maxWaitTime = 10000, interval = 100) => {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const checkObject = () => {
      const nestedObj = nestedPath.split('.').reduce((obj, key) => obj ? obj[key] : undefined, rootObj)
      if (nestedObj) {
        // Nested object exists, resolve the promise
        resolve()
      } else if (Date.now() - start > maxWaitTime) {
        // Maximum wait time exceeded, reject the promise
        console.log('Timed out waiting for nested object')
        reject(new Error('Timeout waiting for nested object'))
      } else {
        // Nested object not yet created, continue waiting
        setTimeout(checkObject, interval)
      }
    }
    checkObject()
  })
}

const checkIfEventisEnabled = (event) => {
  return new Promise((resolve, reject) => { if (!disabledCallbacks.includes(event)) { resolve() } })
}

module.exports = {
  triggerWebhook,
  sendErrorResponse,
  waitForNestedObject,
  checkIfEventisEnabled
}
