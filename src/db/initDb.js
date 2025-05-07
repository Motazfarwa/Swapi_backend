const { pool } = require('../../db');
const bcrypt = require('bcryptjs');
const dbUtils = require('../utils/dbUtils'); // Fixed path - it was '../../utils/dbUtils'
const fs = require('fs');
const path = require('path');

// Function to create uploads directory if it doesn't exist
const createUploadsDirectories = () => {
  const dirs = [
    'uploads',
    'uploads/books',
    'uploads/users'
  ];
  
  dirs.forEach(dir => {
    const dirPath = path.join(__dirname, '../../', dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`Created directory: ${dirPath}`);
    }
  });
};

/**
 * Initialize database schema
 * Automatically creates tables if they don't exist
 */
async function initDatabase() {
  console.log('Initializing database schema...');
  
  try {
    // Create uploads directories
    createUploadsDirectories();

    // First check connection
    const connectionCheck = await dbUtils.testConnection();
    if (!connectionCheck.success) {
      throw new Error(`Database connection failed: ${connectionCheck.message}`);
    }
    
    // Create users table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP
      )
    `);
    console.log('✅ Users table initialized');
    
    // Check if admin user exists, if not create it
    const adminExists = await dbUtils.userExists('admin@example.com');
    
    if (!adminExists) {
      // Create admin user
      const result = await dbUtils.createUser('admin', 'admin@example.com', 'admin123', 'admin');
      if (result.success) {
        console.log('✅ Admin user created');
      } else {
        console.error('Failed to create admin user:', result.error);
      }
    }
    
    // Create books table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS books (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        author VARCHAR(255) NOT NULL,
        description TEXT,
        cover_image VARCHAR(255),
        isbn VARCHAR(20),
        condition VARCHAR(50),
        owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(50) DEFAULT 'available', -- available, rented, sold
        price DECIMAL(10, 2),
        rent_price DECIMAL(10, 2),
        is_rentable BOOLEAN DEFAULT TRUE,
        is_sellable BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP,
        category VARCHAR(50) DEFAULT 'other'
      )
    `);
    console.log('✅ Books table initialized');

    // Check if category column exists and add it if it doesn't
    try {
      await pool.query(`
        ALTER TABLE books 
        ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'other'
      `);
      console.log('Category column added or already exists');
    } catch (error) {
      console.error('Error ensuring category column exists:', error);
    }

    // Drop exchanges table if it exists with wrong schema
    await pool.query(`
      DO $$
      DECLARE
        amount_exists BOOLEAN;
      BEGIN
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'exchanges' AND column_name = 'amount'
        ) INTO amount_exists;
        
        IF NOT amount_exists AND EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'exchanges'
        ) THEN
          DROP TABLE exchanges CASCADE;
        END IF;
      END $$;
    `);
    
    // Recreate exchanges table with correct schema
    await pool.query(`
      CREATE TABLE IF NOT EXISTS exchanges (
        id SERIAL PRIMARY KEY,
        book_id INTEGER REFERENCES books(id) ON DELETE SET NULL,
        requester_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(20) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        price DECIMAL(10, 2) DEFAULT 0,
        start_date TIMESTAMP,
        end_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Exchanges table initialized');

    // Create exchange_history table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS exchange_history (
        id SERIAL PRIMARY KEY,
        exchange_id INTEGER REFERENCES exchanges(id) ON DELETE SET NULL,
        book_id INTEGER REFERENCES books(id) ON DELETE SET NULL,
        book_title VARCHAR(255),
        owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        owner_name VARCHAR(100),
        requester_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        requester_name VARCHAR(100),
        type VARCHAR(20) NOT NULL,
        amount NUMERIC(10, 2),
        start_date TIMESTAMP,
        end_date TIMESTAMP,
        status VARCHAR(20) NOT NULL,
        completion_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notes TEXT
      )
    `);
    console.log('Exchange history table initialized');

    // Create favorites table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS favorites (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, book_id)
      )
    `);
    console.log('✅ Favorites table initialized');

    // Create reviews table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id SERIAL PRIMARY KEY,
        book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP
      )
    `);
    console.log('✅ Reviews table initialized');
    
    // Create notifications table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        sender_id INTEGER,
        type VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT false,
        data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create messages table for chat
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER NOT NULL,
        recipient_id INTEGER NOT NULL,
        exchange_id INTEGER,
        content TEXT NOT NULL,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✅ Database initialization complete');
    return { success: true };
  } catch (error) {
    console.error('❌ Database initialization error:', error.message);
    return { success: false, error: error.message };
  }
}

// Run if executed directly
if (require.main === module) {
  initDatabase()
    .then(result => {
      console.log('Database setup completed:', result.success ? 'successfully' : 'with errors');
      process.exit(result.success ? 0 : 1);
    })
    .catch(err => {
      console.error('Database setup failed:', err);
      process.exit(1);
    });
}

module.exports = { initDatabase };
