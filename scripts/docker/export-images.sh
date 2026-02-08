#!/bin/bash
# Export Docker images for Portainer deployment

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_ROOT"

echo "==================================="
echo "Export Smart Storage Images"
echo "==================================="

# Check if images exist
if ! docker images | grep -q "smart-storage-backend"; then
    echo "❌ smart-storage-backend:latest not found!"
    echo "   Run: docker build -t smart-storage-backend:latest ./backend/server"
    exit 1
fi

if ! docker images | grep -q "smart-storage-frontend"; then
    echo "❌ smart-storage-frontend:latest not found!"
    echo "   Run: docker build -t smart-storage-frontend:latest ./frontend"
    exit 1
fi

echo ""
echo "Found images:"
docker images | grep "smart-storage"

# Export images
echo ""
echo "📦 Exporting images..."
OUTPUT_FILE="smart-storage-images-$(date +%Y%m%d).tar.gz"

docker save smart-storage-backend:latest smart-storage-frontend:latest | gzip > "$OUTPUT_FILE"

echo ""
echo "✅ Export complete!"
echo ""
echo "File: $OUTPUT_FILE"
echo "Size: $(du -h "$OUTPUT_FILE" | cut -f1)"
echo ""
echo "==================================="
echo "Import to Portainer:"
echo "==================================="
echo "1. Copy $OUTPUT_FILE to Portainer host"
echo "2. On Portainer host, run:"
echo "   gunzip -c $OUTPUT_FILE | docker load"
echo "3. Verify images loaded:"
echo "   docker images | grep smart-storage"
echo "4. Deploy stack in Portainer using:"
echo "   scripts/docker/docker-compose.portainer.yml"
echo ""
