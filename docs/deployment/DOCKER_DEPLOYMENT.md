# Docker Deployment Guide

This guide explains how to build and run the PMD Smart Storage application using Docker.

## Overview

The Docker deployment includes three services:

| Service | Description | Port |
|---------|-------------|------|
| **Frontend** | React + Vite dashboard served by Nginx | 8080 |
| **Backend** | Node.js + Express API server | 3001 |
| **Mosquitto** | Eclipse Mosquitto MQTT Broker | 1883, 9001 |

## Prerequisites

- Docker 20.10+
- Linux/macOS/Windows with WSL2

## Quick Start

### 1. Build Images

```bash
# Build backend image
cd backend/server
docker build -t smart-storage-backend:latest .

# Build frontend image  
cd ../frontend
docker build -t smart-storage-frontend:latest .
```

Or use the provided script:

```bash
./run-docker.sh
```

### 2. Run Containers

```bash
./run-docker.sh
```

This script will:
- Create a Docker network
- Start Mosquitto MQTT broker
- Start Backend API server
- Start Frontend web dashboard
- Configure proper networking between services

## Accessing the Application

| Service | URL |
|---------|-----|
| Frontend Dashboard | http://localhost:8080 |
| Backend API | http://localhost:3001 |
| Health Check | http://localhost:3001/health |
| MQTT Broker | mqtt://localhost:1883 |

### Default Login Credentials

- **Username:** `admin`
- **Password:** `admin123`

## Manual Docker Commands

If you prefer to run containers manually:

### Create Network

```bash
docker network create smart-storage-network
```

### Run Mosquitto

```bash
docker run -d \
    --name smart-storage-mosquitto \
    --network smart-storage-network \
    -p 1883:1883 \
    -p 9001:9001 \
    -v "$(pwd)/mosquitto/config/mosquitto.conf:/mosquitto/config/mosquitto.conf:ro" \
    eclipse-mosquitto:2
```

### Run Backend

```bash
docker run -d \
    --name smart-storage-backend \
    --network smart-storage-network \
    -p 3001:3001 \
    -e PORT=3001 \
    -e NODE_ENV=production \
    -e MQTT_BROKER_URL=mqtt://smart-storage-mosquitto:1883 \
    -e DATABASE_PATH=./data/warehouse.db \
    -v backend-data:/app/data \
    smart-storage-backend:latest
```

### Run Frontend

```bash
docker run -d \
    --name smart-storage-frontend \
    --network smart-storage-network \
    -p 8080:80 \
    smart-storage-frontend:latest
```

## Environment Variables

### Backend

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3001 | Server port |
| `NODE_ENV` | production | Environment mode |
| `LOG_LEVEL` | info | Logging level |
| `MQTT_BROKER_URL` | mqtt://mosquitto:1883 | MQTT broker connection |
| `DATABASE_PATH` | ./data/warehouse.db | SQLite database path |
| `API_PREFIX` | /api | API route prefix |

### Frontend

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | http://localhost:3001/api | Backend API URL |

## Data Persistence

Docker volumes are used for data persistence:

- `backend-data`: SQLite database files
- `mosquitto-data`: MQTT broker data
- `mosquitto-logs`: MQTT broker logs

## Viewing Logs

```bash
# Backend logs
docker logs -f smart-storage-backend

# Frontend logs
docker logs -f smart-storage-frontend

# Mosquitto logs
docker logs -f smart-storage-mosquitto
```

## Stopping Services

```bash
# Stop all containers
docker stop smart-storage-frontend smart-storage-backend smart-storage-mosquitto

# Remove all containers
docker rm smart-storage-frontend smart-storage-backend smart-storage-mosquitto

# Or use the shortcut
./run-docker.sh stop
```

## Troubleshooting

### MQTT Connection Issues

Check Mosquitto logs:
```bash
docker logs smart-storage-mosquitto
```

### Backend Database Issues

Check if the data volume is mounted:
```bash
docker inspect smart-storage-backend | grep -A 5 "Mounts"
```

### Frontend Not Loading

Check Nginx configuration:
```bash
docker exec smart-storage-frontend cat /etc/nginx/conf.d/default.conf
```

### Reset Everything

```bash
# Stop and remove all containers
docker stop smart-storage-frontend smart-storage-backend smart-storage-mosquitto
docker rm smart-storage-frontend smart-storage-backend smart-storage-mosquitto

# Remove volumes (WARNING: This will delete all data!)
docker volume rm backend-data mosquitto-data mosquitto-logs

# Re-run
./run-docker.sh
```

## Health Checks

All containers include health checks:

- **Backend**: Checks `http://localhost:3001/health`
- **Frontend**: Checks `http://localhost:80`

Check health status:
```bash
docker ps
```

## Production Deployment Considerations

1. **Security**: Update Mosquitto config to disable anonymous access
2. **SSL/TLS**: Use reverse proxy (nginx/traefik) with SSL certificates
3. **Backups**: Regularly backup the `backend-data` volume
4. **Monitoring**: Add monitoring tools like Prometheus/Grafana
5. **Environment Variables**: Use proper secrets management

## File Structure

```
pmd-smart-storage/
├── backend/server/
│   ├── Dockerfile          # Backend image definition
│   └── .dockerignore       # Exclude files from build
├── frontend/
│   ├── Dockerfile          # Frontend image definition
│   ├── nginx.conf          # Nginx configuration
│   ├── tsconfig.docker.json # Relaxed TS config for Docker
│   └── .dockerignore       # Exclude files from build
├── mosquitto/
│   └── config/
│       └── mosquitto.conf  # MQTT broker configuration
├── docker-compose.yml      # Docker Compose configuration
├── run-docker.sh           # Quick start script
└── DOCKER_DEPLOYMENT.md    # This guide
```
