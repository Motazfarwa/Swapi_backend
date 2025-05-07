const { pool } = require('../../db');

class MessageService {
  /**
   * Create a new message
   * @param {Object} messageData - The message data
   * @returns {Promise<Object>} - The created message
   */
  async createMessage(messageData) {
    try {
      // Validate required fields
      if (!messageData.sender_id) {
        throw new Error('Message requires sender_id');
      }
      
      if (!messageData.recipient_id) {
        throw new Error('Message requires recipient_id');
      }
      
      if (!messageData.exchange_id) {
        throw new Error('Message requires exchange_id');
      }
      
      if (!messageData.content) {
        throw new Error('Message requires content');
      }
      
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
      
      // Insert the message
      const result = await pool.query(
        `INSERT INTO messages 
          (exchange_id, sender_id, recipient_id, content, is_read) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING *`,
        [
          messageData.exchange_id,
          messageData.sender_id,
          messageData.recipient_id,
          messageData.content,
          false
        ]
      );
      
      if (result.rows.length === 0) {
        throw new Error('Failed to insert message');
      }
      
      return result.rows[0];
    } catch (error) {
      console.error('MessageService - Error creating message:', error);
      throw error;
    }
  }
  
  /**
   * Send a message in real-time via WebSocket
   * @param {Object} io - Socket.io instance
   * @param {Object} connectedUsers - Map of connected users
   * @param {number} userId - User ID to send to
   * @param {Object} message - Message object
   * @param {string} senderName - Sender name for display
   * @returns {boolean} - Whether message was sent
   */
  sendRealtimeMessage(io, connectedUsers, userId, message, senderName) {
    if (io && connectedUsers && connectedUsers[userId]) {
      const enhancedMessage = {
        ...message,
        sender_name: senderName
      };
      
      io.to(`user:${userId}`).emit('new_message', enhancedMessage);
      console.log(`Real-time message sent to user ${userId}`);
      return true;
    }
    console.log(`User ${userId} not connected for real-time message`);
    return false;
  }
  
  /**
   * Get messages for an exchange
   * @param {number} exchangeId - Exchange ID
   * @returns {Promise<Array>} - List of messages
   */
  async getExchangeMessages(exchangeId) {
    try {
      const result = await pool.query(
        `SELECT m.*, 
                sender.username as sender_name,
                recipient.username as recipient_name
         FROM messages m
         LEFT JOIN users sender ON m.sender_id = sender.id
         LEFT JOIN users recipient ON m.recipient_id = recipient.id
         WHERE m.exchange_id = $1
         ORDER BY m.created_at ASC`,
        [exchangeId]
      );
      
      return result.rows;
    } catch (error) {
      console.error('MessageService - Error fetching messages:', error);
      throw error;
    }
  }
  
  /**
   * Mark messages as read
   * @param {number} exchangeId - Exchange ID
   * @param {number} userId - Recipient user ID
   * @returns {Promise<number>} - Number of messages marked as read
   */
  async markAsRead(exchangeId, userId) {
    try {
      const result = await pool.query(
        `UPDATE messages 
         SET is_read = true 
         WHERE exchange_id = $1 AND recipient_id = $2 AND is_read = false
         RETURNING id`,
        [exchangeId, userId]
      );
      
      return result.rows.length;
    } catch (error) {
      console.error('MessageService - Error marking messages as read:', error);
      throw error;
    }
  }
}

module.exports = new MessageService();
