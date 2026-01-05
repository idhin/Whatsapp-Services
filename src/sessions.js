const { Client, LocalAuth } = require('whatsapp-web.js')
const fs = require('fs')
const path = require('path')
const sessions = new Map()
const { baseWebhookURL, sessionFolderPath, maxAttachmentSize, setMessagesAsSeen, webVersion, webVersionCacheType, recoverSessions } = require('./config')
const { triggerWebhook, waitForNestedObject, checkIfEventisEnabled } = require('./utils')

// Retry tracking for session recovery
const sessionRetryCount = new Map()
const sessionRestartInProgress = new Map() // Track active restart operations
const MAX_RETRY_ATTEMPTS = 5
const BASE_RETRY_DELAY = 5000 // 5 seconds

// Calculate exponential backoff delay
const getRetryDelay = (retryCount) => {
  // Exponential backoff: 5s, 10s, 20s, 40s, 60s (capped)
  const delay = Math.min(BASE_RETRY_DELAY * Math.pow(2, retryCount), 60000)
  return delay
}

// Get current retry count for a session
const getRetryCount = (sessionId) => {
  return sessionRetryCount.get(sessionId) || 0
}

// Increment retry count
const incrementRetryCount = (sessionId) => {
  const current = getRetryCount(sessionId)
  sessionRetryCount.set(sessionId, current + 1)
  return current + 1
}

// Reset retry count (call when session connects successfully)
const resetRetryCount = (sessionId) => {
  sessionRetryCount.delete(sessionId)
  console.log(`✅ Retry counter reset for session ${sessionId}`)
}

// Function to validate if the session is ready
const validateSession = async (sessionId) => {
  try {
    const returnData = { success: false, state: null, message: '' }

    // Session not Connected 😢
    if (!sessions.has(sessionId) || !sessions.get(sessionId)) {
      returnData.message = 'session_not_found'
      return returnData
    }

    const client = sessions.get(sessionId)
    // wait until the client is created
    await waitForNestedObject(client, 'pupPage')
      .catch((err) => { return { success: false, state: null, message: err.message } })

    // Wait for client.pupPage to be evaluable
    let maxRetry = 0
    while (true) {
      try {
        if (client.pupPage.isClosed()) {
          return { success: false, state: null, message: 'browser tab closed' }
        }
        await Promise.race([
          client.pupPage.evaluate('1'),
          new Promise(resolve => setTimeout(resolve, 1000))
        ])
        break
      } catch (error) {
        if (maxRetry === 2) {
          return { success: false, state: null, message: 'session closed' }
        }
        maxRetry++
      }
    }

    const state = await client.getState()
    returnData.state = state
    if (state !== 'CONNECTED') {
      returnData.message = 'session_not_connected'
      return returnData
    }

    // Session Connected 🎉
    returnData.success = true
    returnData.message = 'session_connected'
    return returnData
  } catch (error) {
    console.log(error)
    return { success: false, state: null, message: error.message }
  }
}

// Function to handle client session restoration
const restoreSessions = () => {
  try {
    if (!fs.existsSync(sessionFolderPath)) {
      fs.mkdirSync(sessionFolderPath) // Create the session directory if it doesn't exist
    }
    // Read the contents of the folder
    fs.readdir(sessionFolderPath, (_, files) => {
      // Iterate through the files in the parent folder
      for (const file of files) {
        // Use regular expression to extract the string from the folder name
        const match = file.match(/^session-(.+)$/)
        if (match) {
          const sessionId = match[1]
          console.log('existing session detected', sessionId)
          setupSession(sessionId)
        }
      }
    })
  } catch (error) {
    console.log(error)
    console.error('Failed to restore sessions:', error)
  }
}

