const express = require('express');
const identifyRoute = require('./routes/identify');

const app = express();
app.use(express.json());

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
