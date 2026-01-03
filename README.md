# WhatsApp Services

WhatsApp Web API with Professional Dashboard - A complete solution for WhatsApp automation with REST API backend and modern React frontend.

## 👨‍💻 Developer

**Khulafaur Rasyidin** - [rasyid.in](https://rasyid.in)

## 🙏 Credits & Attribution

This project is developed based on the excellent work by **Christophe Hubert**:
- **Original Project**: [chrishubert/whatsapp-api](https://github.com/chrishubert/whatsapp-api)
- **Library Used**: [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js)

Special thanks to the original creators for their amazing work on the WhatsApp Web API wrapper.

## ✨ What's New in This Fork

- 🎨 **Professional Dashboard** - Beautiful React frontend with modern UI
- 📱 **Session Management** - Easy QR code scanning and session handling via UI
- 💬 **Chat Browser** - Browse and manage your WhatsApp chats
- ✉️ **Message Sender** - Send messages directly from the dashboard
- 🔗 **Webhook Generator** - Create webhooks for external integrations
- 🎯 **Real-time Updates** - Live session status and notifications

## 📸 Features

### Backend (REST API)
- Multi-session support
- Send text, media, location messages
- Group management
- Contact management
- Webhook callbacks
- Rate limiting
- Swagger documentation

### Frontend (Dashboard)
- Session management with QR code display
- Chat list browser
- Message composer (text, media, location)
- Webhook management with full documentation
- Professional light theme UI

## 🚀 Quick Start

### Prerequisites
- Node.js >= 18.0.0
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/idhin/Whatsapp-Services.git
cd Whatsapp-Services

# Install all dependencies (backend + frontend)
npm run install:all

# Or install separately
npm install
cd frontend && npm install
```

### Configuration

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=3000
API_KEY=your_api_key_here

# Webhook Configuration
BASE_WEBHOOK_URL=http://localhost:3000/localCallbackExample

# Optional Settings
ENABLE_LOCAL_CALLBACK_EXAMPLE=TRUE
ENABLE_SWAGGER_ENDPOINT=TRUE
```

### Running the Application

**Option 1: Run Both (Recommended)**
```bash
npm run dev:all
```

**Option 2: Run Separately**
```bash
# Terminal 1 - Backend
npm start

# Terminal 2 - Frontend
cd frontend && npm run dev
```

### Access Points
- **Dashboard**: http://localhost:5173
- **API**: http://localhost:3000
- **Swagger Docs**: http://localhost:3000/api-docs

## 🐳 Docker Deployment

### Quick Start with Docker Compose

The easiest way to deploy is using Docker Compose, which runs both backend and frontend containers:

```bash
# Build and start both services
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

**Access Points:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

### Production Deployment with External Nginx

For production environments with an existing nginx server, use separate domains:

**1. Update DNS Records**
```
dashboard.yourdomain.com → Your Server IP
api.yourdomain.com → Your Server IP
```

**2. Configure External Nginx**

Copy the example configuration:
```bash
sudo cp nginx-example.conf /etc/nginx/sites-available/whatsapp-services
sudo nano /etc/nginx/sites-available/whatsapp-services

# Update server_name values:
# - dashboard.yourdomain.com (line 23)
# - api.yourdomain.com (line 56)
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/whatsapp-services /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

**3. Start Docker Containers**
```bash
docker-compose up -d --build
```

**4. Setup SSL (Optional but Recommended)**
```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificates
sudo certbot --nginx -d dashboard.yourdomain.com
sudo certbot --nginx -d api.yourdomain.com

# Auto-renewal is configured automatically
```

**Access Points:**
- Frontend: https://dashboard.yourdomain.com
- Backend API: https://api.yourdomain.com

### Docker Commands Reference

```bash
# Build only
docker-compose build

# Start in foreground (see logs)
docker-compose up

# Start in background
docker-compose up -d

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Restart specific service
docker-compose restart backend
docker-compose restart frontend

# Stop all services
docker-compose down

# Remove volumes (WARNING: deletes session data)
docker-compose down -v
```

### Environment Variables

Create `.env` file in project root for production:

```env
# Backend
PORT=3000
API_KEY=your_secure_api_key_here
BASE_WEBHOOK_URL=https://api.yourdomain.com/localCallbackExample
ENABLE_LOCAL_CALLBACK_EXAMPLE=FALSE
ENABLE_SWAGGER_ENDPOINT=TRUE
MAX_ATTACHMENT_SIZE=5000000

# Frontend
NODE_ENV=production
```

### Updating the Application

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose up -d --build

# Check if containers are running
docker-compose ps
```

### Troubleshooting

**Container won't start:**
```bash
docker-compose logs backend
docker-compose logs frontend
```

**Reset everything:**
```bash
docker-compose down
docker-compose up --build --force-recreate
```

**Check container status:**
```bash
docker ps
docker stats
```

## 📖 Usage

### 1. Start a Session
1. Open the Dashboard at http://localhost:5173
2. Enter a Session ID (e.g., "MYSESSION")
3. Click "Start Session"
4. Scan the QR code with WhatsApp mobile app

### 2. Send Messages
1. Go to "Send Message" page
2. Select your active session
3. Enter Chat ID (format: `6281234567890@c.us` for personal, `120363...@g.us` for groups)
4. Type your message and send

### 3. Create Webhooks
1. Go to "Webhooks" page
2. Create a new webhook with target chat
3. Use the generated URL in your external applications
4. Send POST requests with `{ "message": "your text" }`

## 🔌 API Endpoints

### Sessions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/session/start/:sessionId` | Start a new session |
| GET | `/session/status/:sessionId` | Get session status |
| GET | `/session/qr/:sessionId` | Get QR code |
| GET | `/session/terminate/:sessionId` | End a session |

### Messages
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/client/sendMessage/:sessionId` | Send a message |
| GET | `/client/getChats/:sessionId` | Get all chats |
| GET | `/client/getContacts/:sessionId` | Get all contacts |

### Groups
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/groupChat/create/:sessionId` | Create a group |
| GET | `/groupChat/getAllGroups/:sessionId` | Get all groups |
| POST | `/groupChat/inviteUser/:sessionId` | Invite user to group |

See full documentation at `/api-docs` endpoint.

## 📁 Project Structure

```
whatsapp-services/
├── server.js           # Backend entry point
├── src/
│   ├── app.js          # Express app setup
│   ├── routes.js       # API routes
│   ├── sessions.js     # Session management
│   ├── controllers/    # Route controllers
│   └── utils.js        # Utility functions
├── frontend/           # React dashboard
│   ├── src/
│   │   ├── pages/      # Dashboard pages
│   │   ├── components/ # Reusable components
│   │   ├── api/        # API clients
│   │   └── context/    # React context
│   └── vite.config.js
├── docker-compose.yml
├── Dockerfile
└── package.json
```

## ⚠️ Disclaimer

This project is not affiliated, associated, authorized, endorsed by, or in any way officially connected with WhatsApp or any of its subsidiaries or its affiliates. The official WhatsApp website can be found at https://whatsapp.com.

**Use at your own risk.** WhatsApp does not allow bots or unofficial clients on their platform.

## 📄 License

This project is licensed under the MIT License - see the original [LICENSE](https://github.com/chrishubert/whatsapp-api/blob/master/LICENSE.md) from the parent project.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

**Developed with ❤️ by [Khulafaur Rasyidin](https://rasyid.in)**

*Based on [whatsapp-api](https://github.com/chrishubert/whatsapp-api) by Christophe Hubert*
