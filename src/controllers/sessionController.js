const qr = require('qr-image')
const { setupSession, deleteSession, reloadSession, validateSession, flushSessions, sessions } = require('../sessions')
const { sendErrorResponse, waitForNestedObject } = require('../utils')

/**
 * Starts a session for the given session ID.
 *
 * @function
 * @async
 * @param {Object} req - The HTTP request object.
 * @param {Object} res - The HTTP response object.
 * @param {string} req.params.sessionId - The session ID to start.
 * @returns {Promise<void>}
 * @throws {Error} If there was an error starting the session.
 */
const startSession = async (req, res) => {
  // #swagger.summary = 'Start new session'
  // #swagger.description = 'Starts a session for the given session ID.'
  try {
    const sessionId = req.params.sessionId
    const setupSessionReturn = setupSession(sessionId)
    if (!setupSessionReturn.success) {
      /* #swagger.responses[422] = {
        description: "Unprocessable Entity.",
        content: {
          "application/json": {
            schema: { "$ref": "#/definitions/ErrorResponse" }
          }
        }
      }
      */
      sendErrorResponse(res, 422, setupSessionReturn.message)
      return
    }
    /* #swagger.responses[200] = {
      description: "Status of the initiated session.",
      content: {
        "application/json": {
          schema: { "$ref": "#/definitions/StartSessionResponse" }
        }
      }
    }
    */
    // wait until the client is created
    waitForNestedObject(setupSessionReturn.client, 'pupPage')
      .then(res.json({ success: true, message: setupSessionReturn.message }))
      .catch((err) => { sendErrorResponse(res, 500, err.message) })
  } catch (error) {
  /* #swagger.responses[500] = {
      description: "Server Failure.",
      content: {
        "application/json": {
          schema: { "$ref": "#/definitions/ErrorResponse" }
        }
      }
    }
    */
    console.log('startSession ERROR', error)
    sendErrorResponse(res, 500, error.message)
  }
}

/**
 * Status of the session with the given session ID.
 *
 * @function
 * @async
 * @param {Object} req - The HTTP request object.
 * @param {Object} res - The HTTP response object.
 * @param {string} req.params.sessionId - The session ID to start.
 * @returns {Promise<void>}
 * @throws {Error} If there was an error getting status of the session.
 */
const statusSession = async (req, res) => {
  // #swagger.summary = 'Get session status'
  // #swagger.description = 'Status of the session with the given session ID.'
  try {
    const sessionId = req.params.sessionId
    const sessionData = await validateSession(sessionId)
    /* #swagger.responses[200] = {
      description: "Status of the session.",
      content: {
        "application/json": {
          schema: { "$ref": "#/definitions/StatusSessionResponse" }
        }
      }
    }
    */
    res.json(sessionData)
  } catch (error) {
    console.log('statusSession ERROR', error)
    /* #swagger.responses[500] = {
      description: "Server Failure.",
      content: {
        "application/json": {
          schema: { "$ref": "#/definitions/ErrorResponse" }
        }
      }
    }
    */
    sendErrorResponse(res, 500, error.message)
  }
}

/**
 * QR code of the session with the given session ID.
 *
 * @function
 * @async
 * @param {Object} req - The HTTP request object.
 * @param {Object} res - The HTTP response object.
 * @param {string} req.params.sessionId - The session ID to start.
 * @returns {Promise<void>}
 * @throws {Error} If there was an error getting status of the session.
 */
const sessionQrCode = async (req, res) => {
  // #swagger.summary = 'Get session QR code'
  // #swagger.description = 'QR code of the session with the given session ID.'
  try {
    const sessionId = req.params.sessionId
    const session = sessions.get(sessionId)
    if (!session) {
      return res.json({ success: false, message: 'session_not_found' })
    }
    if (session.qr) {
      return res.json({ success: true, qr: session.qr })
    }
    return res.json({ success: false, message: 'qr code not ready or already scanned' })
  } catch (error) {
    console.log('sessionQrCode ERROR', error)
    /* #swagger.responses[500] = {
      description: "Server Failure.",
      content: {
        "application/json": {
          schema: { "$ref": "#/definitions/ErrorResponse" }
        }
      }
    }
    */
    sendErrorResponse(res, 500, error.message)
  }
}

/**
 * QR code as image of the session with the given session ID.
 *
 * @function
 * @async
 * @param {Object} req - The HTTP request object.
 * @param {Object} res - The HTTP response object.
 * @param {string} req.params.sessionId - The session ID to start.
 * @returns {Promise<void>}
 * @throws {Error} If there was an error getting status of the session.
 */
