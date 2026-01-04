#!/bin/bash
# ============================================
# WhatsApp Services - Stop Script
# ============================================
# Stops all containers and optionally clears sessions
#
# Usage: 
#   ./stop.sh           - Stop only
#   ./stop.sh --clear   - Stop and clear all sessions
# ============================================

echo "🛑 Stopping containers..."
docker-compose down

if [ "$1" == "--clear" ]; then
    echo "🗑️  Clearing all sessions..."
    rm -rf ./sessions/session-*
    rm -f ./sessions/message_log.txt
    rm -f ./sessions/webhooks-data.json
    rm -f ./sessions/webhooks-history.json
    echo "✅ Sessions cleared!"
fi

echo ""
echo "✅ Services stopped!"
echo ""
echo "📊 Container status:"
docker ps | grep whatsapp || echo "   No WhatsApp containers running"