// Setup Session
const setupSession = (sessionId) => {
  try {
    if (sessions.has(sessionId)) {
      return { success: false, message: `Session already exists for: ${sessionId}`, client: sessions.get(sessionId) }
    }

    // Disable the delete folder from the logout function (will be handled separately)
    const localAuth = new LocalAuth({ clientId: sessionId, dataPath: sessionFolderPath })
    delete localAuth.logout
    localAuth.logout = () => { }

    const clientOptions = {
      puppeteer: {
        executablePath: process.env.CHROME_BIN || null,
        // headless: false,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-extensions',
          '--disable-background-networking',
          '--disable-default-apps',
          '--disable-sync',
          '--disable-translate',
          '--metrics-recording-only',
          '--mute-audio',
          '--no-default-browser-check',
          '--safebrowsing-disable-auto-update',
          '--disable-backgrounding-occluded-windows',
          '--disable-breakpad',
          '--disable-component-extensions-with-background-pages',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection',
          '--disable-renderer-backgrounding',
          '--enable-features=NetworkService,NetworkServiceInProcess',
          '--force-color-profile=srgb'
        ]
      },
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
      authStrategy: localAuth
    }

    if (webVersion) {
      clientOptions.webVersion = webVersion
      switch (webVersionCacheType.toLowerCase()) {
        case 'local':
          clientOptions.webVersionCache = {
            type: 'local'
          }
          break
        case 'remote':
          clientOptions.webVersionCache = {
            type: 'remote',
            remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/' + webVersion + '.html'
          }
          break
        default:
          clientOptions.webVersionCache = {
            type: 'none'
          }
      }
    }

    const client = new Client(clientOptions)

    // Handle initialization errors properly
    client.initialize().catch(err => {
      console.log(`❌ Initialize error for ${sessionId}:`, err.message)
      
      // Prevent duplicate restarts
      if (sessionRestartInProgress.get(sessionId)) {
        console.log(`⏳ Session ${sessionId}: Restart already in progress, skipping init error handler...`)
        return
      }
      
      // Check if it's a DNS/network error
      const isNetworkError = err.message.includes('ERR_NAME_NOT_RESOLVED') || 
                             err.message.includes('net::') ||
                             err.message.includes('network')
      
      if (isNetworkError && recoverSessions) {
        sessionRestartInProgress.set(sessionId, true)
        const retryCount = incrementRetryCount(sessionId)
        
        if (retryCount > MAX_RETRY_ATTEMPTS) {
          console.log(`❌ Session ${sessionId}: Max retry attempts (${MAX_RETRY_ATTEMPTS}) reached due to network errors.`)
          console.log(`💡 Check network/DNS settings and restart manually.`)
          sessions.delete(sessionId)
          sessionRestartInProgress.delete(sessionId)
          return
        }
        
        // Use longer delay for network errors (minimum 30 seconds)
        const delay = Math.max(30000, getRetryDelay(retryCount - 1))
        console.log(`🌐 Session ${sessionId}: Network error detected. Retry ${retryCount}/${MAX_RETRY_ATTEMPTS} in ${delay/1000}s...`)
        
        setTimeout(async () => {
          sessions.delete(sessionId)
          await client.destroy().catch(() => {})
          sessionRestartInProgress.delete(sessionId)
          setupSession(sessionId)
        }, delay)
      }
    })

    initializeEvents(client, sessionId)

    // Save the session to the Map
    sessions.set(sessionId, client)
    return { success: true, message: 'Session initiated successfully', client }
  } catch (error) {
    return { success: false, message: error.message, client: null }
  }
}

