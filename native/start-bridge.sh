#!/bin/bash
# Start Bit7Bridge standalone IMCore bridge.
# Messages.app runs normally alongside — do NOT kill it.
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
BRIDGE="$DIR/Bit7Bridge/Bit7Bridge"

if [ ! -f "$BRIDGE" ]; then
  echo "Building Bit7Bridge..."
  bash "$DIR/Bit7Bridge/build.sh"
fi

# Kill any existing bridge instance
pkill -f "Bit7Bridge/Bit7Bridge" 2>/dev/null || true
sleep 1

# Ensure Messages.app is running (imagent needs it for account state)
open -a Messages
sleep 3

echo "Starting Bit7Bridge..."
"$BRIDGE" &
BRIDGE_PID=$!

echo "Waiting for bridge to start..."
sleep 5

if curl -s http://localhost:5050/health | grep -q '"ok":true'; then
  echo "Bit7Bridge is running on localhost:5050 (PID: $BRIDGE_PID)"
else
  echo "Warning: Bridge may not be ready. Check output above."
  echo "Try: curl http://localhost:5050/health"
fi
