const app = require('./src/app')
const { baseWebhookURL } = require('./src/config')
require('dotenv').config()

// Global error handlers to prevent Node.js from crashing
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err.message)
  console.error(err.stack)
  // Don't exit - try to keep running
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise)
  console.error('Reason:', reason)
  // Don't exit - try to keep running
})

// Start the server
const port = process.env.PORT || 3000

// Check if BASE_WEBHOOK_URL environment variable is available
if (!baseWebhookURL) {
  console.error('BASE_WEBHOOK_URL environment variable is not available. Exiting...')
  process.exit(1) // Terminate the application with an error code
}

app.listen(port, () => {
  console.log(`Server running on port ${port}`)
})
