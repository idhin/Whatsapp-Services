const express = require('express')
const routes = express.Router()
const swaggerUi = require('swagger-ui-express')
const swaggerDocument = require('../swagger.json')
const { enableLocalCallbackExample, enableSwaggerEndpoint } = require('./config')

const middleware = require('./middleware')
const authMiddleware = require('./middleware/auth')
const healthController = require('./controllers/healthController')
const authController = require('./controllers/authController')
const sessionController = require('./controllers/sessionController')
const clientController = require('./controllers/clientController')
const chatController = require('./controllers/chatController')
const groupChatController = require('./controllers/groupChatController')
const messageController = require('./controllers/messageController')
const contactController = require('./controllers/contactController')
const webhookController = require('./controllers/webhookController')

/**
 * ================
 * HEALTH ENDPOINTS
 * ================
 */

// API endpoint to check if server is alive
routes.get('/ping', healthController.ping)
// API basic callback
if (enableLocalCallbackExample) {
  routes.post('/localCallbackExample', [middleware.apikey, middleware.rateLimiter], healthController.localCallbackExample)
}

/**
 * ================
 * AUTH ENDPOINTS
 * ================
 */

// Public auth routes (no authentication required)
routes.post('/api/auth/login', authController.login)
routes.post('/api/auth/verify-otp', authController.verifyOTP)
routes.post('/api/auth/logout', authController.logout)

// Protected auth route
routes.get('/api/auth/verify', authMiddleware.verifyToken, authController.verifyToken)

/**
 * ================
 * SESSION ENDPOINTS
 * ================
 */
const sessionRouter = express.Router()
sessionRouter.use(authMiddleware.verifyToken)
sessionRouter.use(middleware.apikey)
sessionRouter.use(middleware.sessionSwagger)
routes.use('/session', sessionRouter)

sessionRouter.get('/start/:sessionId', middleware.sessionNameValidation, sessionController.startSession)
sessionRouter.get('/status/:sessionId', middleware.sessionNameValidation, sessionController.statusSession)
sessionRouter.get('/qr/:sessionId', middleware.sessionNameValidation, sessionController.sessionQrCode)
sessionRouter.get('/qr/:sessionId/image', middleware.sessionNameValidation, sessionController.sessionQrCodeImage)
sessionRouter.get('/restart/:sessionId', middleware.sessionNameValidation, sessionController.restartSession)
sessionRouter.get('/terminate/:sessionId', middleware.sessionNameValidation, sessionController.terminateSession)
sessionRouter.get('/terminateInactive', sessionController.terminateInactiveSessions)
sessionRouter.get('/terminateAll', sessionController.terminateAllSessions)

/**
 * ================
 * CLIENT ENDPOINTS
 * ================
 */

const clientRouter = express.Router()
clientRouter.use(authMiddleware.verifyToken)
clientRouter.use(middleware.apikey)
clientRouter.use(middleware.clientSwagger)
routes.use('/client', clientRouter)