const sessionQrCodeImage = async (req, res) => {
  // #swagger.summary = 'Get session QR code as image'
  // #swagger.description = 'QR code as image of the session with the given session ID.'
  try {
    const sessionId = req.params.sessionId
    const session = sessions.get(sessionId)
    if (!session) {
      return res.json({ success: false, message: 'session_not_found' })
    }
    if (session.qr) {
      const qrImage = qr.image(session.qr)
      /* #swagger.responses[200] = {
          description: "QR image.",
          content: {
            "image/png": {}
          }
        }
      */
      res.writeHead(200, {
        'Content-Type': 'image/png'
      })
      return qrImage.pipe(res)
    }
    return res.json({ success: false, message: 'qr code not ready or already scanned' })
  } catch (error) {
    console.log('sessionQrCodeImage ERROR', error)
    /* #swagger.responses[500] = {
      description: "Server Failure.",
      content: {
        "application/json": {
          schema: { "$ref": "#/definitions/ErrorResponse" }
        }
      }
    }
    */
    sendErrorResponse(res, 500, error.message)
  }
}

/**
 * Restarts the session with the given session ID.
 *
 * @function
 * @async
 * @param {Object} req - The HTTP request object.
 * @param {Object} res - The HTTP response object.
 * @param {string} req.params.sessionId - The session ID to terminate.
 * @returns {Promise<void>}
 * @throws {Error} If there was an error terminating the session.
 */
const restartSession = async (req, res) => {
  // #swagger.summary = 'Restart session'
  // #swagger.description = 'Restarts the session with the given session ID.'
  try {
    const sessionId = req.params.sessionId
    const validation = await validateSession(sessionId)
    if (validation.message === 'session_not_found') {
      return res.json(validation)
    }
    await reloadSession(sessionId)
    /* #swagger.responses[200] = {
      description: "Sessions restarted.",
      content: {
        "application/json": {
          schema: { "$ref": "#/definitions/RestartSessionResponse" }
        }
      }
    }
    */
    res.json({ success: true, message: 'Restarted successfully' })
  } catch (error) {
    /* #swagger.responses[500] = {
      description: "Server Failure.",
      content: {
        "application/json": {
          schema: { "$ref": "#/definitions/ErrorResponse" }
        }
      }
    }
    */
    console.log('restartSession ERROR', error)
    sendErrorResponse(res, 500, error.message)
  }
}

/**
 * Terminates the session with the given session ID.
 *
 * @function
 * @async
 * @param {Object} req - The HTTP request object.
 * @param {Object} res - The HTTP response object.
 * @param {string} req.params.sessionId - The session ID to terminate.
 * @returns {Promise<void>}
 * @throws {Error} If there was an error terminating the session.
 */
const terminateSession = async (req, res) => {
  // #swagger.summary = 'Terminate session'
  // #swagger.description = 'Terminates the session with the given session ID.'
  try {
    const sessionId = req.params.sessionId
    const validation = await validateSession(sessionId)
    if (validation.message === 'session_not_found') {
      return res.json(validation)
    }
    await deleteSession(sessionId, validation)
    /* #swagger.responses[200] = {
      description: "Sessions terminated.",
      content: {
        "application/json": {
          schema: { "$ref": "#/definitions/TerminateSessionResponse" }
        }
      }
    }
    */
    res.json({ success: true, message: 'Logged out successfully' })
  } catch (error) {
    /* #swagger.responses[500] = {
      description: "Server Failure.",
      content: {
        "application/json": {
          schema: { "$ref": "#/definitions/ErrorResponse" }
        }
      }
    }
    */
    console.log('terminateSession ERROR', error)
    sendErrorResponse(res, 500, error.message)
  }
}

/**
 * Terminates all inactive sessions.
 *
 * @function
 * @async
 * @param {Object} req - The HTTP request object.
 * @param {Object} res - The HTTP response object.
 * @returns {Promise<void>}
 * @throws {Error} If there was an error terminating the sessions.
 */
const terminateInactiveSessions = async (req, res) => {
  // #swagger.summary = 'Terminate inactive sessions'
  // #swagger.description = 'Terminates all inactive sessions.'
  try {
    await flushSessions(true)
    /* #swagger.responses[200] = {
      description: "Sessions terminated.",
      content: {
        "application/json": {
          schema: { "$ref": "#/definitions/TerminateSessionsResponse" }
        }
      }
    }
    */
    res.json({ success: true, message: 'Flush completed successfully' })
  } catch (error) {
    /* #swagger.responses[500] = {
      description: "Server Failure.",
      content: {
        "application/json": {
          schema: { "$ref": "#/definitions/ErrorResponse" }
        }
      }
    }
    */
    console.log('terminateInactiveSessions ERROR', error)
    sendErrorResponse(res, 500, error.message)
  }
}