const initializeEvents = (client, sessionId) => {
  // check if the session webhook is overridden
  // Normalize session ID: replace hyphens with underscores for env variable lookup
  // Session "CASANEIRA-WA" -> env variable "CASANEIRA_WA_WEBHOOK_URL"
  const normalizedSessionId = sessionId.toUpperCase().replace(/-/g, '_')
  const sessionWebhook = process.env[normalizedSessionId + '_WEBHOOK_URL'] || baseWebhookURL

  if (recoverSessions) {
    waitForNestedObject(client, 'pupPage').then(() => {
      const restartSessionWithRetry = async (sessionId, reason) => {
        // Prevent duplicate restart attempts using shared flag
        if (sessionRestartInProgress.get(sessionId)) {
          console.log(`⏳ Session ${sessionId}: Restart already in progress, skipping ${reason}...`)
          return
        }
        sessionRestartInProgress.set(sessionId, true)
        
        const retryCount = incrementRetryCount(sessionId)
        
        if (retryCount > MAX_RETRY_ATTEMPTS) {
          console.log(`❌ Session ${sessionId}: Max retry attempts (${MAX_RETRY_ATTEMPTS}) reached. Stopping auto-recovery.`)
          console.log(`💡 To restart manually: Use the dashboard or restart the container.`)
          sessions.delete(sessionId)
          sessionRestartInProgress.delete(sessionId)
          return
        }
        
        const delay = getRetryDelay(retryCount - 1)
        console.log(`🔄 Session ${sessionId}: ${reason}. Retry ${retryCount}/${MAX_RETRY_ATTEMPTS} in ${delay/1000}s...`)
        
        // Clean up
        sessions.delete(sessionId)
        await client.destroy().catch(e => { })
        
        // Wait before retry
        setTimeout(() => {
          console.log(`🚀 Attempting to restart session ${sessionId}...`)
          sessionRestartInProgress.delete(sessionId)
          setupSession(sessionId)
        }, delay)
      }
      
      client.pupPage.once('close', function () {
        restartSessionWithRetry(sessionId, 'Browser page closed')
      })
      client.pupPage.once('error', function () {
        restartSessionWithRetry(sessionId, 'Browser page error')
      })
    }).catch(e => { })
  }

  checkIfEventisEnabled('auth_failure')
    .then(_ => {
      client.on('auth_failure', (msg) => {
        triggerWebhook(sessionWebhook, sessionId, 'status', { msg })
      })
    })

  checkIfEventisEnabled('authenticated')
    .then(_ => {
      client.on('authenticated', () => {
        triggerWebhook(sessionWebhook, sessionId, 'authenticated')
      })
    })

  checkIfEventisEnabled('call')
    .then(_ => {
      client.on('call', async (call) => {
        triggerWebhook(sessionWebhook, sessionId, 'call', { call })
      })
    })

  checkIfEventisEnabled('change_state')
    .then(_ => {
      client.on('change_state', state => {
        triggerWebhook(sessionWebhook, sessionId, 'change_state', { state })
      })
    })

  // Handle disconnected event - trigger webhook and auto-reconnect if enabled
  client.on('disconnected', (reason) => {
    console.log(`⚠️ Session ${sessionId} disconnected. Reason: ${reason}`)
    
    // Trigger webhook for disconnected event
    checkIfEventisEnabled('disconnected').then(_ => {
      triggerWebhook(sessionWebhook, sessionId, 'disconnected', { reason })
    })
    
    // Auto-reconnect if enabled and not a manual logout
    if (recoverSessions && reason !== 'LOGOUT') {
      // Prevent duplicate restart attempts
      if (sessionRestartInProgress.get(sessionId)) {
        console.log(`⏳ Session ${sessionId}: Restart already in progress, skipping disconnect handler...`)
        return
      }
      sessionRestartInProgress.set(sessionId, true)
      
      const retryCount = incrementRetryCount(sessionId)
      
      if (retryCount > MAX_RETRY_ATTEMPTS) {
        console.log(`❌ Session ${sessionId}: Max retry attempts (${MAX_RETRY_ATTEMPTS}) reached after disconnect. Stopping auto-recovery.`)
        console.log(`💡 To restart manually: Use the dashboard or restart the container.`)
        sessions.delete(sessionId)
        sessionRestartInProgress.delete(sessionId)
        return
      }
      
      const delay = getRetryDelay(retryCount - 1)
      console.log(`🔄 Session ${sessionId}: Auto-reconnect retry ${retryCount}/${MAX_RETRY_ATTEMPTS} in ${delay/1000}s...`)
      
      setTimeout(async () => {
        try {
          // Clean up existing session
          sessions.delete(sessionId)
          await client.destroy().catch(e => {
            console.log(`Destroy error for ${sessionId}:`, e.message)
          })
          
          // Restart session
          console.log(`🚀 Restarting session ${sessionId}...`)
          sessionRestartInProgress.delete(sessionId)
          setupSession(sessionId)
        } catch (error) {
          console.error(`❌ Failed to reconnect session ${sessionId}:`, error.message)
          sessionRestartInProgress.delete(sessionId)
        }
      }, delay)
    }
  })

  checkIfEventisEnabled('group_join')
    .then(_ => {
      client.on('group_join', (notification) => {
        triggerWebhook(sessionWebhook, sessionId, 'group_join', { notification })
      })
    })

  checkIfEventisEnabled('group_leave')
    .then(_ => {
      client.on('group_leave', (notification) => {
        triggerWebhook(sessionWebhook, sessionId, 'group_leave', { notification })
      })
    })

  checkIfEventisEnabled('group_update')
    .then(_ => {
      client.on('group_update', (notification) => {
        triggerWebhook(sessionWebhook, sessionId, 'group_update', { notification })
      })
    })

  checkIfEventisEnabled('loading_screen')
    .then(_ => {
      client.on('loading_screen', (percent, message) => {
        triggerWebhook(sessionWebhook, sessionId, 'loading_screen', { percent, message })
      })
    })

  checkIfEventisEnabled('media_uploaded')
    .then(_ => {
      client.on('media_uploaded', (message) => {
        triggerWebhook(sessionWebhook, sessionId, 'media_uploaded', { message })
      })
    })

  checkIfEventisEnabled('message')
    .then(_ => {
      client.on('message', async (message) => {
        triggerWebhook(sessionWebhook, sessionId, 'message', { message })
        if (message.hasMedia && message._data?.size < maxAttachmentSize) {
          // custom service event
          checkIfEventisEnabled('media').then(_ => {
            message.downloadMedia().then(messageMedia => {
              triggerWebhook(sessionWebhook, sessionId, 'media', { messageMedia, message })
            }).catch(e => {
              console.log('Download media error:', e.message)
            })
          })
        }
        if (setMessagesAsSeen) {
          const chat = await message.getChat()
          chat.sendSeen()
        }
      })
    })

  checkIfEventisEnabled('message_ack')
    .then(_ => {
      client.on('message_ack', async (message, ack) => {
        triggerWebhook(sessionWebhook, sessionId, 'message_ack', { message, ack })
        if (setMessagesAsSeen) {
          const chat = await message.getChat()
          chat.sendSeen()
        }
      })
    })

  checkIfEventisEnabled('message_create')
    .then(_ => {
      client.on('message_create', async (message) => {
        triggerWebhook(sessionWebhook, sessionId, 'message_create', { message })
        if (setMessagesAsSeen) {
          const chat = await message.getChat()
          chat.sendSeen()
        }
      })
    })

  checkIfEventisEnabled('message_reaction')
    .then(_ => {
      client.on('message_reaction', (reaction) => {
        triggerWebhook(sessionWebhook, sessionId, 'message_reaction', { reaction })
      })
    })

  checkIfEventisEnabled('message_edit')
    .then(_ => {
      client.on('message_edit', (message, newBody, prevBody) => {
        triggerWebhook(sessionWebhook, sessionId, 'message_edit', { message, newBody, prevBody })
      })
    })

  checkIfEventisEnabled('message_ciphertext')
    .then(_ => {
      client.on('message_ciphertext', (message) => {
        triggerWebhook(sessionWebhook, sessionId, 'message_ciphertext', { message })
      })
    })

  checkIfEventisEnabled('message_revoke_everyone')
    .then(_ => {
      // eslint-disable-next-line camelcase
      client.on('message_revoke_everyone', async (message) => {
        // eslint-disable-next-line camelcase
        triggerWebhook(sessionWebhook, sessionId, 'message_revoke_everyone', { message })
      })
    })

  checkIfEventisEnabled('message_revoke_me')
    .then(_ => {
      client.on('message_revoke_me', async (message) => {
        triggerWebhook(sessionWebhook, sessionId, 'message_revoke_me', { message })
      })
    })

  client.on('qr', (qr) => {
    // inject qr code into session
    client.qr = qr
    checkIfEventisEnabled('qr')
      .then(_ => {
        triggerWebhook(sessionWebhook, sessionId, 'qr', { qr })
      })
  })

  // Ready event - session connected successfully
  client.on('ready', () => {
    console.log(`✅ Session ${sessionId} is ready and connected!`)
    // Reset retry counter on successful connection
    resetRetryCount(sessionId)
    sessionRestartInProgress.delete(sessionId)
    
    checkIfEventisEnabled('ready').then(_ => {
      triggerWebhook(sessionWebhook, sessionId, 'ready')
    })
  })

  checkIfEventisEnabled('contact_changed')
    .then(_ => {
      client.on('contact_changed', async (message, oldId, newId, isContact) => {
        triggerWebhook(sessionWebhook, sessionId, 'contact_changed', { message, oldId, newId, isContact })
      })
    })

  checkIfEventisEnabled('chat_removed')
    .then(_ => {
      client.on('chat_removed', async (chat) => {
        triggerWebhook(sessionWebhook, sessionId, 'chat_removed', { chat })
      })
    })

  checkIfEventisEnabled('chat_archived')
    .then(_ => {
      client.on('chat_archived', async (chat, currState, prevState) => {
        triggerWebhook(sessionWebhook, sessionId, 'chat_archived', { chat, currState, prevState })
      })
    })

  checkIfEventisEnabled('unread_count')
    .then(_ => {
      client.on('unread_count', async (chat) => {
        triggerWebhook(sessionWebhook, sessionId, 'unread_count', { chat })
      })
    })
}

