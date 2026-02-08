# Backend Dockerfile for Smart Storage Server V2
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Install wget for healthcheck
RUN apk add --no-cache wget

# Copy source code - using V2 files
COPY src/index-new.js ./src/index.js
COPY src/database-new.js ./src/database-new.js
COPY src/routes/api-v2.js ./src/routes/api.js
COPY src/services/ ./src/services/
COPY data/ ./data/

# Create data directory if not exists
RUN mkdir -p /app/data

# Expose port
EXPOSE 3001

# Environment variables (can be overridden)
ENV PORT=3001
ENV NODE_ENV=production
ENV LOG_LEVEL=info
ENV MQTT_BROKER_URL=mqtt://mosquitto:1883
ENV DATABASE_PATH=./data/warehouse.db
ENV API_PREFIX=/api
ENV JWT_SECRET=smart-storage-secret-key

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Run the server
CMD ["node", "src/index.js"]
