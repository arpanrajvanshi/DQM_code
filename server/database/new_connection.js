// server/database/new_connection.js

const { Client } = require('pg');

const client = new Client({
  user: 'postgres',
  host: 'localhost',
  database: 'abs_accuracy_outlier',
  password: '6398', // Replace with your actual database password
  port: 5432,
});

client.connect((err) => {
  if (err) {
    console.error('Database connection error:', err.stack);
  } else {
    console.log('Database connected');
  }
});

module.exports = client;
