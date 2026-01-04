#!/bin/bash
# ============================================
# WhatsApp Services - Startup Script
# ============================================
# This script clears all sessions before starting
# to prevent memory issues from orphaned sessions
#
# Usage: ./start.sh
# ============================================

echo "🔄 Stopping existing containers..."
docker-compose down

echo "🗑️  Clearing all WhatsApp sessions..."
# Remove all session folders but keep the sessions directory
rm -rf ./sessions/session-*
rm -f ./sessions/message_log.txt
rm -f ./sessions/webhooks-data.json
rm -f ./sessions/webhooks-history.json

echo "✅ Sessions cleared!"
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

