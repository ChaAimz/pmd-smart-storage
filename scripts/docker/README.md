# Docker Deployment Scripts

## 📁 Files

| File | Description |
|------|-------------|
| `docker-compose.yml` | Local development with build from source |
| `docker-compose.portainer.yml` | Portainer stack with pre-built images |
| `docker-compose.portainer-build.yml` | Portainer stack that builds from source |
| `run-docker.sh` | Shell script to run containers locally |
| `export-images.sh` | Export images for Portainer deployment |

## 🚀 Deployment Options

### Option 1: Local Development (Build from Source)

```bash
cd scripts/docker
docker-compose up -d
```

Or use the shell script:
```bash
./scripts/docker/run-docker.sh
```

Access:
- Frontend: http://localhost
- Backend API: http://localhost:3001

### Option 2: Portainer with Pre-built Images

#### Step 1: Build and Export Images (on build machine)

```bash
# 1. Build images
docker build -t smart-storage-backend:latest ./backend/server
docker build -t smart-storage-frontend:latest ./frontend

# 2. Export images
./scripts/docker/export-images.sh
# Output: smart-storage-images-YYYYMMDD.tar.gz
```

#### Step 2: Import Images (on Portainer host)

```bash
# Copy file to Portainer host, then:
gunzip -c smart-storage-images-YYYYMMDD.tar.gz | docker load

# Verify images loaded
docker images | grep smart-storage
```

#### Step 3: Deploy Stack in Portainer

1. Open Portainer → Stacks → Add Stack
2. Name: `smart-storage`
3. Copy contents from `scripts/docker/docker-compose.portainer.yml`
4. Set environment variable (optional):
   - `JWT_SECRET`: Your secret key (default provided)
5. Deploy

Access:
- Frontend: http://portainer-host:8080
- Backend API: http://portainer-host:3001

### Option 3: Portainer with Build from Source

**Note:** Requires Portainer to have access to source code files.

1. Ensure source code is available on Portainer host at correct paths
2. Use `docker-compose.portainer-build.yml`
3. Update build context paths in the file to match your setup

## 🔧 Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | `smart-storage-secret-key-change-in-production` | JWT signing key |
| `PORT` | `3001` | Backend port |
| `NODE_ENV` | `production` | Node environment |
| `DATABASE_PATH` | `./data/warehouse.db` | SQLite database path |
| `MQTT_BROKER_URL` | `mqtt://mosquitto:1883` | MQTT broker URL |

### Volumes

| Volume | Purpose |
|--------|---------|
| `backend-data` | SQLite database persistence |
| `mosquitto-config` | MQTT broker configuration |
| `mosquitto-data` | MQTT messages persistence |
| `mosquitto-logs` | MQTT broker logs |

## 🐛 Troubleshooting

### Error: "Image not found" in Portainer

**Cause:** Images `smart-storage-backend:latest` and `smart-storage-frontend:latest` don't exist on Portainer host.

**Solution:**
```bash
# On Portainer host, check if images exist:
docker images | grep smart-storage

# If not found, import them:
gunzip -c smart-storage-images-YYYYMMDD.tar.gz | docker load
```

### Error: "500 Internal Server Error" on login

**Cause:** 
1. Backend database not initialized
2. JWT_SECRET mismatch
3. Database permissions issue

**Solution:**
```bash
# Check backend logs:
docker logs smart-storage-backend

# If database issue, check volume:
docker exec smart-storage-backend ls -la /app/data/

# Restart backend:
docker restart smart-storage-backend
```

### Frontend can't connect to backend

**Cause:** Frontend built with wrong API URL.

**Solution:** Rebuild frontend with correct API URL:
```bash
docker build \
  --build-arg VITE_API_URL=http://your-portainer-host:3001/api \
  -t smart-storage-frontend:latest ./frontend
```

## 📋 Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- For Portainer: Portainer CE 2.0+

## 🔒 Security Notes

1. **Change JWT_SECRET** in production:
   ```yaml
   environment:
     - JWT_SECRET=your-random-secret-key-here
   ```

2. **Use HTTPS** in production (add reverse proxy)

3. **Database backup**:
   ```bash
   docker exec smart-storage-backend sqlite3 /app/data/warehouse.db ".backup /app/data/backup.db"
   ```
