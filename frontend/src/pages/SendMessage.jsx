import { useState } from 'react';
import { clientAPI } from '../api/whatsapp';
import { useSession } from '../context/SessionContext';
import SessionSelector from '../components/SessionSelector';
import toast from 'react-hot-toast';
import { Send, FileText, Image, MapPin, Loader } from 'lucide-react';

const SendMessage = () => {
  const { selectedSession } = useSession();
  const [chatId, setChatId] = useState('');
  const [contentType, setContentType] = useState('string');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // For media
  const [mediaData, setMediaData] = useState('');
  const [mediaMimetype, setMediaMimetype] = useState('');
  const [mediaFilename, setMediaFilename] = useState('');

  // For location
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [locationDesc, setLocationDesc] = useState('');

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target.result.split(',')[1];
      setMediaData(base64);
      setMediaMimetype(file.type);
      setMediaFilename(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleSendMessage = async () => {
    if (!selectedSession) {
      toast.error('Please select a session');
      return;
    }

    if (!chatId.trim()) {
      toast.error('Please enter a chat ID');
      return;
    }

    setLoading(true);
    try {
      let payload = {
        chatId,
        contentType,
      };

      switch (contentType) {
        case 'string':
          if (!message.trim()) {
            toast.error('Please enter a message');
            setLoading(false);
            return;
          }
          payload.content = message;
          break;

        case 'MessageMedia':
          if (!mediaData) {
            toast.error('Please upload a file');
            setLoading(false);
            return;
          }
          payload.content = {
            mimetype: mediaMimetype,
            data: mediaData,
            filename: mediaFilename,
          };
          break;

        case 'MessageMediaFromURL':
          if (!message.trim()) {
            toast.error('Please enter a URL');
            setLoading(false);
            return;
          }
          payload.content = message;
          break;

        case 'Location':
          if (!latitude || !longitude) {
            toast.error('Please enter latitude and longitude');
            setLoading(false);
            return;
          }
          payload.content = {
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
            description: locationDesc,
          };
          break;

        default:
          toast.error('Invalid content type');
          setLoading(false);
          return;
      }

      const response = await clientAPI.sendMessage(selectedSession, payload);
      
      if (response.data.success) {
        toast.success('Message sent successfully!');
        // Clear form
        setMessage('');
        setMediaData('');
        setMediaFilename('');
        setLatitude('');
        setLongitude('');
        setLocationDesc('');
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  const renderContentInput = () => {
    switch (contentType) {
      case 'string':
        return (
          <div>
            <label className="block text-sm font-medium mb-2">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message here..."
              className="input min-h-[120px] resize-y"
              rows={5}
            />
          </div>
        );

      case 'MessageMedia':
        return (
          <div>
            <label className="block text-sm font-medium mb-2">Upload File</label>
            <input
              type="file"
              onChange={handleFileUpload}
              className="input"
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
            />
            {mediaFilename && (
              <p className="text-sm text-emerald-600 mt-2">
                ✓ File loaded: {mediaFilename}
              </p>
            )}
          </div>
        );

      case 'MessageMediaFromURL':
        return (
          <div>
            <label className="block text-sm font-medium mb-2">Media URL</label>
            <input
              type="url"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="input"
            />
          </div>
        );

      case 'Location':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Latitude</label>
              <input
                type="number"
                step="any"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="-6.2088"
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Longitude</label>
              <input
                type="number"
                step="any"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="106.8456"
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Description (Optional)</label>
              <input
                type="text"
                value={locationDesc}
                onChange={(e) => setLocationDesc(e.target.value)}
                placeholder="Jakarta, Indonesia"
                className="input"
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto fade-in">
      {/* Page Header */}
      <div className="section-header">
        <div>
          <h1 className="section-title">Send Message</h1>
          <p className="section-subtitle">Compose and send messages to your contacts</p>
        </div>
      </div>

      <div className="card">
        <div className="space-y-6">
          {/* Session ID */}
          <SessionSelector label="Session ID" />

          {/* Chat ID */}
          <div>
            <label className="block text-sm font-medium mb-2 text-slate-900">Chat ID</label>
            <input
              type="text"
              placeholder="6281234567890@c.us or 120363123456789012@g.us"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              className="input"
            />
            <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
              💬 Use @c.us for personal chats, 👥 @g.us for groups
            </p>
          </div>

          {/* Content Type */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-3">Message Type</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button
                onClick={() => setContentType('string')}
                className={`p-5 rounded-xl border-2 transition-all duration-200 text-center ${
                  contentType === 'string'
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-slate-200 bg-white hover:border-emerald-300'
                }`}
              >
                <FileText className={`w-6 h-6 mx-auto mb-2 ${
                  contentType === 'string' ? 'text-emerald-600' : 'text-slate-400'
                }`} />
                <p className="text-sm font-medium text-slate-900">Text</p>
              </button>

              <button
                onClick={() => setContentType('MessageMedia')}
                className={`p-5 rounded-xl border-2 transition-all duration-200 text-center ${
                  contentType === 'MessageMedia'
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-slate-200 bg-white hover:border-emerald-300'
                }`}
              >
                <Image className={`w-6 h-6 mx-auto mb-2 ${
                  contentType === 'MessageMedia' ? 'text-emerald-600' : 'text-slate-400'
                }`} />
                <p className="text-sm font-medium text-slate-900">Upload File</p>
              </button>

              <button
                onClick={() => setContentType('MessageMediaFromURL')}
                className={`p-5 rounded-xl border-2 transition-all duration-200 text-center ${
                  contentType === 'MessageMediaFromURL'
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-slate-200 bg-white hover:border-emerald-300'
                }`}
              >
                <Image className={`w-6 h-6 mx-auto mb-2 ${
                  contentType === 'MessageMediaFromURL' ? 'text-emerald-600' : 'text-slate-400'
                }`} />
                <p className="text-sm font-medium text-slate-900">From URL</p>
              </button>

              <button
                onClick={() => setContentType('Location')}
                className={`p-5 rounded-xl border-2 transition-all duration-200 text-center ${
                  contentType === 'Location'
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-slate-200 bg-white hover:border-emerald-300'
                }`}
              >
                <MapPin className={`w-6 h-6 mx-auto mb-2 ${
                  contentType === 'Location' ? 'text-emerald-600' : 'text-slate-400'
                }`} />
                <p className="text-sm font-medium text-slate-900">Location</p>
              </button>
            </div>
          </div>

          {/* Content Input */}
          {renderContentInput()}

          {/* Send Button */}
          <button
            onClick={handleSendMessage}
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-3 text-lg py-4 ripple disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader className="w-6 h-6 animate-spin" />
                <span className="font-bold">Sending...</span>
              </>
            ) : (
              <>
                <Send className="w-6 h-6" />
                <span className="font-bold">Send Message</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Info Box */}
      <div className="card mt-6 bg-blue-50 border border-blue-200">
        <h3 className="font-semibold mb-2 text-blue-700">💡 Tips</h3>
        <ul className="text-sm text-slate-600 space-y-1">
          <li>• Get Chat IDs from the Chats page</li>
          <li>• Personal chat format: <code className="bg-slate-100 px-1 rounded">6281234567890@c.us</code></li>
          <li>• Group chat format: <code className="bg-slate-100 px-1 rounded">120363123456789012@g.us</code></li>
          <li>• Make sure your session is connected before sending</li>
        </ul>
      </div>
    </div>
  );
};

export default SendMessage;

