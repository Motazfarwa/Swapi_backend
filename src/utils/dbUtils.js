const { pool } = require('../../db');
const bcrypt = require('bcryptjs');

/**
 * Collection of database utility functions for reuse across the application
 */
const dbUtils = {
  /**
   * Check database connection
   */
  testConnection: async () => {
    let client;
    try {
      client = await pool.connect();
      console.log('✅ PostgreSQL database connection successful');
      return { success: true, message: 'Database connection successful' };
    } catch (error) {
      console.error('❌ PostgreSQL database connection error:', error.message);
      return { success: false, message: error.message };
    } finally {
      if (client) client.release();
    }
  },
  
  /**
   * Get detailed database information
   */
  getDatabaseDetails: async () => {
    let client;
    try {
      client = await pool.connect();
      
      // Get PostgreSQL version
      const versionResult = await client.query('SELECT version()');
      const version = versionResult.rows[0].version;
      
      // Get current database name
      const dbNameResult = await client.query('SELECT current_database()');
      const dbName = dbNameResult.rows[0].current_database;
      
      // Get active connections
      const connectionsResult = await client.query(
        'SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()'
      );
      const connections = connectionsResult.rows[0].count;
      
      // Get database size
      const sizeResult = await client.query(
        'SELECT pg_size_pretty(pg_database_size(current_database())) as size'
      );
      const size = sizeResult.rows[0].size;
      
      return {
        success: true,
        details: {
          version,
          dbName,
          connections,
          size,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Database details error:', error.message);
      return {
        success: false,
        error: error.message
      };
    } finally {
      if (client) client.release();
    }
  },
  
  /**
   * Create a new user with hashed password
   */
  createUser: async (username, email, password, role = 'user') => {
    try {
      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      const result = await pool.query(
        'INSERT INTO users (username, email, password, role, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING id, username, email, role',
        [username, email, hashedPassword, role]
      );
      
      return { success: true, user: result.rows[0] };
    } catch (error) {
      console.error('Error creating user:', error.message);
      return { success: false, error: error.message };
    }
  },
  
  /**
   * Check if a user exists by email
   */
  userExists: async (email) => {
    try {
      const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      return rows.length > 0;
    } catch (error) {
      console.error('Error checking user existence:', error.message);
      return false;
    }
  }
};

module.exports = dbUtils;
