import { useSession } from '../context/SessionContext';
import { ChevronDown, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

const SessionSelector = ({ label = "Session ID" }) => {
  const { activeSessions, selectedSession, setSelectedSession, connectedSessions } = useSession();

  if (activeSessions.length === 0) {
    return (
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-2">{label}</label>
        <div className="input bg-slate-50 text-slate-400 flex items-center justify-between cursor-not-allowed">
          <span>No active sessions</span>
          <AlertCircle className="w-5 h-5 text-amber-500" />
        </div>
        <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          Please start a session in the Dashboard first
        </p>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-semibold text-slate-900 mb-2">{label}</label>
      <div className="relative">
        <select
          value={selectedSession}
          onChange={(e) => setSelectedSession(e.target.value)}
          className="input cursor-pointer"
        >
          <option value="">Select a session...</option>
          {activeSessions.map((session) => (
            <option key={session.id} value={session.id}>
              {session.id} {session.connected ? '✓' : ''}
            </option>
          ))}
        </select>
      </div>
      
      {/* Status indicator */}
      {selectedSession && (
        <div className="flex items-center gap-3 mt-2">
          {activeSessions.find(s => s.id === selectedSession)?.connected ? (
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-medium text-emerald-600">Connected</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <XCircle className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-medium text-amber-600">Not Connected</span>
            </div>
          )}
          <span className="text-xs text-slate-500">
            {connectedSessions.length} of {activeSessions.length} connected
          </span>
        </div>
      )}
    </div>
  );
};

export default SessionSelector;
