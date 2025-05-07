const express = require('express');
const router = express.Router();
const { pool } = require('../../db');
const { authMiddleware } = require('../middleware/auth');

// Important: Route order matters! Place specific routes before parameterized routes
// Get user's exchanges - must be before the /:id route to avoid conflicts
router.get('/my-exchanges', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log(`Fetching exchanges for user ${userId}`);
    
    // First check if exchanges table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'exchanges'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('Exchanges table does not exist - creating it');
      await pool.query(`
        CREATE TABLE exchanges (
          id SERIAL PRIMARY KEY,
          book_id INTEGER NOT NULL REFERENCES books(id),
          owner_id INTEGER NOT NULL,
          requester_id INTEGER NOT NULL,
          type VARCHAR(20) NOT NULL,
          amount NUMERIC(10,2),
          start_date TIMESTAMP,
          end_date TIMESTAMP,
          status VARCHAR(20) DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      // Return empty array for new table
      return res.json([]);
    }
    
    const result = await pool.query(`
      SELECT e.*, 
              b.title as book_title,
              b.cover_image as book_cover,
              owner.username as owner_name,
              requester.username as requester_name
       FROM exchanges e
       LEFT JOIN books b ON e.book_id = b.id
       LEFT JOIN users owner ON e.owner_id = owner.id
       LEFT JOIN users requester ON e.requester_id = requester.id
       WHERE e.owner_id = $1 OR e.requester_id = $1
       ORDER BY e.created_at DESC
    `, [userId]);
    
    console.log(`Found ${result.rows.length} exchanges for user ${userId}`);
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting user exchanges:', error);
    res.status(500).json({ error: 'Failed to get exchanges', details: error.message });
  }
});

// Get user's exchange history
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log(`Fetching exchange history for user ${userId}`);
    
    // First check if exchange_history table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'exchange_history'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('Exchange history table does not exist - creating it');
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
        );
      `);
      // Return empty array for new table
      return res.json([]);
    }
    
    const result = await pool.query(`
      SELECT * FROM exchange_history
      WHERE owner_id = $1 OR requester_id = $1
      ORDER BY completion_date DESC
    `, [userId]);
    
    console.log(`Found ${result.rows.length} exchange history records for user ${userId}`);
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting exchange history:', error);
    res.status(500).json({ error: 'Failed to get exchange history', details: error.message });
  }
});

// Get all exchanges
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.*, 
              b.title as book_title,
              b.cover_image as book_cover,
              owner.username as owner_name,
              requester.username as requester_name
       FROM exchanges e
       LEFT JOIN books b ON e.book_id = b.id
       LEFT JOIN users owner ON e.owner_id = owner.id
       LEFT JOIN users requester ON e.requester_id = requester.id
       ORDER BY e.created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting exchanges:', error);
    res.status(500).json({ error: 'Failed to get exchanges' });
  }
});

// Get exchange by ID - must be after the /my-exchanges route
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`Fetching exchange with ID: ${id}`);
    
    const result = await pool.query(
      `SELECT e.*, 
              b.title as book_title,
              b.cover_image as book_cover,
              owner.username as owner_name,
              requester.username as requester_name,
              b.owner_id as book_owner_id
       FROM exchanges e
       LEFT JOIN books b ON e.book_id = b.id
       LEFT JOIN users owner ON e.owner_id = owner.id
       LEFT JOIN users requester ON e.requester_id = requester.id
       WHERE e.id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      console.log(`Exchange with ID ${id} not found`);
      return res.status(404).json({ error: 'Exchange not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error(`Error getting exchange ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to get exchange', details: error.message });
  }
});

