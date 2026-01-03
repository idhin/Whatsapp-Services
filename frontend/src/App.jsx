import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SessionProvider } from './context/SessionContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Chats from './pages/Chats';
import SendMessage from './pages/SendMessage';
import Webhooks from './pages/Webhooks';

function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="chats" element={<Chats />} />
            <Route path="send" element={<SendMessage />} />
            <Route path="webhooks" element={<Webhooks />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  );
}

export default App;