// Function to delete client session folder
const deleteSessionFolder = async (sessionId) => {
  try {
    const targetDirPath = path.join(sessionFolderPath, `session-${sessionId}`)
    const resolvedTargetDirPath = await fs.promises.realpath(targetDirPath)
    const resolvedSessionPath = await fs.promises.realpath(sessionFolderPath)

    // Ensure the target directory path ends with a path separator
    const safeSessionPath = `${resolvedSessionPath}${path.sep}`

    // Validate the resolved target directory path is a subdirectory of the session folder path
    if (!resolvedTargetDirPath.startsWith(safeSessionPath)) {
      throw new Error('Invalid path: Directory traversal detected')
    }
    await fs.promises.rm(resolvedTargetDirPath, { recursive: true, force: true })
  } catch (error) {
    console.log('Folder deletion error', error)
    throw error
  }
}

// Function to reload client session without removing browser cache
const reloadSession = async (sessionId) => {
  try {
    const client = sessions.get(sessionId)
    if (!client) {
      // Client not in map, just setup new session
      setupSession(sessionId)
      return
    }
    
    // Add null checks for pupPage and pupBrowser
    if (client.pupPage) {
      client.pupPage.removeAllListeners('close')
      client.pupPage.removeAllListeners('error')
    }
    
    if (client.pupBrowser) {
      try {
        const pages = await client.pupBrowser.pages()
        await Promise.all(pages.map((page) => page.close()))
        await Promise.race([
          client.pupBrowser.close(),
          new Promise(resolve => setTimeout(resolve, 5000))
        ])
      } catch (e) {
        // Try to kill the process if browser close fails
        try {
          const childProcess = client.pupBrowser.process()
          if (childProcess) {
            childProcess.kill(9)
          }
        } catch (killError) {
          console.log('Failed to kill browser process:', killError.message)
        }
      }
    }
    
    sessions.delete(sessionId)
    setupSession(sessionId)
  } catch (error) {
    console.log('reloadSession error:', error.message)
    // Don't throw - just log and try to continue
    sessions.delete(sessionId)
    setupSession(sessionId)
  }
}

