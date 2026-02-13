#!/bin/bash

# Start frontend and backend in parallel for local testing (Linux/macOS compatible)
# Usage:
#   ./scripts/test/start-local-dev.sh
#   ./scripts/test/start-local-dev.sh --backend-dev
#   ./scripts/test/start-local-dev.sh --no-browser

set -e

# Parse arguments
BACKEND_DEV=false
OPEN_BROWSER=true

while [[ $# -gt 0 ]]; do
    case $1 in
        --backend-dev|-b)
            BACKEND_DEV=true
            shift
            ;;
        --no-browser|-n)
            OPEN_BROWSER=false
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--backend-dev] [--no-browser]"
            exit 1
            ;;
    esac
done

# Get script directory and repo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKEND_PATH="$REPO_ROOT/backend/server"
FRONTEND_PATH="$REPO_ROOT/frontend"
BACKEND_ENV_PATH="$BACKEND_PATH/.env"

# Check if package.json exists
if [[ ! -f "$BACKEND_PATH/package.json" ]]; then
    echo "Error: Cannot find backend package.json at $BACKEND_PATH"
    exit 1
fi

if [[ ! -f "$FRONTEND_PATH/package.json" ]]; then
    echo "Error: Cannot find frontend package.json at $FRONTEND_PATH"
    exit 1
fi

# Install dependencies if needed
echo "Checking dependencies..."
if [[ ! -d "$BACKEND_PATH/node_modules" ]]; then
    echo "Installing backend dependencies..."
    cd "$BACKEND_PATH"
    npm install
fi

if [[ ! -d "$FRONTEND_PATH/node_modules" ]]; then
    echo "Installing frontend dependencies..."
    cd "$FRONTEND_PATH"
    npm install
fi

# Determine backend command
BACKEND_COMMAND="npm start"
if [[ "$BACKEND_DEV" == true ]]; then
    BACKEND_COMMAND="npm run dev"
fi

FRONTEND_COMMAND="npm run dev"
FRONTEND_PORT=5173
BACKEND_PORT=3001

# Read .env file if it exists
if [[ -f "$BACKEND_ENV_PATH" ]]; then
    while IFS='=' read -r key value; do
        # Skip empty lines and comments
        [[ -z "$key" || "$key" =~ ^# ]] && continue
        
        # Remove leading/trailing whitespace
        key=$(echo "$key" | xargs)
        value=$(echo "$value" | xargs)
        
        if [[ "$key" == "PORT" ]]; then
            if [[ "$value" =~ ^[0-9]+$ ]]; then
                BACKEND_PORT=$value
            fi
        fi
    done < "$BACKEND_ENV_PATH"
fi

# Get LAN IP address
LAN_IP=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "")

# Check if running on macOS (different command)
if [[ "$OSTYPE" == "darwin"* ]]; then
    LAN_IP=$(ifconfig | grep "inet " | grep -v "127.0.0.1" | awk '{print $2}' | head -1 2>/dev/null || echo "")
fi

# Create cleanup function to kill child processes
cleanup() {
    echo ""
    echo "Stopping services..."
    kill $(jobs -p) 2>/dev/null || true
    exit 0
}

trap cleanup SIGINT SIGTERM

# Print startup information
echo ""
echo "Starting services:"
echo "  Backend  : $BACKEND_COMMAND"
echo "  Frontend : $FRONTEND_COMMAND"
echo ""

# Start backend
cd "$BACKEND_PATH"
echo "Starting backend in $BACKEND_PATH..."
eval "$BACKEND_COMMAND" &
BACKEND_PID=$!

# Start frontend
cd "$FRONTEND_PATH"
echo "Starting frontend in $FRONTEND_PATH..."
eval "$FRONTEND_COMMAND" &
FRONTEND_PID=$!

# Print test links
sleep 2
echo ""
echo "Test links:"
echo "  Frontend (local)       : http://localhost:$FRONTEND_PORT"
echo "  Backend health (local) : http://localhost:$BACKEND_PORT/health"
echo "  Backend API (local)    : http://localhost:$BACKEND_PORT/api/items"

if [[ -n "$LAN_IP" ]]; then
    echo "  Frontend (LAN)         : http://${LAN_IP}:$FRONTEND_PORT"
    echo "  Backend health (LAN)   : http://${LAN_IP}:$BACKEND_PORT/health"
fi

echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Open browser if requested
if [[ "$OPEN_BROWSER" == true ]]; then
    if command -v xdg-open &> /dev/null; then
        # Linux
        xdg-open "http://localhost:$FRONTEND_PORT" 2>/dev/null || true
        xdg-open "http://localhost:$BACKEND_PORT/health" 2>/dev/null || true
    elif command -v open &> /dev/null; then
        # macOS
        open "http://localhost:$FRONTEND_PORT"
        open "http://localhost:$BACKEND_PORT/health"
    fi
fi

# Wait for all background processes
wait
