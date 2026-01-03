import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEBHOOKS_FILE = path.join(__dirname, '.webhooks-data.json');

// Helper to read webhooks from file
function readWebhooks() {
  try {
    if (fs.existsSync(WEBHOOKS_FILE)) {
      const data = fs.readFileSync(WEBHOOKS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading webhooks file:', error);
  }
  return [];
}

// Helper to write webhooks to file
function writeWebhooks(webhooks) {
  try {
    fs.writeFileSync(WEBHOOKS_FILE, JSON.stringify(webhooks, null, 2));
  } catch (error) {
    console.error('Error writing webhooks file:', error);
  }
}

// Helper to add history entry
function addHistory(webhookId, entry) {
  try {
    const historyFile = path.join(__dirname, '.webhooks-history.json');
    let history = [];
    
    if (fs.existsSync(historyFile)) {
      const data = fs.readFileSync(historyFile, 'utf8');
      history = JSON.parse(data);
    }
    
    history.push({
      id: 'hist_' + Date.now(),
      webhookId,
      timestamp: new Date().toISOString(),
      ...entry
    });
    
    // Keep only last 500 entries
    if (history.length > 500) {
      history = history.slice(-500);
    }
    
    fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
  } catch (error) {
    console.error('Error writing history:', error);
  }
}

// Rate limiting check
const rateLimitMap = new Map();

function checkRateLimit(webhookId, limit = 10) {
  const now = Date.now();
  const timeWindow = 60 * 1000; // 1 minute
  
  if (!rateLimitMap.has(webhookId)) {
    rateLimitMap.set(webhookId, []);
  }
  
  const requests = rateLimitMap.get(webhookId);
  
  // Remove old requests
  const validRequests = requests.filter(timestamp => now - timestamp < timeWindow);
  
  if (validRequests.length >= limit) {
    const oldestRequest = Math.min(...validRequests);
    const resetIn = Math.ceil((timeWindow - (now - oldestRequest)) / 1000);
    
    return {
      allowed: false,
      remaining: 0,
      resetIn,
      message: `Rate limit exceeded. Try again in ${resetIn} seconds.`
    };
  }
  
  validRequests.push(now);
  rateLimitMap.set(webhookId, validRequests);
  
  return {
    allowed: true,
    remaining: limit - validRequests.length,
    resetIn: 60
  };
}

// Webhook middleware for Vite dev server
export function webhookMiddleware() {
  return {
    name: 'webhook-middleware',
    configureServer(server) {
      // Endpoint to sync webhooks from localStorage to file
      server.middlewares.use(async (req, res, next) => {
        if (req.url === '/api/webhook-sync' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => {
            body += chunk.toString();
          });
          
          req.on('end', () => {
            try {
              const webhooks = JSON.parse(body);
              writeWebhooks(webhooks);
              
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, synced: webhooks.length }));
            } catch (error) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: error.message }));
            }
          });
          return;
        }
        
        next();
      });
      
      // Endpoint to get history from file
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.startsWith('/api/webhook-history') && req.method === 'GET') {
          try {
            const historyFile = path.join(__dirname, '.webhooks-history.json');
            
            if (fs.existsSync(historyFile)) {
              const data = fs.readFileSync(historyFile, 'utf8');
              const history = JSON.parse(data);
              
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, history }));
            } else {
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, history: [] }));
            }
          } catch (error) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: error.message }));
          }
          return;
        }
        
        next();
      });
      
      // Main webhook handler
      server.middlewares.use(async (req, res, next) => {
        // Only handle webhook POST requests
        if (!req.url?.startsWith('/api/webhook/') || req.method !== 'POST') {
          return next();
        }

        // Extract webhook ID from URL
        const webhookId = req.url.split('/api/webhook/')[1]?.split('?')[0];
        
        if (!webhookId) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: 'Invalid webhook ID' }));
          return;
        }

        // Read request body
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });

        req.on('end', async () => {
          try {
            const payload = JSON.parse(body);
            
            // Validate authorization header
            const authHeader = req.headers.authorization;
            
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
              addHistory(webhookId, {
                status: 'error',
                statusCode: 401,
                payload,
                error: 'Missing or invalid Authorization header'
              });
              
              res.statusCode = 401;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ 
                success: false, 
                error: 'Missing or invalid Authorization header' 
              }));
              return;
            }

            const token = authHeader.split('Bearer ')[1];
            
            // Find webhook
            const webhooks = readWebhooks();
            const webhook = webhooks.find(w => w.id === webhookId);
            
            if (!webhook) {
              addHistory(webhookId, {
                status: 'error',
                statusCode: 404,
                payload,
                error: 'Webhook not found'
              });
              
              res.statusCode = 404;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ 
                success: false, 
                error: 'Webhook not found' 
              }));
              return;
            }
            
            // Validate token
            if (webhook.secretToken !== token) {
              addHistory(webhookId, {
                status: 'error',
                statusCode: 401,
                payload,
                error: 'Invalid secret token'
              });
              
              res.statusCode = 401;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ 
                success: false, 
                error: 'Invalid secret token' 
              }));
              return;
            }
            
            // Check if webhook is enabled
            if (!webhook.enabled) {
              addHistory(webhookId, {
                status: 'error',
                statusCode: 403,
                payload,
                error: 'Webhook is disabled'
              });
              
              res.statusCode = 403;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ 
                success: false, 
                error: 'Webhook is disabled' 
              }));
              return;
            }
            
            // Check rate limit
            const rateLimitCheck = checkRateLimit(webhookId, webhook.rateLimit || 10);
            
            if (!rateLimitCheck.allowed) {
              addHistory(webhookId, {
                status: 'error',
                statusCode: 429,
                payload,
                error: rateLimitCheck.message
              });
              
              res.statusCode = 429;
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('X-RateLimit-Remaining', '0');
              res.setHeader('X-RateLimit-Reset', rateLimitCheck.resetIn.toString());
              res.end(JSON.stringify({ 
                success: false, 
                error: rateLimitCheck.message 
              }));
              return;
            }
            
            // Validate message
            if (!payload.message || typeof payload.message !== 'string') {
              addHistory(webhookId, {
                status: 'error',
                statusCode: 400,
                payload,
                error: 'Missing or invalid message field'
              });
              
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ 
                success: false, 
                error: 'Missing or invalid message field' 
              }));
              return;
            }
            
            // Send message to WhatsApp
            try {
              const whatsappPayload = {
                chatId: webhook.chatId,
                contentType: 'string',
                content: payload.message,
              };
              
              const response = await axios.post(
                `http://localhost:3000/client/sendMessage/${webhook.sessionId}`,
                whatsappPayload,
                {
                  headers: {
                    'Content-Type': 'application/json'
                  }
                }
              );
              
              addHistory(webhookId, {
                status: 'success',
                statusCode: 200,
                payload,
                response: response.data
              });
              
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('X-RateLimit-Remaining', rateLimitCheck.remaining.toString());
              res.setHeader('X-RateLimit-Reset', rateLimitCheck.resetIn.toString());
              res.end(JSON.stringify({ 
                success: true,
                messageId: response.data.messageId,
                webhookId,
                rateLimitRemaining: rateLimitCheck.remaining
              }));
              
            } catch (error) {
              const errorMessage = error.response?.data?.error || error.message;
              
              addHistory(webhookId, {
                status: 'error',
                statusCode: error.response?.status || 500,
                payload,
                error: errorMessage
              });
              
              res.statusCode = error.response?.status || 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ 
                success: false, 
                error: errorMessage 
              }));
            }
            
          } catch (error) {
            addHistory(webhookId, {
              status: 'error',
              statusCode: 400,
              payload: body,
              error: 'Invalid JSON payload'
            });
            
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ 
              success: false, 
              error: 'Invalid JSON payload' 
            }));
          }
        });
      });
    }
  };
}

