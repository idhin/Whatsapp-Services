import { useState, useEffect, useRef } from 'react';
import { sessionAPI } from '../api/whatsapp';
import { useSession } from '../context/SessionContext';
import toast from 'react-hot-toast';
import { Play, RotateCw, X, QrCode, CheckCircle, XCircle, Loader, Plus, Activity, Zap, Server } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

const Dashboard = () => {
  const { addSession: addToContext, removeSession: removeFromContext, updateSessionState } = useSession();
  const [sessionId, setSessionId] = useState('');
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const intervalsRef = useRef({});

  // Load existing sessions on mount
  useEffect(() => {
    loadExistingSessions();
  }, []);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      Object.values(intervalsRef.current).forEach(interval => clearInterval(interval));
    };
  }, []);

  const loadExistingSessions = async () => {
    // Check localStorage for saved sessions
    const savedSessions = localStorage.getItem('whatsapp-sessions');
    if (savedSessions) {
      try {
        const sessionIds = JSON.parse(savedSessions);
        const validSessions = [];
        
        // Check each session in parallel
        await Promise.all(
          sessionIds.map(async (id) => {
            try {
              const response = await sessionAPI.status(id);
              if (response.data.state === 'CONNECTED') {
                validSessions.push({ 
                  id, 
                  status: 'connected', 
                  qr: null, 
                  state: 'CONNECTED' 
                });
              }
            } catch (error) {
              console.log(`Session ${id} not found in backend`);
            }
          })
        );
        
        // Set all valid sessions at once (no duplicates)
        if (validSessions.length > 0) {
          setSessions(validSessions);
        }
      } catch (error) {
        console.error('Error loading saved sessions:', error);
      }
    }
  };

  const addSession = (id) => {
    setSessions(prevSessions => {
      if (prevSessions.find(s => s.id === id)) {
        return prevSessions;
      }
      return [...prevSessions, { id, status: 'starting', qr: null, state: null }];
    });
  };

  const updateSession = (id, updates) => {
    setSessions(prevSessions => 
      prevSessions.map(s => s.id === id ? { ...s, ...updates } : s)
    );
  };

  const removeSession = (id) => {
    setSessions(prevSessions => prevSessions.filter(s => s.id !== id));
  };

  const handleStartSession = async (id) => {
    if (!id.trim()) {
      toast.error('Please enter a session ID');
      return;
    }

    // Add session to UI immediately
    setSessions(prevSessions => {
      // Check if already exists
      if (prevSessions.find(s => s.id === id)) {
        return prevSessions;
      }
      return [...prevSessions, { id, status: 'starting', qr: null, state: null }];
    });

    try {
      const response = await sessionAPI.start(id);
      
      if (response.data.success) {
        toast.success(`Session ${id} started successfully`);
        updateSession(id, { status: 'waiting_qr' });
        
        // Poll for QR code
        pollQRCode(id);
      }
    } catch (error) {
      // Check if session already exists
      if (error.response?.data?.error?.includes('already exists')) {
        toast.info(`Session ${id} already exists, checking status...`);
        handleCheckStatus(id);
      } else {
        toast.error(error.response?.data?.error || 'Failed to start session');
        updateSession(id, { status: 'error' });
      }
    }
  };

  const handleAddExistingSession = async (id) => {
    if (!id.trim()) {
      toast.error('Please enter a session ID');
      return;
    }

    // Add to UI
    setSessions(prevSessions => {
      if (prevSessions.find(s => s.id === id)) {
        toast.info('Session already in list');
        return prevSessions;
      }
      return [...prevSessions, { id, status: 'checking', qr: null, state: null }];
    });

    // Check status
    await handleCheckStatus(id);
  };

  const pollQRCode = async (id) => {
    // Clear existing interval if any
    if (intervalsRef.current[id]) {
      clearInterval(intervalsRef.current[id]);
    }

    let attempts = 0;
    const maxAttempts = 60; // 2 minutes
    
    intervalsRef.current[id] = setInterval(async () => {
      try {
        const statusRes = await sessionAPI.status(id);
        const qrRes = await sessionAPI.qr(id);
        
        // Build updates object
        const updates = { 
          state: statusRes.data.state
        };
        
        // Always keep QR if available
        if (qrRes.data.qr) {
          updates.qr = qrRes.data.qr;
          updates.status = 'qr_ready';
        }

        updateSession(id, updates);

        // Check if connected
        if (statusRes.data.state === 'CONNECTED') {
          updateSession(id, { status: 'connected', qr: null });
          clearInterval(intervalsRef.current[id]);
          delete intervalsRef.current[id];
          
          // Save to localStorage
          const savedSessions = JSON.parse(localStorage.getItem('whatsapp-sessions') || '[]');
          if (!savedSessions.includes(id)) {
            savedSessions.push(id);
            localStorage.setItem('whatsapp-sessions', JSON.stringify(savedSessions));
          }
          
          // Sync to context
          addToContext(id);
          updateSessionState(id, 'CONNECTED', true);
          
          toast.success(`Session ${id} connected!`);
          return;
        }

        attempts++;
        if (attempts >= maxAttempts) {
          clearInterval(intervalsRef.current[id]);
          delete intervalsRef.current[id];
          updateSession(id, { status: 'timeout' });
          toast.error(`Session ${id} timed out. Please restart.`);
        }
      } catch (error) {
        console.error('Error polling:', error);
      }
    }, 2000);
  };

  const handleRestartSession = async (id) => {
    try {
      updateSession(id, { status: 'restarting' });
      await sessionAPI.restart(id);
      toast.success(`Session ${id} restarted`);
      updateSession(id, { status: 'waiting_qr', qr: null });
      pollQRCode(id);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to restart session');
      updateSession(id, { status: 'error' });
    }
  };

  const handleTerminateSession = async (id) => {
    try {
      // Clear polling interval
      if (intervalsRef.current[id]) {
        clearInterval(intervalsRef.current[id]);
        delete intervalsRef.current[id];
      }
      
      await sessionAPI.terminate(id);
      
      // Remove from localStorage
      const savedSessions = JSON.parse(localStorage.getItem('whatsapp-sessions') || '[]');
      const filtered = savedSessions.filter(s => s !== id);
      localStorage.setItem('whatsapp-sessions', JSON.stringify(filtered));
      
      // Remove from context
      removeFromContext(id);
      
      toast.success(`Session ${id} terminated`);
      removeSession(id);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to terminate session');
    }
  };

  const handleCheckStatus = async (id) => {
    try {
      const response = await sessionAPI.status(id);
      const qrRes = await sessionAPI.qr(id);
      
      const updates = { 
        state: response.data.state,
      };
      
      if (response.data.state === 'CONNECTED') {
        updates.status = 'connected';
        updates.qr = null;
        toast.success(`Session ${id} is connected!`);
        
        // Save to localStorage
        const savedSessions = JSON.parse(localStorage.getItem('whatsapp-sessions') || '[]');
        if (!savedSessions.includes(id)) {
          savedSessions.push(id);
          localStorage.setItem('whatsapp-sessions', JSON.stringify(savedSessions));
        }
        
        // Sync to context
        addToContext(id);
        updateSessionState(id, 'CONNECTED', true);
      } else if (qrRes.data.qr) {
        updates.status = 'qr_ready';
        updates.qr = qrRes.data.qr;
        toast.info(`QR Code ready for ${id}`);
        // Start polling if QR available
        pollQRCode(id);
      } else {
        updates.status = 'disconnected';
        toast.warning(`Session ${id} is not connected`);
      }
      
      updateSession(id, updates);
    } catch (error) {
      toast.error('Failed to check status');
      updateSession(id, { status: 'error' });
    }
  };

  const getStatusIcon = (status, state) => {
    if (status === 'connected' || state === 'CONNECTED') {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    }
    if (status === 'starting' || status === 'restarting' || status === 'waiting_qr') {
      return <Loader className="w-5 h-5 text-yellow-500 animate-spin" />;
    }
    if (status === 'error' || status === 'timeout') {
      return <XCircle className="w-5 h-5 text-red-500" />;
    }
    return <XCircle className="w-5 h-5 text-gray-500" />;
  };

  const getStatusText = (status, state) => {
    if (state === 'CONNECTED') return 'Connected';
    if (status === 'starting') return 'Starting...';
    if (status === 'restarting') return 'Restarting...';
    if (status === 'waiting_qr') return 'Waiting for QR';
    if (status === 'qr_ready') return 'Scan QR Code';
    if (status === 'timeout') return 'Timeout';
    if (status === 'error') return 'Error';
    return 'Not Started';
  };

  // Calculate stats
  const totalSessions = sessions.length;
  const connectedSessions = sessions.filter(s => s.state === 'CONNECTED').length;
  const activeSessions = sessions.filter(s => s.status !== 'error' && s.status !== 'timeout').length;

  return (
    <div className="max-w-7xl mx-auto fade-in">
      {/* Page Header */}
      <div className="section-header">
        <div>
          <h1 className="section-title">Session Management</h1>
          <p className="section-subtitle">Manage your WhatsApp sessions and connections</p>
        </div>
        <button
          onClick={() => {
            setSessions([]);
            loadExistingSessions();
          }}
          className="btn-secondary flex items-center gap-2"
        >
          <RotateCw className="w-5 h-5" />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">Total Sessions</p>
              <p className="stat-value">{totalSessions}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Server className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">Connected</p>
              <p className="stat-value">{connectedSessions}</p>
            </div>
            <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">Active</p>
              <p className="stat-value">{activeSessions}</p>
            </div>
            <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
              <Activity className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Start New Session Card */}
      <div className="card mb-8">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Start New Session</h2>
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Enter Session ID (e.g., MYSESSION)"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value.toUpperCase())}
            className="input flex-1"
            onKeyPress={(e) => {
              if (e.key === 'Enter' && sessionId.trim()) {
                handleStartSession(sessionId);
                setSessionId('');
              }
            }}
          />
          <button
            onClick={() => {
              if (sessionId.trim()) {
                handleStartSession(sessionId);
                setSessionId('');
              }
            }}
            className="btn-primary flex items-center gap-2"
          >
            <Play className="w-5 h-5" />
            Start Session
          </button>
          <button
            onClick={() => {
              if (sessionId.trim()) {
                handleAddExistingSession(sessionId);
                setSessionId('');
              }
            }}
            className="btn-secondary flex items-center gap-2"
            title="Add existing session (if already scanned before)"
          >
            <Plus className="w-5 h-5" />
            Add Existing
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Use "Start Session" for new, or "Add Existing" to restore previously scanned sessions
        </p>
      </div>

      {/* Active Sessions */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Active Sessions ({sessions.length})</h2>
        
        {sessions.length === 0 ? (
          <div className="card text-center py-16">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <QrCode className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">No Active Sessions</h3>
            <p className="text-slate-500">Start a new session to begin</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((session, index) => (
              <div 
                key={session.id} 
              className="card fade-in"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <div className="flex-shrink-0">
                    {getStatusIcon(session.status, session.state)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-slate-900">{session.id}</h3>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {getStatusText(session.status, session.state)}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCheckStatus(session.id)}
                    className="btn-secondary text-sm"
                    title="Check Status"
                  >
                    Status
                  </button>
                  <button
                    onClick={() => handleRestartSession(session.id)}
                    className="btn-icon"
                    disabled={session.status === 'starting' || session.status === 'restarting'}
                    title="Restart Session"
                  >
                    <RotateCw className="w-5 h-5 text-slate-600" />
                  </button>
                  <button
                    onClick={() => handleTerminateSession(session.id)}
                    className="btn-danger text-sm"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* QR Code Display */}
              {session.qr && (
                <div className="mt-6 p-6 bg-slate-50 border border-slate-200 rounded-xl flex flex-col items-center scale-in">
                  <div className="flex items-center gap-2 mb-4">
                    <QrCode className="w-5 h-5 text-emerald-600" />
                    <p className="text-slate-900 font-semibold">Scan QR Code</p>
                  </div>
                  <div className="p-4 bg-white rounded-lg border-2 border-emerald-200 shadow-sm">
                    <QRCodeSVG value={session.qr} size={220} level="H" />
                  </div>
                  <div className="mt-4 text-center">
                    <p className="text-slate-600 text-sm">
                      Open WhatsApp → Settings → Linked Devices
                    </p>
                    <p className="text-slate-500 text-xs mt-1">
                      Scan the QR code above to link your device
                    </p>
                  </div>
                </div>
              )}

              {/* Connection Info */}
              {session.state === 'CONNECTED' && (
                <div className="mt-4 alert alert-success scale-in">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    <div>
                      <p className="font-semibold">Session Connected</p>
                      <p className="text-xs mt-0.5">Ready to send and receive messages</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;

