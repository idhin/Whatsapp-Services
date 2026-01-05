#!/bin/bash
# ============================================
# WhatsApp Services - Startup Script
# ============================================
# Usage: 
#   ./start.sh          - Start/rebuild without clearing data
#   ./start.sh --clear  - Clear all sessions before starting
# ============================================

echo "🔄 Stopping existing containers..."
docker-compose down

if [ "$1" == "--clear" ]; then
  echo "🗑️  Clearing all WhatsApp sessions..."
  rm -rf ./sessions/session-*
  rm -f ./sessions/message_log.txt
  echo "✅ Sessions cleared!"
  echo ""
  
  if [ "$2" == "--all" ]; then
    echo "🗑️  Clearing webhooks data too..."
    rm -f ./sessions/webhooks-data.json
    rm -f ./sessions/webhooks-history.json
    echo "✅ All data cleared!"
  fi
else
  echo "📦 Keeping existing sessions and webhooks data..."
  
  # Remove Chromium lock files to prevent "profile in use" errors
  # This is necessary when container was stopped unexpectedly
  echo "🔓 Cleaning up browser lock files..."
  find ./sessions -name "SingletonLock" -delete 2>/dev/null
  find ./sessions -name "SingletonCookie" -delete 2>/dev/null
  find ./sessions -name "SingletonSocket" -delete 2>/dev/null
  find ./sessions -name "lockfile" -delete 2>/dev/null
  # Also clean up any crashed Chromium state
  find ./sessions -name "Crashpad" -type d -exec rm -rf {} + 2>/dev/null
  echo "✅ Lock files cleaned!"
fi

echo ""
echo "📂 Current sessions folder:"
ls -la ./sessions/ 2>/dev/null || echo "   (empty or not exists)"
echo ""

echo "🚀 Starting services..."
docker-compose up -d --build

echo ""
echo "✅ Services started!"
echo ""
echo "📊 Container status:"
docker-compose ps
echo ""
echo "📝 To view logs: docker-compose logs -f"
echo "🛑 To stop: docker-compose down"
echo ""
echo "💡 Tips:"
echo "   ./start.sh            - Rebuild tanpa hapus data"
echo "   ./start.sh --clear    - Hapus sessions saja"
echo "   ./start.sh --clear --all - Hapus semua (sessions + webhooks)"

