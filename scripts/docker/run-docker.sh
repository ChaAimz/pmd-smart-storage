#!/bin/bash
# Docker Run Script for Smart Storage Application

set -e

# Get project root directory (parent of scripts/docker)
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_ROOT"

echo "==================================="
echo "Smart Storage - Docker Deployment"
echo "Project Root: $PROJECT_ROOT"
echo "==================================="

# Create Docker network if not exists
if ! docker network ls | grep -q smart-storage-network; then
    echo "Creating Docker network..."
    docker network create smart-storage-network
fi

# Stop and remove existing containers
echo "Stopping existing containers..."
docker stop smart-storage-mosquitto smart-storage-backend smart-storage-frontend 2>/dev/null || true
docker rm smart-storage-mosquitto smart-storage-backend smart-storage-frontend 2>/dev/null || true

# Create volumes directories
mkdir -p mosquitto/data mosquitto/log

# Start Mosquitto MQTT Broker
echo "Starting Mosquitto MQTT Broker..."
docker run -d \
    --name smart-storage-mosquitto \
    --network smart-storage-network \
    -p 1883:1883 \
    -p 9001:9001 \
    -v "$(pwd)/mosquitto/config/mosquitto.conf:/mosquitto/config/mosquitto.conf:ro" \
    -v mosquitto-data:/mosquitto/data \
    -v mosquitto-logs:/mosquitto/log \
    eclipse-mosquitto:2

# Wait for Mosquitto to be ready
echo "Waiting for Mosquitto to be ready..."
sleep 3

# Start Backend
echo "Starting Backend API Server..."
docker run -d \
    --name smart-storage-backend \
    --network smart-storage-network \
    -p 3001:3001 \
    -e PORT=3001 \
    -e NODE_ENV=production \
    -e LOG_LEVEL=info \
    -e MQTT_BROKER_URL=mqtt://smart-storage-mosquitto:1883 \
    -e DATABASE_PATH=./data/warehouse.db \
    -e API_PREFIX=/api \
    -v backend-data:/app/data \
    smart-storage-backend:latest

# Wait for backend to be ready
echo "Waiting for Backend to be ready..."
sleep 5

# Start Frontend
echo "Starting Frontend Web Dashboard..."
docker run -d \
    --name smart-storage-frontend \
    --network smart-storage-network \
    -p 8080:80 \
    -e NGINX_HOST=localhost \
    -e NGINX_PORT=80 \
    smart-storage-frontend:latest

echo ""
echo "==================================="
echo "Deployment Complete!"
echo "==================================="
echo ""
echo "Services:"
echo "  - Frontend: http://localhost:8080"
echo "  - Backend API: http://localhost:3001"
echo "  - Backend Health: http://localhost:3001/health"
echo "  - MQTT Broker: mqtt://localhost:1883"
echo ""
echo "To view logs:"
echo "  docker logs -f smart-storage-backend"
echo "  docker logs -f smart-storage-frontend"
echo "  docker logs -f smart-storage-mosquitto"
echo ""
echo "To stop:"
echo "  docker stop smart-storage-frontend smart-storage-backend smart-storage-mosquitto"
echo ""
