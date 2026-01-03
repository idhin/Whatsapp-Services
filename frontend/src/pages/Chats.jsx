import { useState, useEffect } from 'react';
import { clientAPI } from '../api/whatsapp';
import { useSession } from '../context/SessionContext';
import SessionSelector from '../components/SessionSelector';
import toast from 'react-hot-toast';
import { Copy, Search, Users, User, MessageSquare, RefreshCw } from 'lucide-react';

const Chats = () => {
  const { selectedSession } = useSession();
  const [chats, setChats] = useState([]);
  const [filteredChats, setFilteredChats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all'); // all, personal, groups

  const handleLoadChats = async () => {
    if (!selectedSession) {
      toast.error('Please select a session');
      return;
    }

    setLoading(true);
    try {
      const response = await clientAPI.getChats(selectedSession);
      if (response.data.success) {
        setChats(response.data.chats);
        setFilteredChats(response.data.chats);
        toast.success(`Loaded ${response.data.chats.length} chats`);
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to load chats');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const getChatId = (chat) => {
    return chat.id?._serialized || chat.id || 'Unknown';
  };

  const isGroup = (chat) => {
    return chat.isGroup || getChatId(chat).includes('@g.us');
  };

  useEffect(() => {
    let filtered = chats;

    // Filter by type
    if (filter === 'personal') {
      filtered = filtered.filter(chat => !isGroup(chat));
    } else if (filter === 'groups') {
      filtered = filtered.filter(chat => isGroup(chat));
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(chat => 
        chat.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getChatId(chat).toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredChats(filtered);
  }, [searchTerm, filter, chats]);

  return (
    <div className="max-w-7xl mx-auto fade-in">
      {/* Page Header */}
      <div className="section-header">
        <div>
          <h1 className="section-title">Chats & Groups</h1>
          <p className="section-subtitle">Browse and manage your conversations</p>
        </div>
      </div>

      {/* Session Selector Card */}
      <div className="card mb-6">
        <div className="flex gap-4">
          <div className="flex-1">
            <SessionSelector label="Select Session" />
          </div>
          <button
            onClick={handleLoadChats}
            disabled={loading}
            className="btn-primary flex items-center gap-2"
          >
            {loading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <MessageSquare className="w-5 h-5" />
                Load Chats
              </>
            )}
          </button>
        </div>
      </div>

      {chats.length > 0 && (
        <>
          {/* Search & Filters */}
          <div className="card mb-6">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search chats..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input pl-10"
                />
              </div>

              {/* Filter Tabs */}
              <div className="tabs">
                <button
                  onClick={() => setFilter('all')}
                  className={`tab ${filter === 'all' ? 'active' : ''}`}
                >
                  All ({chats.length})
                </button>
                <button
                  onClick={() => setFilter('personal')}
                  className={`tab ${filter === 'personal' ? 'active' : ''}`}
                >
                  <User className="w-4 h-4 inline mr-1" />
                  Personal ({chats.filter(c => !isGroup(c)).length})
                </button>
                <button
                  onClick={() => setFilter('groups')}
                  className={`tab ${filter === 'groups' ? 'active' : ''}`}
                >
                  <Users className="w-4 h-4 inline mr-1" />
                  Groups ({chats.filter(c => isGroup(c)).length})
                </button>
              </div>
            </div>
          </div>

          {/* Chat List */}
          <div className="space-y-3">
            {filteredChats.length === 0 ? (
              <div className="card text-center py-16">
                <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No chats found</p>
              </div>
            ) : (
              filteredChats.map((chat, index) => {
                const chatId = getChatId(chat);
                const isGroupChat = isGroup(chat);
                
                return (
                  <div 
                    key={index} 
                    className="card hover:shadow-md transition-shadow duration-200 fade-in"
                    style={{ animationDelay: `${index * 0.02}s` }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        {/* Avatar */}
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          isGroupChat 
                            ? 'bg-blue-100' 
                            : 'bg-emerald-100'
                        }`}>
                          {isGroupChat ? (
                            <Users className="w-6 h-6 text-blue-600" />
                          ) : (
                            <User className="w-6 h-6 text-emerald-600" />
                          )}
                        </div>

                        {/* Chat Info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-slate-900 truncate">
                            {chat.name || 'Unknown'}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`badge ${
                              isGroupChat 
                                ? 'badge-info' 
                                : 'badge-neutral'
                            }`}>
                              {isGroupChat ? 'Group' : 'Personal'}
                            </span>
                            {chat.unreadCount > 0 && (
                              <span className="badge badge-error">
                                {chat.unreadCount} unread
                              </span>
                            )}
                          </div>
                          <code className="text-xs text-slate-500 truncate block mt-1">
                            {chatId}
                          </code>
                        </div>

                        {/* Copy Button */}
                        <button
                          onClick={() => copyToClipboard(chatId)}
                          className="btn-icon flex-shrink-0"
                          title="Copy Chat ID"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
              )
            }
          </div>
        </>
      )}
    </div>
  );
};

export default Chats;

