const { Pool } = require('pg');

// Create database connection pool
const pool = new Pool({
  user: 'postgres',  
  host: 'localhost',  
  database: 'swapi',  
  password: 'admin',  
  port: 5433,  
  ssl: false,  
});

module.exports = { pool };