// Create a new exchange
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { book_id, type, amount, start_date, end_date } = req.body;
    const requester_id = req.user.id;
    
    // Check if exchanges table exists, create if not
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'exchanges'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('Exchanges table does not exist - creating it');
      await pool.query(`
        CREATE TABLE exchanges (
          id SERIAL PRIMARY KEY,
          book_id INTEGER NOT NULL REFERENCES books(id),
          owner_id INTEGER NOT NULL,
          requester_id INTEGER NOT NULL,
          type VARCHAR(20) NOT NULL,
          amount NUMERIC(10,2),
          start_date TIMESTAMP,
          end_date TIMESTAMP,
          status VARCHAR(20) DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    }
    
    // Verify the book exists and get owner_id
    const bookResult = await pool.query(
      'SELECT owner_id FROM books WHERE id = $1',
      [book_id]
    );
    
    if (bookResult.rows.length === 0) {
      return res.status(404).json({ error: 'Book not found' });
    }
    
    const owner_id = bookResult.rows[0].owner_id;
    
    // Prevent exchanging with yourself
    if (owner_id === requester_id) {
      return res.status(400).json({ error: 'Cannot exchange with yourself' });
    }
    
    // Create the exchange record
    const result = await pool.query(
      `INSERT INTO exchanges 
        (book_id, owner_id, requester_id, type, amount, start_date, end_date, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING *`,
      [book_id, owner_id, requester_id, type, amount, start_date, end_date, 'pending']
    );
    
    // Create a notification for the book owner
    const notificationService = require('../services/NotificationService');
    const userResult = await pool.query(
      'SELECT username FROM users WHERE id = $1',
      [requester_id]
    );
    const bookTitleResult = await pool.query(
      'SELECT title FROM books WHERE id = $1',
      [book_id]
    );
    
    const username = userResult.rows[0]?.username || 'Someone';
    const bookTitle = bookTitleResult.rows[0]?.title || 'a book';
    
    // Ensure notifications table exists
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
    
    await notificationService.createNotification({
      user_id: owner_id,
      sender_id: requester_id,
      type: 'exchange_request',
      message: `${username} wants to ${type} your book "${bookTitle}"`,
      data: {
        exchange_id: result.rows[0].id,
        book_id: book_id,
        book_title: bookTitle,
        type: type
      }
    });
    
    // Send real-time notification if user is online
    const io = req.app.get('io');
    const connectedUsers = req.app.get('connectedUsers');
    if (io && connectedUsers && connectedUsers[owner_id]) {
      console.log(`Sending real-time exchange notification to user ${owner_id}`);
      notificationService.sendRealtimeNotification(
        io, 
        connectedUsers, 
        owner_id, 
        {
          type: 'exchange_request',
          message: `${username} wants to ${type} your book "${bookTitle}"`,
          created_at: new Date().toISOString(),
          sender_name: username
        }
      );
    }
    
    // Return the created exchange
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating exchange:', error);
    res.status(500).json({ error: 'Failed to create exchange', details: error.message });
  }
});

// Update exchange status (modified to track history)
router.patch('/:id/status', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const userId = req.user.id;
    
    if (!['pending', 'accepted', 'rejected', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    // Verify the user is the owner of the exchange
    const exchangeResult = await pool.query(
      `SELECT e.*, 
              b.title as book_title,
              b.cover_image as book_cover,
              owner.username as owner_name,
              requester.username as requester_name
       FROM exchanges e
       JOIN books b ON e.book_id = b.id
       JOIN users owner ON e.owner_id = owner.id
       JOIN users requester ON e.requester_id = requester.id
       WHERE e.id = $1`,
      [id]
    );
    
    if (exchangeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Exchange not found' });
    }
    
    const exchange = exchangeResult.rows[0];
    
    // Only the owner can accept/reject, only the requester can cancel
    if ((status === 'accepted' || status === 'rejected') && exchange.owner_id !== userId) {
      return res.status(403).json({ error: 'Only the owner can accept or reject an exchange' });
    }
    
    if (status === 'cancelled' && exchange.requester_id !== userId) {
      return res.status(403).json({ error: 'Only the requester can cancel an exchange' });
    }
    
    // Only the owner or requester can mark as completed
    if (status === 'completed' && exchange.owner_id !== userId && exchange.requester_id !== userId) {
      return res.status(403).json({ error: 'Only participants can mark an exchange as completed' });
    }
    
    // Begin a transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Update the exchange status
      const updateResult = await client.query(
        'UPDATE exchanges SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [status, id]
      );
      
      // If the status is completed or rejected, add to history
      if (['completed', 'rejected', 'cancelled'].includes(status)) {
        await client.query(`
          INSERT INTO exchange_history
            (exchange_id, book_id, book_title, owner_id, owner_name, 
             requester_id, requester_name, type, amount, start_date, 
             end_date, status, completion_date, notes)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), $13)
        `, [
          exchange.id,
          exchange.book_id,
          exchange.book_title,
          exchange.owner_id,
          exchange.owner_name,
          exchange.requester_id,
          exchange.requester_name,
          exchange.type,
          exchange.amount,
          exchange.start_date,
          exchange.end_date,
          status,
          notes || null
        ]);
        
        // If completed, update book status
        if (status === 'completed' && exchange.type === 'buy') {
          // Update book ownership if it was a purchase
          await client.query(`
            UPDATE books 
            SET owner_id = $1, status = 'transferred'
            WHERE id = $2
          `, [exchange.requester_id, exchange.book_id]);
        }
      }
      
      // Create a notification for the other party
      const notificationService = require('../services/NotificationService');
      
      // Determine the recipient (the other party)
      const recipientId = userId === exchange.owner_id ? exchange.requester_id : exchange.owner_id;
      
      // Get username of the current user
      const username = userId === exchange.owner_id ? exchange.owner_name : exchange.requester_name;
      
      // Create appropriate message based on status
      let message = '';
      let notificationType = 'exchange_update';
      
      switch (status) {
        case 'accepted':
          message = `${username} has accepted your request to ${exchange.type} "${exchange.book_title}"`;
          break;
        case 'rejected':
          message = `${username} has rejected your request to ${exchange.type} "${exchange.book_title}"`;
          break;
        case 'completed':
          message = `${username} has marked the ${exchange.type} of "${exchange.book_title}" as completed`;
          break;
        case 'cancelled':
          message = `${username} has cancelled the request to ${exchange.type} "${exchange.book_title}"`;
          break;
        default:
          message = `${username} has updated the status of your exchange for "${exchange.book_title}" to ${status}`;
      }
      
      await notificationService.createNotification({
        user_id: recipientId,
        sender_id: userId,
        type: notificationType,
        message: message,
        data: {
          exchange_id: id,
          book_id: exchange.book_id,
          book_title: exchange.book_title,
          status: status
        }
      }, client);
      
      // Send real-time notification if user is online
      const io = req.app.get('io');
      const connectedUsers = req.app.get('connectedUsers');
      
      if (io && connectedUsers && connectedUsers[recipientId]) {
        notificationService.sendRealtimeNotification(
          io, 
          connectedUsers, 
          recipientId, 
          {
            type: notificationType,
            message: message,
            created_at: new Date().toISOString(),
            sender_name: username,
            data: {
              exchange_id: id,
              status: status
            }
          }
        );
      }
      
      await client.query('COMMIT');
      
      res.json(updateResult.rows[0]);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error updating exchange status:', error);
    res.status(500).json({ error: 'Failed to update exchange status', details: error.message });
  }
});

module.exports = router;
