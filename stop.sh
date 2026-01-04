#!/bin/bash
# ============================================
# WhatsApp Services - Stop Script
# ============================================
# Usage: 
#   ./stop.sh                - Stop only
#   ./stop.sh --clear        - Stop and clear sessions only
#   ./stop.sh --clear --all  - Stop and clear everything
# ============================================

echo "🛑 Stopping containers..."
docker-compose down

if [ "$1" == "--clear" ]; then
    echo "🗑️  Clearing WhatsApp sessions..."
    rm -rf ./sessions/session-*
    rm -f ./sessions/message_log.txt
    echo "✅ Sessions cleared!"
    
    if [ "$2" == "--all" ]; then
        echo "🗑️  Clearing webhooks data..."
        rm -f ./sessions/webhooks-data.json
        rm -f ./sessions/webhooks-history.json
        echo "✅ All data cleared!"
    fi
fi

echo ""
echo "✅ Services stopped!"
echo ""
echo "📊 Container status:"
docker ps | grep whatsapp || echo "   No WhatsApp containers running"

