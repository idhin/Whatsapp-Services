import { createContext, useContext, useState, useEffect } from 'react';
import { sessionAPI } from '../api/whatsapp';

const SessionContext = createContext();

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within SessionProvider');
  }
  return context;
};

export const SessionProvider = ({ children }) => {
  const [activeSessions, setActiveSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState('');

  // Load sessions from localStorage on mount
  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    const saved = localStorage.getItem('whatsapp-sessions');
    if (saved) {
      try {
        const sessionIds = JSON.parse(saved);
        const sessions = [];
        
        await Promise.all(
          sessionIds.map(async (id) => {
            try {
              const response = await sessionAPI.status(id);
              if (response.data.state === 'CONNECTED' || response.data.success) {
                sessions.push({
                  id,
                  state: response.data.state,
                  connected: response.data.state === 'CONNECTED'
                });
              }
            } catch (error) {
              console.log(`Session ${id} not available`);
            }
          })
        );
        
        setActiveSessions(sessions);
        
        // Auto-select first connected session
        const firstConnected = sessions.find(s => s.connected);
        if (firstConnected && !selectedSession) {
          setSelectedSession(firstConnected.id);
        }
      } catch (error) {
        console.error('Error loading sessions:', error);
      }
    }
  };

  const addSession = (sessionId) => {
    const saved = JSON.parse(localStorage.getItem('whatsapp-sessions') || '[]');
    if (!saved.includes(sessionId)) {
      saved.push(sessionId);
      localStorage.setItem('whatsapp-sessions', JSON.stringify(saved));
    }
    
    setActiveSessions(prev => {
      if (prev.find(s => s.id === sessionId)) return prev;
      return [...prev, { id: sessionId, state: null, connected: false }];
    });
    
    if (!selectedSession) {
      setSelectedSession(sessionId);
    }
  };

  const removeSession = (sessionId) => {
    const saved = JSON.parse(localStorage.getItem('whatsapp-sessions') || '[]');
    const filtered = saved.filter(s => s !== sessionId);
    localStorage.setItem('whatsapp-sessions', JSON.stringify(filtered));
    
    setActiveSessions(prev => prev.filter(s => s.id !== sessionId));
    
    if (selectedSession === sessionId) {
      setSelectedSession(activeSessions[0]?.id || '');
    }
  };

  const updateSessionState = (sessionId, state, connected) => {
    setActiveSessions(prev =>
      prev.map(s => s.id === sessionId ? { ...s, state, connected } : s)
    );
  };

  const value = {
    activeSessions,
    selectedSession,
    setSelectedSession,
    addSession,
    removeSession,
    updateSessionState,
    loadSessions,
    connectedSessions: activeSessions.filter(s => s.connected),
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
};

