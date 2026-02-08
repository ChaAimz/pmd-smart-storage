const express = require('express');
const mqtt = require('mqtt');
const cors = require('cors');
const bodyParser = require('body-parser');
const winston = require('winston');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const Database = require('./database-new');
const apiRoutes = require('./routes/api');

// Logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Initialize Database
const db = new Database('./data/warehouse.db', logger);
db.initialize();

// Make db accessible to routes
app.locals.db = db;
app.locals.logger = logger;

// MQTT Connection
const mqttClient = mqtt.connect(process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883', {
  clientId: `smart-storage-server-${Math.random().toString(16).slice(2, 8)}`,
  clean: true,
  reconnectPeriod: 5000
});

mqttClient.on('connect', () => {
  logger.info('Connected to MQTT broker');
  mqttClient.subscribe(['smart-storage/status', 'smart-storage/button']);
});

mqttClient.on('message', (topic, message) => {
  try {
    const data = JSON.parse(message.toString());
    logger.info(`MQTT message on ${topic}:`, data);
    // Handle MQTT messages here
  } catch (err) {
    logger.error('MQTT message error:', err);
  }
});

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    mqtt: mqttClient.connected,
    database: db.isReady(),
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api', apiRoutes);

// Error Handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

app.listen(PORT, () => {
  logger.info(`Smart Storage Server v2.0 running on port ${PORT}`);
  logger.info('Features: Multi-store, PR/PO, FIFO Cost, Cross-dept Picking');
});

module.exports = app;
