import axios from 'axios';

const api = axios.create({
  baseURL: '',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add JWT token to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Handle 401 responses (unauthorized)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Remove invalid token
      localStorage.removeItem('auth_token');
      // Redirect to login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Session endpoints
export const sessionAPI = {
  start: (sessionId) => api.get(`/session/start/${sessionId}`),
  status: (sessionId) => api.get(`/session/status/${sessionId}`),
  qr: (sessionId) => api.get(`/session/qr/${sessionId}`),
  qrImage: (sessionId) => api.get(`/session/qr/${sessionId}/image`, { responseType: 'blob' }),
  restart: (sessionId) => api.get(`/session/restart/${sessionId}`),
  terminate: (sessionId) => api.get(`/session/terminate/${sessionId}`),
  terminateInactive: () => api.get('/session/terminateInactive'),
  terminateAll: () => api.get('/session/terminateAll'),
};

// Client endpoints
export const clientAPI = {
  getClassInfo: (sessionId) => api.get(`/client/getClassInfo/${sessionId}`),
  getChats: (sessionId) => api.get(`/client/getChats/${sessionId}`),
  getContacts: (sessionId) => api.get(`/client/getContacts/${sessionId}`),
  getChatById: (sessionId, chatId) => api.post(`/client/getChatById/${sessionId}`, { chatId }),
  getContactById: (sessionId, contactId) => api.post(`/client/getContactById/${sessionId}`, { contactId }),
  sendMessage: (sessionId, data) => api.post(`/client/sendMessage/${sessionId}`, data),
  getProfilePictureUrl: (sessionId, contactId) => api.post(`/client/getProfilePicUrl/${sessionId}`, { contactId }),
  isRegisteredUser: (sessionId, number) => api.post(`/client/isRegisteredUser/${sessionId}`, { number }),
  getNumberId: (sessionId, number) => api.post(`/client/getNumberId/${sessionId}`, { number }),
  createGroup: (sessionId, name, participants) => api.post(`/client/createGroup/${sessionId}`, { name, participants }),
  getState: (sessionId) => api.get(`/client/getState/${sessionId}`),
  setStatus: (sessionId, status) => api.post(`/client/setStatus/${sessionId}`, { status }),
};

// Chat endpoints
export const chatAPI = {
  getClassInfo: (sessionId, chatId) => api.post(`/chat/getClassInfo/${sessionId}`, { chatId }),
  clearMessages: (sessionId, chatId) => api.post(`/chat/clearMessages/${sessionId}`, { chatId }),
  deleteChat: (sessionId, chatId) => api.post(`/chat/delete/${sessionId}`, { chatId }),
  fetchMessages: (sessionId, chatId, searchOptions = {}) => 
    api.post(`/chat/fetchMessages/${sessionId}`, { chatId, searchOptions }),
  sendStateTyping: (sessionId, chatId) => api.post(`/chat/sendStateTyping/${sessionId}`, { chatId }),
  sendStateRecording: (sessionId, chatId) => api.post(`/chat/sendStateRecording/${sessionId}`, { chatId }),
};

// Group Chat endpoints
export const groupChatAPI = {
  getClassInfo: (sessionId, chatId) => api.post(`/groupChat/getClassInfo/${sessionId}`, { chatId }),
  addParticipants: (sessionId, chatId, contactIds) => 
    api.post(`/groupChat/addParticipants/${sessionId}`, { chatId, contactIds }),
  removeParticipants: (sessionId, chatId, contactIds) => 
    api.post(`/groupChat/removeParticipants/${sessionId}`, { chatId, contactIds }),
  promoteParticipants: (sessionId, chatId, contactIds) => 
    api.post(`/groupChat/promoteParticipants/${sessionId}`, { chatId, contactIds }),
  demoteParticipants: (sessionId, chatId, contactIds) => 
    api.post(`/groupChat/demoteParticipants/${sessionId}`, { chatId, contactIds }),
  getInviteCode: (sessionId, chatId) => api.post(`/groupChat/getInviteCode/${sessionId}`, { chatId }),
  revokeInvite: (sessionId, chatId) => api.post(`/groupChat/revokeInvite/${sessionId}`, { chatId }),
  leave: (sessionId, chatId) => api.post(`/groupChat/leave/${sessionId}`, { chatId }),
  setSubject: (sessionId, chatId, subject) => 
    api.post(`/groupChat/setSubject/${sessionId}`, { chatId, subject }),
  setDescription: (sessionId, chatId, description) => 
    api.post(`/groupChat/setDescription/${sessionId}`, { chatId, description }),
  setPicture: (sessionId, chatId, pictureMimetype, pictureData) => 
    api.post(`/groupChat/setPicture/${sessionId}`, { chatId, pictureMimetype, pictureData }),
  deletePicture: (sessionId, chatId) => api.post(`/groupChat/deletePicture/${sessionId}`, { chatId }),
};

// Contact endpoints
export const contactAPI = {
  getClassInfo: (sessionId, contactId) => api.post(`/contact/getClassInfo/${sessionId}`, { contactId }),
  block: (sessionId, contactId) => api.post(`/contact/block/${sessionId}`, { contactId }),
  unblock: (sessionId, contactId) => api.post(`/contact/unblock/${sessionId}`, { contactId }),
  getAbout: (sessionId, contactId) => api.post(`/contact/getAbout/${sessionId}`, { contactId }),
  getProfilePicUrl: (sessionId, contactId) => api.post(`/contact/getProfilePicUrl/${sessionId}`, { contactId }),
};

// Message endpoints
export const messageAPI = {
  delete: (sessionId, messageId) => api.post(`/message/delete/${sessionId}`, { messageId }),
  forward: (sessionId, messageId, chatId) => api.post(`/message/forward/${sessionId}`, { messageId, chatId }),
  react: (sessionId, messageId, reaction) => api.post(`/message/react/${sessionId}`, { messageId, reaction }),
  reply: (sessionId, messageId, content) => api.post(`/message/reply/${sessionId}`, { messageId, content }),
  star: (sessionId, messageId) => api.post(`/message/star/${sessionId}`, { messageId }),
  unstar: (sessionId, messageId) => api.post(`/message/unstar/${sessionId}`, { messageId }),
};

// Health check
export const healthAPI = {
  ping: () => api.get('/ping'),
};

export default api;

