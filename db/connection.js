const mysql = require('mysql2/promise');

// Create a connection pool to handle multiple concurrent queries
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '@Mayank2003',
    database: process.env.DB_NAME || 'bitespeed',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool;
