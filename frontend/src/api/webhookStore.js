const STORAGE_KEY = 'whatsapp-webhooks';
const HISTORY_KEY = 'whatsapp-webhook-history';
const RATE_LIMIT_KEY = 'whatsapp-webhook-ratelimit';

// Get API base URL
const getApiUrl = () => import.meta.env.VITE_API_URL || '';

// Sync webhooks to server file system
export const syncToServer = async () => {
  try {
    const webhooks = getAllWebhooks();
    const token = localStorage.getItem('auth_token');
    
    const headers = {
      'Content-Type': 'application/json'
    };
    
    // Add JWT token if available
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${getApiUrl()}/api/webhook-sync`, {
      method: 'POST',
      headers,
      body: JSON.stringify(webhooks)
    });
    const data = await response.json();
    console.log('Webhooks synced to server:', data);
    return data;
  } catch (error) {
    console.error('Failed to sync webhooks to server:', error);
    return null;
  }
};

// Generate unique ID
const generateId = () => {
  return 'wh_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
};

// Generate secret token
const generateToken = () => {
  return 'whsec_' + Math.random().toString(36).substr(2, 15) + Math.random().toString(36).substr(2, 15);
};

// Get all webhooks
export const getAllWebhooks = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error reading webhooks:', error);
    return [];
  }
};

// Get webhook by ID
export const getWebhookById = (id) => {
  const webhooks = getAllWebhooks();
  return webhooks.find(w => w.id === id);
};

// Create new webhook
export const createWebhook = (webhookData) => {
  const webhooks = getAllWebhooks();
  
  const newWebhook = {
    id: generateId(),
    name: webhookData.name,
    sessionId: webhookData.sessionId,
    chatId: webhookData.chatId,
    chatName: webhookData.chatName || webhookData.chatId,
    secretToken: generateToken(),
    enabled: true,
    rateLimit: webhookData.rateLimit || 10, // per minute
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  webhooks.push(newWebhook);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(webhooks));
  
  // Sync to server
  syncToServer();
  
  return newWebhook;
};

// Update webhook
export const updateWebhook = (id, updates) => {
  const webhooks = getAllWebhooks();
  const index = webhooks.findIndex(w => w.id === id);
  
  if (index === -1) {
    throw new Error('Webhook not found');
  }
  
  webhooks[index] = {
    ...webhooks[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(webhooks));
  
  // Sync to server
  syncToServer();
  
  return webhooks[index];
};

// Delete webhook
export const deleteWebhook = (id) => {
  const webhooks = getAllWebhooks();
  const filtered = webhooks.filter(w => w.id !== id);
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  
  // Also delete related history
  deleteWebhookHistory(id);
  
  // Sync to server
  syncToServer();
  
  return true;
};

// Toggle webhook enabled/disabled
export const toggleWebhook = (id) => {
  const webhook = getWebhookById(id);
  if (!webhook) {
    throw new Error('Webhook not found');
  }
  
  return updateWebhook(id, { enabled: !webhook.enabled });
};

// Regenerate secret token
export const regenerateToken = (id) => {
  const newToken = generateToken();
  return updateWebhook(id, { secretToken: newToken });
};

// Webhook History Management
export const getWebhookHistory = (webhookId, limit = 50) => {
  try {
    const data = localStorage.getItem(HISTORY_KEY);
    const allHistory = data ? JSON.parse(data) : [];
    
    const filtered = webhookId 
      ? allHistory.filter(h => h.webhookId === webhookId)
      : allHistory;
    
    // Sort by timestamp descending and limit
    return filtered
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  } catch (error) {
    console.error('Error reading webhook history:', error);
    return [];
  }
};

// Add history entry
export const addWebhookHistory = (webhookId, entry) => {
  try {
    const data = localStorage.getItem(HISTORY_KEY);
    const history = data ? JSON.parse(data) : [];
    
    const historyEntry = {
      id: generateId(),
      webhookId,
      timestamp: new Date().toISOString(),
      status: entry.status,
      statusCode: entry.statusCode,
      payload: entry.payload,
      response: entry.response,
      error: entry.error,
      ipAddress: entry.ipAddress,
    };
    
    history.push(historyEntry);
    
    // Keep only last 500 entries to prevent localStorage overflow
    if (history.length > 500) {
      history.splice(0, history.length - 500);
    }
    
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    
    return historyEntry;
  } catch (error) {
    console.error('Error adding webhook history:', error);
    return null;
  }
};

// Delete webhook history
export const deleteWebhookHistory = (webhookId) => {
  try {
    const data = localStorage.getItem(HISTORY_KEY);
    const history = data ? JSON.parse(data) : [];
    
    const filtered = history.filter(h => h.webhookId !== webhookId);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered));
    
    return true;
  } catch (error) {
    console.error('Error deleting webhook history:', error);
    return false;
  }
};

// Clear all history for a webhook
export const clearWebhookHistory = (webhookId) => {
  return deleteWebhookHistory(webhookId);
};

// Rate Limiting
export const checkRateLimit = (webhookId) => {
  try {
    const data = localStorage.getItem(RATE_LIMIT_KEY);
    const rateLimits = data ? JSON.parse(data) : {};
    
    const webhook = getWebhookById(webhookId);
    if (!webhook) {
      throw new Error('Webhook not found');
    }
    
    const now = Date.now();
    const limit = webhook.rateLimit || 10;
    const timeWindow = 60 * 1000; // 1 minute
    
    // Get or initialize rate limit data for this webhook
    if (!rateLimits[webhookId]) {
      rateLimits[webhookId] = {
        requests: [],
        lastReset: now
      };
    }
    
    const webhookLimit = rateLimits[webhookId];
    
    // Remove requests older than time window
    webhookLimit.requests = webhookLimit.requests.filter(
      timestamp => now - timestamp < timeWindow
    );
    
    // Check if rate limit exceeded
    if (webhookLimit.requests.length >= limit) {
      const oldestRequest = Math.min(...webhookLimit.requests);
      const resetIn = Math.ceil((timeWindow - (now - oldestRequest)) / 1000);
      
      return {
        allowed: false,
        remaining: 0,
        resetIn,
        message: `Rate limit exceeded. Try again in ${resetIn} seconds.`
      };
    }
    
    // Add current request
    webhookLimit.requests.push(now);
    webhookLimit.lastReset = now;
    
    // Save updated rate limits
    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(rateLimits));
    
    return {
      allowed: true,
      remaining: limit - webhookLimit.requests.length,
      resetIn: 60,
      message: 'OK'
    };
  } catch (error) {
    console.error('Error checking rate limit:', error);
    // Allow request on error
    return {
      allowed: true,
      remaining: 999,
      resetIn: 60,
      message: 'OK'
    };
  }
};

// Get rate limit stats
export const getRateLimitStats = (webhookId) => {
  try {
    const data = localStorage.getItem(RATE_LIMIT_KEY);
    const rateLimits = data ? JSON.parse(data) : {};
    
    const webhook = getWebhookById(webhookId);
    if (!webhook) {
      return null;
    }
    
    const now = Date.now();
    const limit = webhook.rateLimit || 10;
    const timeWindow = 60 * 1000;
    
    if (!rateLimits[webhookId]) {
      return {
        current: 0,
        limit,
        remaining: limit,
        percentage: 0
      };
    }
    
    const webhookLimit = rateLimits[webhookId];
    
    // Remove old requests
    webhookLimit.requests = webhookLimit.requests.filter(
      timestamp => now - timestamp < timeWindow
    );
    
    const current = webhookLimit.requests.length;
    const remaining = Math.max(0, limit - current);
    const percentage = Math.round((current / limit) * 100);
    
    return {
      current,
      limit,
      remaining,
      percentage
    };
  } catch (error) {
    console.error('Error getting rate limit stats:', error);
    return null;
  }
};

// Export all webhooks as JSON (for backup)
export const exportWebhooks = () => {
  const webhooks = getAllWebhooks();
  const history = getWebhookHistory();
  
  return {
    webhooks,
    history,
    exportedAt: new Date().toISOString(),
    version: '1.0'
  };
};

// Import webhooks from JSON
export const importWebhooks = (data) => {
  try {
    if (data.webhooks) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data.webhooks));
    }
    if (data.history) {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(data.history));
    }
    return true;
  } catch (error) {
    console.error('Error importing webhooks:', error);
    return false;
  }
};