/**
 * Terminates all sessions.
 *
 * @function
 * @async
 * @param {Object} req - The HTTP request object.
 * @param {Object} res - The HTTP response object.
 * @returns {Promise<void>}
 * @throws {Error} If there was an error terminating the sessions.
 */
const terminateAllSessions = async (req, res) => {
  // #swagger.summary = 'Terminate all sessions'
  // #swagger.description = 'Terminates all sessions.'
  try {
    await flushSessions(false)
    /* #swagger.responses[200] = {
      description: "Sessions terminated.",
      content: {
        "application/json": {
          schema: { "$ref": "#/definitions/TerminateSessionsResponse" }
        }
      }
    }
    */
    res.json({ success: true, message: 'Flush completed successfully' })
  } catch (error) {
  /* #swagger.responses[500] = {
      description: "Server Failure.",
      content: {
        "application/json": {
          schema: { "$ref": "#/definitions/ErrorResponse" }
        }
      }
    }
    */
    console.log('terminateAllSessions ERROR', error)
    sendErrorResponse(res, 500, error.message)
  }
}

/**
 * Detailed health check for a session.
 * Returns comprehensive information about session state.
 *
 * @function
 * @async
 * @param {Object} req - The HTTP request object.
 * @param {Object} res - The HTTP response object.
 * @param {string} req.params.sessionId - The session ID to check.
 * @returns {Promise<void>}
 */
const healthSession = async (req, res) => {
  // #swagger.summary = 'Get detailed session health'
  // #swagger.description = 'Returns comprehensive health information for the session.'
  try {
    const sessionId = req.params.sessionId
    const session = sessions.get(sessionId)
    
    // Base response
    const healthData = {
      success: false,
      sessionId,
      exists: false,
      state: null,
      isReady: false,
      hasQr: false,
      info: null,
      timestamp: new Date().toISOString()
    }
    
    if (!session) {
      healthData.message = 'Session not found'
      return res.json(healthData)
    }
    
    healthData.exists = true
    healthData.hasQr = !!session.qr
    
    // Try to get session state
    try {
      const state = await session.getState()
      healthData.state = state
      healthData.isReady = state === 'CONNECTED'
      
      if (state === 'CONNECTED') {
        healthData.success = true
        healthData.message = 'Session is healthy and connected'
        
        // Get additional info if connected
        try {
          const info = session.info
          if (info) {
            healthData.info = {
              wid: info.wid?._serialized || null,
              pushname: info.pushname || null,
              platform: info.platform || null
            }
          }
        } catch (infoErr) {
          // Info not available, continue
        }
      } else {
        healthData.message = `Session is in state: ${state}`
      }
    } catch (stateErr) {
      healthData.state = 'UNKNOWN'
      healthData.message = `Unable to get state: ${stateErr.message}`
    }
    
    res.json(healthData)
  } catch (error) {
    console.log('healthSession ERROR', error)
    sendErrorResponse(res, 500, error.message)
  }
}

/**
 * Get all sessions status summary.
 *
 * @function
 * @async
 * @param {Object} req - The HTTP request object.
 * @param {Object} res - The HTTP response object.
 * @returns {Promise<void>}
 */
const allSessionsHealth = async (req, res) => {
  // #swagger.summary = 'Get all sessions health summary'
  // #swagger.description = 'Returns health status for all active sessions.'
  try {
    const sessionsList = []
    
    for (const [sessionId, session] of sessions) {
      const sessionData = {
        sessionId,
        state: null,
        isReady: false,
        hasQr: !!session.qr
      }
      
      try {
        const state = await session.getState()
        sessionData.state = state
        sessionData.isReady = state === 'CONNECTED'
      } catch (e) {
        sessionData.state = 'UNKNOWN'
      }
      
      sessionsList.push(sessionData)
    }
    
    res.json({
      success: true,
      total: sessionsList.length,
      connected: sessionsList.filter(s => s.isReady).length,
      sessions: sessionsList,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.log('allSessionsHealth ERROR', error)
    sendErrorResponse(res, 500, error.message)
  }
}

module.exports = {
  startSession,
  statusSession,
  sessionQrCode,
  sessionQrCodeImage,
  restartSession,
  terminateSession,
  terminateInactiveSessions,
  terminateAllSessions,
  healthSession,
  allSessionsHealth
}