clientRouter.get('/getClassInfo/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.getClassInfo)
clientRouter.post('/acceptInvite/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.acceptInvite)
clientRouter.post('/archiveChat/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.archiveChat)
clientRouter.post('/createGroup/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.createGroup)
clientRouter.post('/getBlockedContacts/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.getBlockedContacts)
clientRouter.post('/getChatById/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.getChatById)
clientRouter.post('/getChatLabels/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.getChatLabels)
clientRouter.get('/getChats/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.getChats)
clientRouter.post('/getChatsByLabelId/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.getChatsByLabelId)
clientRouter.post('/getCommonGroups/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.getCommonGroups)
clientRouter.post('/getContactById/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.getContactById)
clientRouter.get('/getContacts/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.getContacts)
clientRouter.post('/getInviteInfo/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.getInviteInfo)
clientRouter.post('/getLabelById/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.getLabelById)
clientRouter.post('/getLabels/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.getLabels)
clientRouter.post('/addOrRemoveLabels/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.addOrRemoveLabels)
clientRouter.post('/getNumberId/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.getNumberId)
clientRouter.post('/isRegisteredUser/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.isRegisteredUser)
clientRouter.post('/getProfilePicUrl/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.getProfilePictureUrl)
clientRouter.get('/getState/:sessionId', [middleware.sessionNameValidation], clientController.getState)
clientRouter.post('/markChatUnread/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.markChatUnread)
clientRouter.post('/muteChat/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.muteChat)
clientRouter.post('/pinChat/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.pinChat)
clientRouter.post('/searchMessages/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.searchMessages)
clientRouter.post('/sendMessage/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.sendMessage)
clientRouter.post('/sendPresenceAvailable/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.sendPresenceAvailable)
clientRouter.post('/sendPresenceUnavailable/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.sendPresenceUnavailable)
clientRouter.post('/sendSeen/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.sendSeen)
clientRouter.post('/setDisplayName/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.setDisplayName)
clientRouter.post('/setProfilePicture/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.setProfilePicture)
clientRouter.post('/setStatus/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.setStatus)
clientRouter.post('/unarchiveChat/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.unarchiveChat)
clientRouter.post('/unmuteChat/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.unmuteChat)
clientRouter.post('/unpinChat/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.unpinChat)
clientRouter.get('/getWWebVersion/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.getWWebVersion)

/**
 * ================
 * CHAT ENDPOINTS
 * ================
 */
const chatRouter = express.Router()
chatRouter.use(authMiddleware.verifyToken)
chatRouter.use(middleware.apikey)
chatRouter.use(middleware.chatSwagger)
routes.use('/chat', chatRouter)

chatRouter.post('/getClassInfo/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], chatController.getClassInfo)
chatRouter.post('/clearMessages/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], chatController.clearMessages)
chatRouter.post('/clearState/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], chatController.clearState)
chatRouter.post('/delete/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], chatController.deleteChat)
chatRouter.post('/fetchMessages/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], chatController.fetchMessages)
chatRouter.post('/getContact/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], chatController.getContact)
chatRouter.post('/sendStateRecording/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], chatController.sendStateRecording)
chatRouter.post('/sendStateTyping/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], chatController.sendStateTyping)

/**
 * ================
 * GROUP CHAT ENDPOINTS
 * ================
 */
const groupChatRouter = express.Router()
groupChatRouter.use(authMiddleware.verifyToken)
groupChatRouter.use(middleware.apikey)
groupChatRouter.use(middleware.groupChatSwagger)
routes.use('/groupChat', groupChatRouter)

groupChatRouter.post('/getClassInfo/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], groupChatController.getClassInfo)
groupChatRouter.post('/addParticipants/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], groupChatController.addParticipants)
groupChatRouter.post('/demoteParticipants/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], groupChatController.demoteParticipants)
groupChatRouter.post('/getInviteCode/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], groupChatController.getInviteCode)
groupChatRouter.post('/leave/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], groupChatController.leave)
groupChatRouter.post('/promoteParticipants/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], groupChatController.promoteParticipants)
groupChatRouter.post('/removeParticipants/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], groupChatController.removeParticipants)
groupChatRouter.post('/revokeInvite/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], groupChatController.revokeInvite)
groupChatRouter.post('/setDescription/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], groupChatController.setDescription)
groupChatRouter.post('/setInfoAdminsOnly/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], groupChatController.setInfoAdminsOnly)
groupChatRouter.post('/setMessagesAdminsOnly/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], groupChatController.setMessagesAdminsOnly)
groupChatRouter.post('/setSubject/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], groupChatController.setSubject)
groupChatRouter.post('/setPicture/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], groupChatController.setPicture)
groupChatRouter.post('/deletePicture/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], groupChatController.deletePicture)

/**
 * ================
 * MESSAGE ENDPOINTS
 * ================
 */
const messageRouter = express.Router()
messageRouter.use(authMiddleware.verifyToken)
messageRouter.use(middleware.apikey)
messageRouter.use(middleware.messageSwagger)
routes.use('/message', messageRouter)

messageRouter.post('/getClassInfo/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], messageController.getClassInfo)
messageRouter.post('/delete/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], messageController.deleteMessage)
messageRouter.post('/downloadMedia/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], messageController.downloadMedia)
messageRouter.post('/forward/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], messageController.forward)
messageRouter.post('/getInfo/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], messageController.getInfo)
messageRouter.post('/getMentions/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], messageController.getMentions)
messageRouter.post('/getOrder/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], messageController.getOrder)
messageRouter.post('/getPayment/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], messageController.getPayment)
messageRouter.post('/getQuotedMessage/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], messageController.getQuotedMessage)
messageRouter.post('/react/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], messageController.react)
messageRouter.post('/reply/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], messageController.reply)
messageRouter.post('/star/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], messageController.star)
messageRouter.post('/unstar/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], messageController.unstar)

/**
 * ================
 * MESSAGE ENDPOINTS
 * ================
 */
const contactRouter = express.Router()
contactRouter.use(authMiddleware.verifyToken)
contactRouter.use(middleware.apikey)
contactRouter.use(middleware.contactSwagger)
routes.use('/contact', contactRouter)

contactRouter.post('/getClassInfo/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], contactController.getClassInfo)
contactRouter.post('/block/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], contactController.block)
contactRouter.post('/getAbout/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], contactController.getAbout)
contactRouter.post('/getChat/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], contactController.getChat)
contactRouter.post('/unblock/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], contactController.unblock)
contactRouter.post('/getFormattedNumber/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], contactController.getFormattedNumber)
contactRouter.post('/getCountryCode/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], contactController.getCountryCode)
contactRouter.post('/getProfilePicUrl/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], contactController.getProfilePicUrl)
/**
 * ================
 * WEBHOOK ENDPOINTS
 * ================
 */
const webhookRouter = express.Router()
routes.use('/api', webhookRouter)

// Webhook sync and history (protected with JWT for dashboard)
webhookRouter.post('/webhook-sync', authMiddleware.verifyToken, webhookController.syncWebhooks)
webhookRouter.get('/webhook-history', authMiddleware.verifyToken, webhookController.getHistory)

// Incoming webhook handler (uses its own auth via secret token, remains public)
webhookRouter.post('/webhook/:webhookId', webhookController.handleWebhook)

/**
 * ================
 * SWAGGER ENDPOINTS
 * ================
 */
if (enableSwaggerEndpoint) {
  routes.use('/api-docs', swaggerUi.serve)
  routes.get('/api-docs', swaggerUi.setup(swaggerDocument) /* #swagger.ignore = true */)
}

module.exports = { routes }