const deleteSession = async (sessionId, validation) => {
  try {
    const client = sessions.get(sessionId)
    if (!client) {
      // No client in map, just try to delete the folder
      await deleteSessionFolder(sessionId).catch(() => {})
      return
    }
    
    // Add null checks for pupPage
    if (client.pupPage) {
      client.pupPage.removeAllListeners('close')
      client.pupPage.removeAllListeners('error')
    }
    
    if (validation.success) {
      // Client Connected, request logout
      console.log(`Logging out session ${sessionId}`)
      await client.logout().catch(e => console.log('Logout error:', e.message))
    } else if (validation.message === 'session_not_connected') {
      // Client not Connected, request destroy
      console.log(`Destroying session ${sessionId}`)
      await client.destroy().catch(e => console.log('Destroy error:', e.message))
    }
    
    // Wait 10 secs for client.pupBrowser to be disconnected before deleting the folder
    if (client.pupBrowser) {
      let maxDelay = 0
      while (client.pupBrowser.isConnected() && (maxDelay < 10)) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        maxDelay++
      }
    }
    
    await deleteSessionFolder(sessionId).catch(e => console.log('Delete folder error:', e.message))
    sessions.delete(sessionId)
  } catch (error) {
    console.log('deleteSession error:', error.message)
    // Still try to clean up
    sessions.delete(sessionId)
    throw error
  }
}

// Function to handle session flush
const flushSessions = async (deleteOnlyInactive) => {
  try {
    // Read the contents of the sessions folder
    const files = await fs.promises.readdir(sessionFolderPath)
    // Iterate through the files in the parent folder
    for (const file of files) {
      // Use regular expression to extract the string from the folder name
      const match = file.match(/^session-(.+)$/)
      if (match) {
        const sessionId = match[1]
        const validation = await validateSession(sessionId)
        if (!deleteOnlyInactive || !validation.success) {
          await deleteSession(sessionId, validation)
        }
      }
    }
  } catch (error) {
    console.log(error)
    throw error
  }
}

module.exports = {
  sessions,
  setupSession,
  restoreSessions,
  validateSession,
  deleteSession,
  reloadSession,
  flushSessions,
  resetRetryCount,
  getRetryCount
}
