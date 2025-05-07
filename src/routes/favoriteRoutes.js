const express = require('express');
const router = express.Router();
const { pool } = require('../../db');
const { authMiddleware } = require('../middleware/auth');

// Debug endpoint to test connection
router.get('/debug', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.status(200).json({
      status: 'ok',
      message: 'Favorites route is working',
      timestamp: result.rows[0].now,
      dbConnection: 'successful'
    });
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ 
      error: 'Database connection error',
      details: error.message
    });
  }
});

// Get user's favorites
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // First check if favorites table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'favorites'
      )
    `);
    
    // Create favorites table if it doesn't exist
    if (!tableCheck.rows[0].exists) {
      await pool.query(`
        CREATE TABLE favorites (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          book_id INTEGER NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, book_id)
        )
      `);
      
      // Return empty array if table was just created
      return res.json([]);
    }
    
    // Query to fetch favorites with book details
    const result = await pool.query(`
      SELECT f.id, f.user_id, f.book_id, f.created_at, 
             b.title, b.author, b.description, b.cover_image, b.price
      FROM favorites f
      JOIN books b ON f.book_id = b.id
      WHERE f.user_id = $1
      ORDER BY f.created_at DESC
    `, [userId]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({ 
      error: 'Failed to fetch favorites',
      details: error.message
    });
  }
});

// Check if a book is in user's favorites
router.get('/check/:bookId', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const bookId = req.params.bookId;
    
    // Check if favorites table exists first
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'favorites'
      )
    `);
    
    // Create table if it doesn't exist
    if (!tableCheck.rows[0].exists) {
      await pool.query(`
        CREATE TABLE favorites (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          book_id INTEGER NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, book_id)
        )
      `);
      
      // If table was just created, book isn't in favorites
      return res.json({ isFavorite: false });
    }
    
    const result = await pool.query(
      'SELECT * FROM favorites WHERE user_id = $1 AND book_id = $2',
      [userId, bookId]
    );
    
    res.json({ isFavorite: result.rows.length > 0 });
  } catch (error) {
    console.error('Error checking favorite status:', error);
    res.status(500).json({ 
      error: 'Failed to check favorite status',
      details: error.message 
    });
  }
});

// Add to favorites
router.post('/:bookId', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const bookId = req.params.bookId;
    
    // Check if favorites table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'favorites'
      )
    `);
    
    // Create table if it doesn't exist
    if (!tableCheck.rows[0].exists) {
      await pool.query(`
        CREATE TABLE favorites (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          book_id INTEGER NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, book_id)
        )
      `);
    }
    
    // Check if book exists
    const bookCheck = await pool.query('SELECT * FROM books WHERE id = $1', [bookId]);
    
    if (bookCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Book not found' });
    }
    
    // Check if already in favorites
    const favoriteCheck = await pool.query(
      'SELECT * FROM favorites WHERE user_id = $1 AND book_id = $2',
      [userId, bookId]
    );
    
    if (favoriteCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Book already in favorites' });
    }
    
    // Add to favorites
    const result = await pool.query(
      'INSERT INTO favorites (user_id, book_id) VALUES ($1, $2) RETURNING *',
      [userId, bookId]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding to favorites:', error);
    res.status(500).json({ 
      error: 'Failed to add to favorites',
      details: error.message 
    });
  }
});

// Remove from favorites
router.delete('/:bookId', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const bookId = req.params.bookId;
    
    // Check if favorites table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'favorites'
      )
    `);
    
    // Return not found if table doesn't exist
    if (!tableCheck.rows[0].exists) {
      return res.status(404).json({ error: 'Favorites table not found' });
    }
    
    // Check if book is in favorites
    const favoriteCheck = await pool.query(
      'SELECT * FROM favorites WHERE user_id = $1 AND book_id = $2',
      [userId, bookId]
    );
    
    if (favoriteCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Book not found in favorites' });
    }
    
    // Remove from favorites
    await pool.query(
      'DELETE FROM favorites WHERE user_id = $1 AND book_id = $2',
      [userId, bookId]
    );
    
    res.json({ message: 'Removed from favorites successfully' });
  } catch (error) {
    console.error('Error removing from favorites:', error);
    res.status(500).json({ 
      error: 'Failed to remove from favorites',
      details: error.message 
    });
  }
});

module.exports = router;
