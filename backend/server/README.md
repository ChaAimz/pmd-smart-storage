# Smart Storage Backend Server

Node.js backend server for the Smart Storage inventory management system.

## Features

- **MQTT Integration**: Receives events from gateway and sends commands to nodes
- **REST API**: Manage storage locations and query inventory
- **SQLite Database**: Persistent storage for locations and events
- **Real-time Events**: Track pick events and location activity
- **Search & Indicate**: Find items and trigger LED indicators

## Architecture

```
┌─────────────┐      MQTT       ┌─────────────┐
│   Gateway   │ ←─────────────→ │   Server    │
└─────────────┘                 │  (Node.js)  │
                                └──────┬──────┘
                                       │
                                ┌──────▼──────┐
                                │   SQLite    │
                                │  Database   │
                                └─────────────┘
```

## Installation

### Prerequisites

- Node.js v18 or later
- MQTT broker (Mosquitto recommended)

### Setup

1. Install dependencies:
```bash
cd backend/server
npm install
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## Configuration

Edit [`.env`](.env.example) file:

```env
PORT=3000
MQTT_BROKER_URL=mqtt://localhost:1883
DATABASE_PATH=./data/inventory.db
LOG_LEVEL=info
```

## API Endpoints

### Health Check

```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "mqtt": true,
  "database": true,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Locations

#### Get All Locations

```http
GET /api/locations
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "node_address": "0x0002",
      "zone": "A",
      "shelf": "1",
      "row": 1,
      "column": 1,
      "description": "Electronics components",
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### Get Location by Address

```http
GET /api/locations/:address
```

**Example:**
```bash
curl http://localhost:3000/api/locations/0x0002
```

#### Create Location

```http
POST /api/locations
Content-Type: application/json

{
  "node_address": "0x0002",
  "zone": "A",
  "shelf": "1",
  "row": 1,
  "column": 1,
  "description": "Electronics components"
}
```

#### Update Location

```http
PUT /api/locations/:address
Content-Type: application/json

{
  "description": "Updated description",
  "zone": "B"
}
```

### LED Control

#### Control LED at Location

```http
POST /api/locations/:address/led
Content-Type: application/json

{
  "state": "on"
}
```

**Parameters:**
- `state`: `"on"`, `"off"`, `true`, or `false`

**Example:**
```bash
curl -X POST http://localhost:3000/api/locations/0x0002/led \
  -H "Content-Type: application/json" \
  -d '{"state": "on"}'
```

### Events

#### Get Pick Events

```http
GET /api/events?limit=100&offset=0
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "node_address": "0x0002",
      "event_type": "button_press",
      "timestamp": 1234567890,
      "zone": "A",
      "shelf": "1",
      "description": "Electronics components"
    }
  ]
}
```

#### Get Events for Location

```http
GET /api/locations/:address/events
```

### Search & Indicate

#### Search Locations

```http
GET /api/search?q=electronics
```

Searches in: zone, shelf, description, node_address

#### Indicate Item Location

```http
POST /api/indicate
Content-Type: application/json

