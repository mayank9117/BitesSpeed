require('dotenv').config();
const express = require('express');
const identifyRoute = require('./routes/identify');

const app = express();
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - Body:`, JSON.stringify(req.body));
  next();
});

// Main Endpoint
app.use('/identify', identifyRoute);

// Basic health check route
app.get('/', (req, res) => {
  res.send('Bitespeed Identity Reconciliation Service is running.');
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
