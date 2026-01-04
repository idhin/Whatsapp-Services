import { useState, useEffect } from 'react';
import { useSession } from '../context/SessionContext';
import { clientAPI } from '../api/whatsapp';
import {
  getAllWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  toggleWebhook,
  regenerateToken,
  getWebhookHistory,
  addWebhookHistory,
  clearWebhookHistory,
  checkRateLimit,
  getRateLimitStats,
  syncToServer,
} from '../api/webhookStore';
import toast from 'react-hot-toast';
import {
  Webhook,
  Plus,
  Copy,
  Trash2,
  Power,
  RefreshCw,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  Code,
  Link as LinkIcon,
  Download,
  Loader,
} from 'lucide-react';

const Webhooks = () => {
  const { selectedSession, connectedSessions } = useSession();
  const [webhooks, setWebhooks] = useState([]);
  const [selectedWebhook, setSelectedWebhook] = useState(null);
  const [activeTab, setActiveTab] = useState('list'); // list, create, detail, history
  const [showToken, setShowToken] = useState({});
  
  // Create form state
  const [webhookName, setWebhookName] = useState('');
  const [targetSession, setTargetSession] = useState('');
  const [targetChatId, setTargetChatId] = useState('');
  const [manualChatId, setManualChatId] = useState('');
  const [manualChatName, setManualChatName] = useState('');
  const [inputMode, setInputMode] = useState('select'); // 'select' or 'manual'
  const [chats, setChats] = useState([]);
  const [rateLimit, setRateLimit] = useState(10);
  const [loading, setLoading] = useState(false);
  
  // History state
  const [history, setHistory] = useState([]);

  useEffect(() => {
    loadWebhooks();
    // Sync webhooks to server on mount
    syncToServer();
  }, []);

  useEffect(() => {
    if (connectedSessions.length > 0 && !targetSession) {
      setTargetSession(connectedSessions[0].id);
    }
  }, [connectedSessions]);

  const loadWebhooks = () => {
    const allWebhooks = getAllWebhooks();
    setWebhooks(allWebhooks);
  };

  const loadChatsForSession = async (sessionId) => {
    if (!sessionId) return;
    
    setLoading(true);
    try {
      const response = await clientAPI.getChats(sessionId);
      if (response.data.success) {
        setChats(response.data.chats || []);
      }
    } catch (error) {
      toast.error('Failed to load chats');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWebhook = async () => {
    if (!webhookName.trim()) {
      toast.error('Please enter a webhook name');
      return;
    }
    
    if (!targetSession) {
      toast.error('Please select a session');
      return;
    }
    
    // Validate based on input mode
    let finalChatId, finalChatName;
    
    if (inputMode === 'select') {
      if (!targetChatId) {
        toast.error('Please select a target chat');
        return;
      }
      finalChatId = targetChatId;
      finalChatName = chats.find(c => c.id._serialized === targetChatId)?.name || targetChatId;
    } else {
      // Manual mode
      if (!manualChatId.trim()) {
        toast.error('Please enter a chat ID');
        return;
      }
      finalChatId = manualChatId.trim();
      finalChatName = manualChatName.trim() || finalChatId;
    }

    try {
      const newWebhook = createWebhook({
        name: webhookName,
        sessionId: targetSession,
        chatId: finalChatId,
        chatName: finalChatName,
        rateLimit,
      });

      toast.success('Webhook created successfully!');
      loadWebhooks();
      setActiveTab('detail');
      setSelectedWebhook(newWebhook);
      
      // Reset form
      setWebhookName('');
      setTargetChatId('');
      setManualChatId('');
      setManualChatName('');
      setRateLimit(10);
    } catch (error) {
      toast.error('Failed to create webhook');
    }
  };

  const handleDeleteWebhook = (id) => {
    if (confirm('Are you sure you want to delete this webhook?')) {
      deleteWebhook(id);
      toast.success('Webhook deleted');
      loadWebhooks();
      if (selectedWebhook?.id === id) {
        setSelectedWebhook(null);
        setActiveTab('list');
      }
    }
  };

  const handleToggleWebhook = (id) => {
    const updated = toggleWebhook(id);
    toast.success(`Webhook ${updated.enabled ? 'enabled' : 'disabled'}`);
    loadWebhooks();
    if (selectedWebhook?.id === id) {
      setSelectedWebhook(updated);
    }
  };

  const handleRegenerateToken = (id) => {
    if (confirm('Are you sure? Old token will be invalidated.')) {
      const updated = regenerateToken(id);
      toast.success('Token regenerated successfully');
      loadWebhooks();
      if (selectedWebhook?.id === id) {
        setSelectedWebhook(updated);
      }
    }
  };

  const handleCopy = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const viewWebhookDetail = (webhook) => {
    setSelectedWebhook(webhook);
    setActiveTab('detail');
  };

  const viewWebhookHistory = (webhook) => {
    setSelectedWebhook(webhook);
    const webhookHistory = getWebhookHistory(webhook.id);
    setHistory(webhookHistory);
    setActiveTab('history');
  };

  const getWebhookUrl = (webhookId) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/api/webhook/${webhookId}`;
  };

  const handleTestWebhook = async (webhook) => {
    const rateLimitCheck = checkRateLimit(webhook.id);
    
    if (!rateLimitCheck.allowed) {
      toast.error(rateLimitCheck.message);
      return;
    }

    setLoading(true);
    try {
      const testPayload = {
        chatId: webhook.chatId,
        contentType: 'string',
        content: `Test message from webhook ${webhook.name} at ${new Date().toLocaleString()}`,
      };

      const response = await clientAPI.sendMessage(webhook.sessionId, testPayload);

      if (response.data.success) {
        addWebhookHistory(webhook.id, {
          status: 'success',
          statusCode: 200,
          payload: { message: testPayload.content },
          response: response.data,
        });
        
        toast.success('Test message sent successfully!');
      }
    } catch (error) {
      addWebhookHistory(webhook.id, {
        status: 'error',
        statusCode: error.response?.status || 500,
        payload: { message: 'Test message' },
        error: error.message,
      });
      
      toast.error('Failed to send test message');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto fade-in">
      {/* Page Header */}
      <div className="section-header">
        <div>
          <h1 className="section-title">Webhooks</h1>
          <p className="section-subtitle">Generate webhook URLs for external application integration</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="tabs mb-6">
        <button
          onClick={() => setActiveTab('list')}
          className={`tab ${activeTab === 'list' ? 'active' : ''}`}
        >
          <Activity className="w-4 h-4 inline mr-1.5" />
          All Webhooks ({webhooks.length})
        </button>
        <button
          onClick={() => setActiveTab('create')}
          className={`tab ${activeTab === 'create' ? 'active' : ''}`}
        >
          <Plus className="w-4 h-4 inline mr-1.5" />
          Create New
        </button>
        {selectedWebhook && (
          <>
            <button
              onClick={() => setActiveTab('detail')}
              className={`tab ${activeTab === 'detail' ? 'active' : ''}`}
            >
              <Code className="w-4 h-4 inline mr-1.5" />
              Details
            </button>
            <button
              onClick={() => {
                const webhookHistory = getWebhookHistory(selectedWebhook.id);
                setHistory(webhookHistory);
                setActiveTab('history');
              }}
              className={`tab ${activeTab === 'history' ? 'active' : ''}`}
            >
              <Clock className="w-4 h-4 inline mr-1.5" />
              History
            </button>
          </>
        )}
      </div>

      {/* Webhook List */}
      {activeTab === 'list' && (
        <div className="space-y-4">
          {webhooks.length === 0 ? (
            <div className="card text-center py-12">
              <Webhook className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No webhooks yet</h3>
              <p className="text-slate-500 mb-4">Create your first webhook to get started</p>
              <button
                onClick={() => setActiveTab('create')}
                className="btn-primary"
              >
                <Plus className="w-4 h-4 inline mr-2" />
                Create Webhook
              </button>
            </div>
          ) : (
            webhooks.map((webhook) => {
              const rateLimitStats = getRateLimitStats(webhook.id);
              
              return (
                <div 
                  key={webhook.id} 
                  className="card fade-in"
                  style={{ animationDelay: `${webhooks.indexOf(webhook) * 0.05}s` }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-slate-900">{webhook.name}</h3>
                        {webhook.enabled ? (
                          <span className="badge badge-success">
                            <CheckCircle className="w-4 h-4" />
                            Active
                          </span>
                        ) : (
                          <span className="badge badge-neutral">
                            <XCircle className="w-4 h-4" />
                            Disabled
                          </span>
                        )}
                      </div>
                      
                      <div className="space-y-1 text-sm text-slate-500">
                        <p>
                          <span className="font-medium">Session:</span> {webhook.sessionId}
                        </p>
                        <p>
                          <span className="font-medium">Target:</span> {webhook.chatName}
                        </p>
                        <p>
                          <span className="font-medium">Rate Limit:</span> {webhook.rateLimit}/min
                          {rateLimitStats && (
                            <span className="ml-2">
                              ({rateLimitStats.current}/{rateLimitStats.limit} used)
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-slate-400">
                          Created: {new Date(webhook.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => viewWebhookDetail(webhook)}
                        className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleWebhook(webhook.id)}
                        className={`${
                          webhook.enabled
                            ? 'bg-yellow-600 hover:bg-yellow-700'
                            : 'bg-green-600 hover:bg-green-700'
                        } text-white p-2 rounded-lg transition-colors`}
                        title={webhook.enabled ? 'Disable' : 'Enable'}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => viewWebhookHistory(webhook)}
                        className="bg-purple-600 hover:bg-purple-700 text-white p-2 rounded-lg transition-colors"
                        title="View History"
                      >
                        <Clock className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleTestWebhook(webhook)}
                        disabled={!webhook.enabled || loading}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Test Webhook"
                      >
                        {loading ? (
                          <Loader className="w-4 h-4 animate-spin" />
                        ) : (
                          <Activity className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteWebhook(webhook.id)}
                        className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Create Webhook Form */}
      {activeTab === 'create' && (
        <div className="card max-w-2xl">
          <h2 className="text-xl font-semibold text-slate-900 mb-6">Create New Webhook</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Webhook Name</label>
              <input
                type="text"
                placeholder="e.g., Stock Update Notifier"
                value={webhookName}
                onChange={(e) => setWebhookName(e.target.value)}
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Session</label>
              <select
                value={targetSession}
                onChange={(e) => {
                  setTargetSession(e.target.value);
                  loadChatsForSession(e.target.value);
                }}
                className="input"
              >
                <option value="">Select session...</option>
                {connectedSessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.id}
                  </option>
                ))}
              </select>
            </div>

            {targetSession && (
              <div>
                <label className="block text-sm font-medium mb-2">Target Chat/Group</label>
                
                {/* Input Mode Toggle */}
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setInputMode('select')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      inputMode === 'select'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                    }`}
                  >
                    Select from List
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMode('manual')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      inputMode === 'manual'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                    }`}
                  >
                    Manual Input
                  </button>
                </div>

                {/* Select Mode */}
                {inputMode === 'select' && (
                  <>
                    <button
                      onClick={() => loadChatsForSession(targetSession)}
                      className="btn-secondary mb-2 text-sm"
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <Loader className="w-4 h-4 inline mr-2 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4 inline mr-2" />
                          Load Chats
                        </>
                      )}
                    </button>
                    
                    <select
                      value={targetChatId}
                      onChange={(e) => setTargetChatId(e.target.value)}
                      className="input"
                      disabled={chats.length === 0}
                    >
                      <option value="">Select target chat...</option>
                      {chats.map((chat) => (
                        <option key={chat.id._serialized} value={chat.id._serialized}>
                          {chat.name} {chat.isGroup ? '(Group)' : ''}
                        </option>
                      ))}
                    </select>
                    
                    {chats.length === 0 && (
                      <p className="text-sm text-amber-600 mt-2">
                        Click "Load Chats" to fetch available chats
                      </p>
                    )}
                  </>
                )}

                {/* Manual Mode */}
                {inputMode === 'manual' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">
                        Chat ID <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., 6281234567890@c.us or 120363xxx@g.us"
                        value={manualChatId}
                        onChange={(e) => setManualChatId(e.target.value)}
                        className="input font-mono text-sm"
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Format: <code className="bg-slate-100 px-1 rounded">phone@c.us</code> (personal) or{' '}
                        <code className="bg-slate-100 px-1 rounded">groupid@g.us</code> (group)
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">
                        Display Name (optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Customer Support Group"
                        value={manualChatName}
                        onChange={(e) => setManualChatName(e.target.value)}
                        className="input"
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Friendly name for this webhook (defaults to Chat ID if not provided)
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">
                Rate Limit (requests per minute)
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={rateLimit}
                onChange={(e) => setRateLimit(parseInt(e.target.value) || 10)}
                className="input"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={handleCreateWebhook}
                className="btn-primary flex-1"
              >
                <Plus className="w-4 h-4 inline mr-2" />
                Create Webhook
              </button>
              <button
                onClick={() => setActiveTab('list')}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Webhook Detail */}
      {activeTab === 'detail' && selectedWebhook && (
        <div className="space-y-6 fade-in">
          <div className="card">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">{selectedWebhook.name}</h2>
                <p className="text-sm text-slate-500 mt-1">ID: {selectedWebhook.id}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleToggleWebhook(selectedWebhook.id)}
                  className={`${
                    selectedWebhook.enabled
                      ? 'bg-yellow-600 hover:bg-yellow-700'
                      : 'bg-green-600 hover:bg-green-700'
                  } text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2`}
                >
                  <Power className="w-4 h-4" />
                  {selectedWebhook.enabled ? 'Disable' : 'Enable'}
                </button>
                <button
                  onClick={() => handleRegenerateToken(selectedWebhook.id)}
                  className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Regenerate Token
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Webhook URL</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={getWebhookUrl(selectedWebhook.id)}
                    readOnly
                    className="input flex-1 font-mono text-sm"
                  />
                  <button
                    onClick={() => handleCopy(getWebhookUrl(selectedWebhook.id), 'Webhook URL')}
                    className="btn-secondary"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Secret Token</label>
                <div className="flex gap-2">
                  <input
                    type={showToken[selectedWebhook.id] ? 'text' : 'password'}
                    value={selectedWebhook.secretToken}
                    readOnly
                    className="input flex-1 font-mono text-sm"
                  />
                  <button
                    onClick={() => setShowToken({
                      ...showToken,
                      [selectedWebhook.id]: !showToken[selectedWebhook.id]
                    })}
                    className="btn-secondary"
                  >
                    {showToken[selectedWebhook.id] ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleCopy(selectedWebhook.secretToken, 'Secret Token')}
                    className="btn-secondary"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                <div>
                  <p className="text-sm text-slate-500">Session</p>
                  <p className="font-medium text-slate-900">{selectedWebhook.sessionId}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Target Chat</p>
                  <p className="font-medium text-slate-900">{selectedWebhook.chatName}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Rate Limit</p>
                  <p className="font-medium text-slate-900">{selectedWebhook.rateLimit} requests/min</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Status</p>
                  <p className={`font-medium ${selectedWebhook.enabled ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {selectedWebhook.enabled ? 'Active' : 'Disabled'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Created</p>
                  <p className="font-medium text-sm text-slate-900">
                    {new Date(selectedWebhook.createdAt).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Last Updated</p>
                  <p className="font-medium text-sm text-slate-900">
                    {new Date(selectedWebhook.updatedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Integration Documentation */}
          <div className="card">
            <h3 className="text-xl font-semibold text-slate-900 mb-6 flex items-center gap-2">
              <Code className="w-6 h-6 text-emerald-600" />
              Integration Guide
            </h3>
            
            <div className="space-y-6">
              {/* API Endpoint */}
              <div>
                <h4 className="font-semibold mb-2 text-emerald-600">Endpoint</h4>
                <div className="code-block font-mono text-sm">
                  <span className="text-yellow-400">POST</span>{' '}
                  <span className="text-blue-400">{getWebhookUrl(selectedWebhook.id)}</span>
                </div>
              </div>

              {/* Headers */}
              <div>
                <h4 className="font-semibold mb-2 text-emerald-600">Headers</h4>
                <div className="code-block font-mono text-sm space-y-1">
                  <div>
                    <span className="text-purple-400">Authorization:</span>{' '}
                    <span className="text-green-400">Bearer {selectedWebhook.secretToken}</span>
                  </div>
                  <div>
                    <span className="text-purple-400">Content-Type:</span>{' '}
                    <span className="text-green-400">application/json</span>
                  </div>
                </div>
              </div>

              {/* Request Body */}
              <div>
                <h4 className="font-semibold mb-2 text-emerald-600">Request Body</h4>
                <div className="code-block font-mono text-sm">
                  <pre className="text-slate-100">{`{
  "message": "Your message text here"
}`}</pre>
                </div>
                <p className="text-sm text-slate-500 mt-2">
                  The message will be sent to: <span className="font-medium text-slate-900">{selectedWebhook.chatName}</span>
                </p>
              </div>

              {/* Response */}
              <div>
                <h4 className="font-semibold mb-2 text-emerald-600">Response</h4>
                <div className="code-block font-mono text-sm space-y-4">
                  <div>
                    <p className="text-green-400 mb-2">Success (200):</p>
                    <pre className="text-slate-100">{`{
  "success": true,
  "messageId": "true_6281234567890@c.us_..."
}`}</pre>
                  </div>
                  <div>
                    <p className="text-red-400 mb-2">Error (400/401/429):</p>
                    <pre className="text-slate-100">{`{
  "success": false,
  "error": "Error message"
}`}</pre>
                  </div>
                </div>
              </div>

              {/* Code Examples */}
              <div>
                <h4 className="font-semibold mb-3 text-emerald-600">Code Examples</h4>
                
                {/* cURL */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="font-medium text-sm">cURL</h5>
                    <button
                      onClick={() => handleCopy(
                        `curl -X POST '${getWebhookUrl(selectedWebhook.id)}' \\
  -H 'Authorization: Bearer ${selectedWebhook.secretToken}' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "message": "Stock update: Item ABC - 50 units remaining"
  }'`,
                        'cURL example'
                      )}
                      className="text-sm text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" />
                      Copy
                    </button>
                  </div>
                  <div className="code-block font-mono text-xs overflow-auto">
                    <pre className="text-slate-100">{`curl -X POST '${getWebhookUrl(selectedWebhook.id)}' \\
  -H 'Authorization: Bearer ${selectedWebhook.secretToken}' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "message": "Stock update: Item ABC - 50 units remaining"
  }'`}</pre>
                  </div>
                </div>

                {/* PHP */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="font-medium text-sm">PHP</h5>
                    <button
                      onClick={() => handleCopy(
                        `<?php
$webhook_url = '${getWebhookUrl(selectedWebhook.id)}';
$secret_token = '${selectedWebhook.secretToken}';

$data = [
    'message' => 'Stock update: Item ABC - 50 units remaining'
];

$ch = curl_init($webhook_url);
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer ' . $secret_token,
    'Content-Type: application/json'
]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($http_code === 200) {
    echo "Message sent successfully!";
} else {
    echo "Error: " . $response;
}
?>`,
                        'PHP example'
                      )}
                      className="text-sm text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" />
                      Copy
                    </button>
                  </div>
                  <div className="code-block font-mono text-xs overflow-auto">
                    <pre className="text-slate-100">{`<?php
$webhook_url = '${getWebhookUrl(selectedWebhook.id)}';
$secret_token = '${selectedWebhook.secretToken}';

$data = [
    'message' => 'Stock update: Item ABC - 50 units remaining'
];

$ch = curl_init($webhook_url);
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer ' . $secret_token,
    'Content-Type: application/json'
]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($http_code === 200) {
    echo "Message sent successfully!";
} else {
    echo "Error: " . $response;
}
?>`}</pre>
                  </div>
                </div>

                {/* Python */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="font-medium text-sm">Python</h5>
                    <button
                      onClick={() => handleCopy(
                        `import requests
import json

webhook_url = '${getWebhookUrl(selectedWebhook.id)}'
secret_token = '${selectedWebhook.secretToken}'

headers = {
    'Authorization': f'Bearer {secret_token}',
    'Content-Type': 'application/json'
}

data = {
    'message': 'Stock update: Item ABC - 50 units remaining'
}

response = requests.post(webhook_url, headers=headers, json=data)

if response.status_code == 200:
    print('Message sent successfully!')
    print(response.json())
else:
    print(f'Error: {response.text}')`,
                        'Python example'
                      )}
                      className="text-sm text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" />
                      Copy
                    </button>
                  </div>
                  <div className="code-block font-mono text-xs overflow-auto">
                    <pre className="text-slate-100">{`import requests
import json

webhook_url = '${getWebhookUrl(selectedWebhook.id)}'
secret_token = '${selectedWebhook.secretToken}'

headers = {
    'Authorization': f'Bearer {secret_token}',
    'Content-Type': 'application/json'
}

data = {
    'message': 'Stock update: Item ABC - 50 units remaining'
}

response = requests.post(webhook_url, headers=headers, json=data)

if response.status_code == 200:
    print('Message sent successfully!')
    print(response.json())
else:
    print(f'Error: {response.text}')`}</pre>
                  </div>
                </div>

                {/* Node.js */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="font-medium text-sm">Node.js (axios)</h5>
                    <button
                      onClick={() => handleCopy(
                        `const axios = require('axios');

const webhookUrl = '${getWebhookUrl(selectedWebhook.id)}';
const secretToken = '${selectedWebhook.secretToken}';

const data = {
  message: 'Stock update: Item ABC - 50 units remaining'
};

axios.post(webhookUrl, data, {
  headers: {
    'Authorization': \`Bearer \${secretToken}\`,
    'Content-Type': 'application/json'
  }
})
.then(response => {
  console.log('Message sent successfully!');
  console.log(response.data);
})
.catch(error => {
  console.error('Error:', error.response?.data || error.message);
});`,
                        'Node.js example'
                      )}
                      className="text-sm text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" />
                      Copy
                    </button>
                  </div>
                  <div className="code-block font-mono text-xs overflow-auto">
                    <pre className="text-slate-100">{`const axios = require('axios');

const webhookUrl = '${getWebhookUrl(selectedWebhook.id)}';
const secretToken = '${selectedWebhook.secretToken}';

const data = {
  message: 'Stock update: Item ABC - 50 units remaining'
};

axios.post(webhookUrl, data, {
  headers: {
    'Authorization': \`Bearer \${secretToken}\`,
    'Content-Type': 'application/json'
  }
})
.then(response => {
  console.log('Message sent successfully!');
  console.log(response.data);
})
.catch(error => {
  console.error('Error:', error.response?.data || error.message);
});`}</pre>
                  </div>
                </div>
              </div>

              {/* Important Notes */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="font-semibold mb-2 text-amber-700 flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Important Notes
                </h4>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li className="flex gap-2">
                    <span className="text-amber-600">•</span>
                    <span>
                      <strong>Authentication:</strong> Always include the Authorization header with your secret token
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-amber-600">•</span>
                    <span>
                      <strong>Rate Limiting:</strong> Maximum {selectedWebhook.rateLimit} requests per minute
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-amber-600">•</span>
                    <span>
                      <strong>Target:</strong> Messages will be sent to {selectedWebhook.chatName} using session {selectedWebhook.sessionId}
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-amber-600">•</span>
                    <span>
                      <strong>Security:</strong> Keep your secret token secure. Regenerate it if compromised.
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-amber-600">•</span>
                    <span>
                      <strong>Status:</strong> Webhook must be enabled to accept requests
                    </span>
                  </li>
                </ul>
              </div>

              {/* Use Case Example for Casa Neira */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold mb-2 text-blue-700 flex items-center gap-2">
                  <LinkIcon className="w-5 h-5" />
                  Use Case: Casa Neira Stock Updates
                </h4>
                <p className="text-sm text-slate-600 mb-3">
                  Integrate this webhook into your Casa Neira application to automatically send WhatsApp notifications when stock levels change:
                </p>
                <div className="code-block font-mono text-xs overflow-auto">
                  <pre className="text-slate-100">{`// In your Casa Neira application:
// When stock is updated in database:

$product = 'Item ABC';
$quantity = 50;
$threshold = 10;

if ($quantity <= $threshold) {
    $message = "⚠️ LOW STOCK ALERT\\n\\n";
    $message .= "Product: {$product}\\n";
    $message .= "Current Stock: {$quantity} units\\n";
    $message .= "Threshold: {$threshold} units\\n\\n";
    $message .= "Please reorder soon!";
    
    // Send to WhatsApp via webhook
    sendToWhatsApp($message);
}

function sendToWhatsApp($message) {
    $webhook_url = '${getWebhookUrl(selectedWebhook.id)}';
    $secret_token = '${selectedWebhook.secretToken}';
    
    $ch = curl_init($webhook_url);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
        'message' => $message
    ]));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $secret_token,
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    
    $response = curl_exec($ch);
    curl_close($ch);
    
    return json_decode($response, true);
}`}</pre>
                </div>
              </div>

              {/* Production Deployment Note */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h4 className="font-semibold mb-2 text-purple-700 flex items-center gap-2">
                  <Download className="w-5 h-5" />
                  Production Deployment
                </h4>
                <div className="space-y-2 text-sm text-slate-600">
                  <p>
                    <strong>Development Mode:</strong> Use the "Test Webhook" button in the webhook list to test sending messages through this webhook during development.
                  </p>
                  <p>
                    <strong>Production Mode:</strong> For production use, you have two options:
                  </p>
                  <ul className="ml-4 space-y-1 list-disc">
                    <li>
                      <strong>Option 1 (Recommended):</strong> Create a simple backend endpoint that validates the webhook token and calls the WhatsApp API directly using the existing <code className="bg-slate-100 px-1 rounded">/client/sendMessage</code> endpoint
                    </li>
                    <li>
                      <strong>Option 2:</strong> Deploy this frontend with the webhook middleware and ensure it's accessible from your Casa Neira server
                    </li>
                  </ul>
                  <p className="mt-3 text-amber-700">
                    💡 <strong>Quick Integration:</strong> For immediate testing, use the "Test Webhook" button. For production, implement server-side validation and rate limiting for better security and reliability.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Webhook History */}
      {activeTab === 'history' && selectedWebhook && (
        <div className="card fade-in">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-slate-900">
              Request History - {selectedWebhook.name}
            </h2>
            <button
              onClick={() => {
                if (confirm('Clear all history for this webhook?')) {
                  clearWebhookHistory(selectedWebhook.id);
                  setHistory([]);
                  toast.success('History cleared');
                }
              }}
              className="btn-secondary text-sm"
            >
              <Trash2 className="w-4 h-4 inline mr-2" />
              Clear History
            </button>
          </div>

          {history.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-500">No request history yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((entry) => (
                <div
                  key={entry.id}
                  className="card hover:shadow-md transition-all duration-300"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {entry.status === 'success' ? (
                        <CheckCircle className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600" />
                      )}
                      <span
                        className={`font-medium ${
                          entry.status === 'success' ? 'text-emerald-600' : 'text-red-600'
                        }`}
                      >
                        {entry.statusCode}
                      </span>
                      <span className="text-sm text-slate-500">
                        {new Date(entry.timestamp).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-slate-500 mb-1">Payload:</p>
                      <pre className="bg-slate-100 p-2 rounded text-xs overflow-auto text-slate-800">
                        {JSON.stringify(entry.payload, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <p className="text-slate-500 mb-1">
                        {entry.error ? 'Error:' : 'Response:'}
                      </p>
                      <pre className="bg-slate-100 p-2 rounded text-xs overflow-auto text-slate-800">
                        {JSON.stringify(entry.error || entry.response, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Webhooks;