{
  "query": "electronics",
  "duration": 10000
}
```

**Parameters:**
- `query`: Search term
- `duration`: LED on duration in milliseconds (default: 10000)

**Response:**
```json
{
  "success": true,
  "message": "Indicating 3 location(s)",
  "locations": ["0x0002", "0x0003", "0x0004"]
}
```

### Statistics

```http
GET /api/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total_locations": 500,
    "total_events": 1234,
    "events_last_24h": 45,
    "most_active_locations": [
      {
        "node_address": "0x0002",
        "zone": "A",
        "shelf": "1",
        "pick_count": 23
      }
    ]
  }
}
```

## MQTT Topics

### Subscribed Topics (Server receives)

| Topic | Description | Example Payload |
|-------|-------------|-----------------|
| `smart-storage/status` | Gateway status updates | `{"type":"gateway","status":"online"}` |
| `smart-storage/button` | Button press events | `{"node_addr":2,"event":"button_press","timestamp":1234567890}` |

### Published Topics (Server sends)

| Topic | Description | Example Payload |
|-------|-------------|-----------------|
| `smart-storage/command` | LED control commands | `{"node_addr":2,"led_state":true}` |

## Database Schema

### Tables

**locations**
- `id`: INTEGER PRIMARY KEY
- `node_address`: TEXT UNIQUE (e.g., "0x0002")
- `zone`: TEXT
- `shelf`: TEXT
- `row`: INTEGER
- `column`: INTEGER
- `description`: TEXT
- `created_at`: DATETIME
- `updated_at`: DATETIME

**pick_events**
- `id`: INTEGER PRIMARY KEY
- `node_address`: TEXT
- `event_type`: TEXT
- `timestamp`: INTEGER (Unix timestamp)
- `created_at`: DATETIME

**gateway_status**
- `id`: INTEGER PRIMARY KEY
- `gateway_id`: TEXT
- `status`: TEXT
- `timestamp`: DATETIME

## Usage Examples

### Initialize Locations

```javascript
// Create multiple locations
const locations = [
  { node_address: "0x0002", zone: "A", shelf: "1", row: 1, column: 1, description: "Resistors" },
  { node_address: "0x0003", zone: "A", shelf: "1", row: 1, column: 2, description: "Capacitors" },
  { node_address: "0x0004", zone: "A", shelf: "1", row: 1, column: 3, description: "LEDs" }
];

for (const loc of locations) {
  await fetch('http://localhost:3000/api/locations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(loc)
  });
}
```

### Find and Indicate Item

```javascript
// Search for "resistor"
const response = await fetch('http://localhost:3000/api/indicate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'resistor',
    duration: 15000  // LED on for 15 seconds
  })
});

const result = await response.json();
console.log(`Indicated ${result.locations.length} location(s)`);
```

### Monitor Pick Events

```javascript
// Get recent events
const response = await fetch('http://localhost:3000/api/events?limit=10');
const events = await response.json();

events.data.forEach(event => {
  console.log(`Pick at ${event.node_address}: ${event.description}`);
});
```

## Logging

Logs are written to:
- Console (colorized)
- `logs/combined.log` (all logs)
- `logs/error.log` (errors only)

Log levels: `error`, `warn`, `info`, `debug`

Configure via `LOG_LEVEL` environment variable.

## Development

### Project Structure

```
backend/server/
├── src/
│   ├── index.js              # Main server file
│   ├── database.js           # SQLite wrapper
│   └── services/
│       ├── inventoryService.js  # Business logic
│       └── mqttHandler.js       # MQTT communication
├── data/                     # Database files
├── logs/                     # Log files
├── package.json
└── .env
```

### Running Tests

```bash
npm test
```

### Linting

```bash
npm run lint
```

## Deployment

### Using PM2

```bash
npm install -g pm2
pm2 start src/index.js --name smart-storage-server
pm2 save
pm2 startup
```

### Docker (Future)

```bash
docker build -t smart-storage-server .
docker run -p 3000:3000 --env-file .env smart-storage-server
```

## Troubleshooting

### MQTT Connection Failed

- Verify MQTT broker is running: `mosquitto -v`
- Check broker URL in `.env`
- Test connection: `mosquitto_sub -h localhost -t '#' -v`

### Database Errors

- Check write permissions on `data/` directory
- Verify SQLite3 is installed: `npm list sqlite3`
- Delete and recreate: `rm data/inventory.db` then restart server

### Events Not Recording

- Check gateway is connected to MQTT
- Verify topic names match between gateway and server
- Monitor MQTT messages: `mosquitto_sub -h localhost -t 'smart-storage/#' -v`

## Performance

| Metric | Value |
|--------|-------|
| Request throughput | ~1000 req/s |
| Database queries | <10ms (typical) |
| MQTT latency | <50ms |
| Memory usage | ~50MB |

## Security Considerations

- Add authentication middleware for production
- Use TLS for MQTT connections
- Implement rate limiting
- Validate all input data
- Use environment variables for sensitive data

## License

MIT