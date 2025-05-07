const express = require('express');
const router = express.Router();
const { pool } = require('../../db');
const { authMiddleware } = require('../middleware/auth');

// Get all chats for current user
router.get('/list', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log(`Fetching chats for user ${userId}`);
    
    // First ensure the messages table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        exchange_id INTEGER NOT NULL REFERENCES exchanges(id) ON DELETE CASCADE,
        sender_id INTEGER NOT NULL,
        recipient_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Get a list of exchanges where messages exist
    const result = await pool.query(`
      WITH user_exchanges AS (
        SELECT DISTINCT exchange_id 
        FROM messages 
        WHERE sender_id = $1 OR recipient_id = $1
      )
      SELECT 
        e.id as exchange_id, 
        e.book_id, 
        e.type as exchange_type, 
        e.status as exchange_status,
        b.title as book_title, 
        b.cover_image as book_cover,
        CASE 
          WHEN e.owner_id = $1 THEN e.requester_id 
          ELSE e.owner_id 
        END as partner_id,
        CASE 
          WHEN e.owner_id = $1 THEN requester.username 
          ELSE owner.username 
        END as partner_name,
        (
          SELECT m.* FROM messages m 
          WHERE m.exchange_id = e.id 
          ORDER BY m.created_at DESC 
          LIMIT 1
        ) as last_message,
        (
          SELECT COUNT(*) FROM messages m 
          WHERE m.exchange_id = e.id 
          AND m.recipient_id = $1 
          AND m.is_read = false
        ) as unread_count
      FROM 
        exchanges e
      JOIN user_exchanges ue ON e.id = ue.exchange_id
      LEFT JOIN books b ON e.book_id = b.id
      LEFT JOIN users requester ON e.requester_id = requester.id
      LEFT JOIN users owner ON e.owner_id = owner.id
      WHERE e.requester_id = $1 OR e.owner_id = $1
      ORDER BY (
        SELECT MAX(created_at) FROM messages WHERE exchange_id = e.id
      ) DESC
    `, [userId]);
    
    console.log(`Found ${result.rows.length} chats for user ${userId}`);
    
    // Return the chats
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching chats:', error);
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

// Get chat messages for a specific exchange ID, regardless of existing records
router.get('/:exchangeId', authMiddleware, async (req, res) => {
  try {
    const { exchangeId } = req.params;
    const userId = req.user.id;
    
    console.log(`User ${userId} fetching messages for exchange ${exchangeId}`);
    
    // First create messages table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        exchange_id INTEGER NOT NULL REFERENCES exchanges(id) ON DELETE CASCADE,
        sender_id INTEGER NOT NULL,
        recipient_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Check if this exchange exists first
    const exchangeCheck = await pool.query(
      'SELECT * FROM exchanges WHERE id = $1',
      [exchangeId]
    );
    
    if (exchangeCheck.rows.length === 0) {
      // Check if the user has any messages in this exchange ID even if the exchange record doesn't exist
      const messageCheck = await pool.query(
        'SELECT COUNT(*) FROM messages WHERE exchange_id = $1 AND (sender_id = $2 OR recipient_id = $2)',
        [exchangeId, userId]
      );
      
      if (parseInt(messageCheck.rows[0].count) === 0) {
        // No messages and no exchange - truly unauthorized
        return res.status(404).json({ error: 'Exchange not found' });
      }
      
      // Exchange doesn't exist but user has messages - this is allowed
      console.log(`Exchange ${exchangeId} not found but user ${userId} has messages - proceeding`);
    } else {
      // Exchange exists, but verify user is part of it
      const isInExchange = exchangeCheck.rows[0].requester_id === userId || 
                           exchangeCheck.rows[0].owner_id === userId;
      
      if (!isInExchange) {
        // Check if the user has any messages in this exchange ID even if they're not in the exchange
        const messageCheck = await pool.query(
          'SELECT COUNT(*) FROM messages WHERE exchange_id = $1 AND (sender_id = $2 OR recipient_id = $2)',
          [exchangeId, userId]
        );
        
        if (parseInt(messageCheck.rows[0].count) === 0) {
          // No messages and not in exchange - unauthorized
          return res.status(403).json({ error: 'You are not authorized to view this exchange' });
        }
      }
    }
    
    // Get messages for this exchange
    const result = await pool.query(`
      SELECT m.*, 
             sender.username as sender_name,
             recipient.username as recipient_name
      FROM messages m
      LEFT JOIN users sender ON m.sender_id = sender.id
      LEFT JOIN users recipient ON m.recipient_id = recipient.id
      WHERE m.exchange_id = $1 AND (m.sender_id = $2 OR m.recipient_id = $2)
      ORDER BY m.created_at ASC
    `, [exchangeId, userId]);
    
    // Mark all messages as read that were sent to this user
    await pool.query(`
      UPDATE messages 
      SET is_read = true 
      WHERE exchange_id = $1 AND recipient_id = $2 AND is_read = false
    `, [exchangeId, userId]);
    
    console.log(`Found ${result.rows.length} messages for exchange ${exchangeId}`);
    
    // Return the messages
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Send a new message
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { recipientId, content, exchangeId } = req.body;
    const senderId = req.user.id;
    
    if (!recipientId || !content || !exchangeId) {
      return res.status(400).json({ error: 'Missing required fields: recipientId, content, exchangeId' });
    }
    
    // Check if this exchange exists first
    const exchangeCheck = await pool.query(
      'SELECT * FROM exchanges WHERE id = $1',
      [exchangeId]
    );
    
    // Create messages table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        exchange_id INTEGER NOT NULL REFERENCES exchanges(id) ON DELETE CASCADE,
        sender_id INTEGER NOT NULL,
        recipient_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Check if there are previous messages in this exchange ID
    const messageCheck = await pool.query(
      'SELECT COUNT(*) FROM messages WHERE exchange_id = $1',
      [exchangeId]
    );
    
    const isFirstMessage = parseInt(messageCheck.rows[0].count) === 0;
    
    // If the exchange exists, verify the sender is part of it
    if (exchangeCheck.rows.length > 0) {
      const isInExchange = exchangeCheck.rows[0].requester_id === senderId || 
                           exchangeCheck.rows[0].owner_id === senderId;
      
      if (!isInExchange) {
        // Check if the user has any previous messages in this exchange
        const userMessageCheck = await pool.query(
          'SELECT COUNT(*) FROM messages WHERE exchange_id = $1 AND (sender_id = $2 OR recipient_id = $2)',
          [exchangeId, senderId]
        );
        
        if (parseInt(userMessageCheck.rows[0].count) === 0 && !isFirstMessage) {
          // No previous messages and not in exchange - unauthorized
          return res.status(403).json({ error: 'You are not authorized to send messages in this exchange' });
        }
      }
    }
    
    // Insert the message
    const result = await pool.query(`
      INSERT INTO messages 
        (exchange_id, sender_id, recipient_id, content) 
      VALUES ($1, $2, $3, $4) 
      RETURNING *
    `, [exchangeId, senderId, recipientId, content]);
    
    if (result.rows.length === 0) {
      throw new Error('Failed to insert message');
    }
    
    const message = result.rows[0];
    
    // Get sender info
    const userResult = await pool.query(
      'SELECT username FROM users WHERE id = $1',
      [senderId]
    );
    
    const senderName = userResult.rows[0]?.username || 'User';
    
    // If this is the first message, create notification
    if (isFirstMessage) {
      // Get book info if the exchange exists
      let bookTitle = "a conversation";
      let exchangeType = "chat";
      let bookId = null;
      
      if (exchangeCheck.rows.length > 0) {
        const exchange = exchangeCheck.rows[0];
        const bookResult = await pool.query(
          'SELECT title FROM books WHERE id = $1',
          [exchange.book_id]
        );
        
        if (bookResult.rows.length > 0) {
          bookTitle = bookResult.rows[0].title;
          exchangeType = exchange.type || "chat";
          bookId = exchange.book_id;
        }
      }
      
      // Create notification
      const notificationService = require('../services/NotificationService');
      
      await notificationService.createNotification({
        user_id: recipientId,
        sender_id: senderId,
        type: 'message',
        message: `${senderName} started a chat regarding ${exchangeType === 'buy' ? 'buying' : (exchangeType === 'rent' ? 'renting' : '')} "${bookTitle}"`,
        data: {
          exchange_id: exchangeId,
          book_id: bookId,
          book_title: bookTitle
        }
      });
    }
    
    // Return the created message
    res.status(201).json({
      ...message,
      sender_name: senderName
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

module.exports = router;
