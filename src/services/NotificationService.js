const { pool } = require('../../db');

class NotificationService {
  /**
   * Create a new notification
   * @param {Object} notificationData - The notification data
   * @returns {Promise<Object>} - The created notification
   */
  async createNotification(notificationData) {
    try {
      // Validate required fields
      if (!notificationData.user_id) {
        throw new Error('Notification requires user_id');
      }
      
      if (!notificationData.type) {
        throw new Error('Notification requires type');
      }
      
      if (!notificationData.message) {
        throw new Error('Notification requires message');
      }
      
      // For message notifications, check if we should group
      if (notificationData.type === 'message' && notificationData.sender_id) {
        const shouldGroup = await this.shouldGroupMessageNotification(notificationData);
        
        if (shouldGroup) {
          console.log('Grouping message notification with existing one');
          // Update the existing notification instead of creating a new one
          return await this.updateExistingMessageNotification(notificationData);
        }
      }
      
      // Create the notifications table if it doesn't exist
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
      
      // Make sure data is properly formatted as JSON
      let jsonData = null;
      if (notificationData.data) {
        if (typeof notificationData.data === 'string') {
          jsonData = notificationData.data; // Assume it's already JSON string
        } else {
          jsonData = JSON.stringify(notificationData.data);
        }
      }
      
      // Insert the notification
      const result = await pool.query(
        `INSERT INTO notifications 
          (user_id, sender_id, type, message, is_read, data) 
         VALUES ($1, $2, $3, $4, $5, $6::jsonb) 
         RETURNING *`,
        [
          notificationData.user_id,
          notificationData.sender_id || null,
          notificationData.type,
          notificationData.message,
          notificationData.is_read || false,
          jsonData
        ]
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('NotificationService - Error creating notification:', error);
      throw error;
    }
  }
  
  /**
   * Check if a message notification should be grouped with an existing one
   * @param {Object} notificationData - The notification data
   * @returns {Promise<boolean>} - Whether to group or not
   */
  async shouldGroupMessageNotification(notificationData) {
    try {
      // Don't group if missing critical info
      if (!notificationData.data || !notificationData.data.exchange_id) {
        return false;
      }
      
      const exchangeId = 
        typeof notificationData.data.exchange_id === 'string' 
          ? parseInt(notificationData.data.exchange_id)
          : notificationData.data.exchange_id;
      
      // Look for an existing unread notification from the same sender for the same exchange
      const result = await pool.query(
        `SELECT id FROM notifications 
         WHERE user_id = $1 
         AND sender_id = $2 
         AND type = 'message' 
         AND is_read = false 
         AND data->>'exchange_id' = $3
         AND created_at > NOW() - INTERVAL '1 hour'`,
        [notificationData.user_id, notificationData.sender_id, exchangeId.toString()]
      );
      
      return result.rows.length > 0;
    } catch (error) {
      console.error('Error checking for existing notifications:', error);
      return false; // Default to not grouping on error
    }
  }
  
  /**
   * Update an existing message notification instead of creating a new one
   * @param {Object} notificationData - The notification data
   * @returns {Promise<Object>} - The updated notification
   */
  async updateExistingMessageNotification(notificationData) {
    try {
      const exchangeId = 
        typeof notificationData.data.exchange_id === 'string' 
          ? parseInt(notificationData.data.exchange_id)
          : notificationData.data.exchange_id;
      
      // Find the existing notification
      const existingResult = await pool.query(
        `SELECT * FROM notifications 
         WHERE user_id = $1 
         AND sender_id = $2 
         AND type = 'message' 
         AND is_read = false 
         AND data->>'exchange_id' = $3
         ORDER BY created_at DESC
         LIMIT 1`,
        [notificationData.user_id, notificationData.sender_id, exchangeId.toString()]
      );
      
      if (existingResult.rows.length === 0) {
        // No existing notification found, create a new one
        return this.createNotification(notificationData);
      }
      
      const existingNotification = existingResult.rows[0];
      
      // Extract message count from existing message if present
      let messageCount = 1;
      const messageMatch = existingNotification.message.match(/\((\d+) messages\)$/);
      if (messageMatch) {
        messageCount = parseInt(messageMatch[1]) + 1;
        // Remove the count from the message for clean replacement
        existingNotification.message = existingNotification.message.replace(/ \(\d+ messages\)$/, '');
      }
      
      // Update the notification with incremented message count
      const result = await pool.query(
        `UPDATE notifications 
         SET message = $1, 
             created_at = NOW(),
             data = $2::jsonb
         WHERE id = $3
         RETURNING *`,
        [
          `${notificationData.sender_name || 'Someone'} sent you (${messageCount} messages)`, 
          JSON.stringify(notificationData.data),
          existingNotification.id
        ]
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('Error updating existing notification:', error);
      // Fallback to creating a new notification
      return this.createNotification(notificationData);
    }
  }
  
  /**
   * Send a notification in real-time via WebSocket
   * @param {Object} io - Socket.io instance
   * @param {Object} connectedUsers - Map of connected users
   * @param {number} userId - User ID to send to
   * @param {Object} notification - Notification object
   * @returns {boolean} - Whether notification was sent
   */
  sendRealtimeNotification(io, connectedUsers, userId, notification) {
    if (io && connectedUsers && connectedUsers[userId]) {
      io.to(`user:${userId}`).emit('new_notification', notification);
      console.log(`Real-time notification sent to user ${userId}`);
      return true;
    }
    console.log(`User ${userId} not connected for real-time notification`);
    return false;
  }
  
  /**
   * Get user's notifications
   * @param {number} userId - User ID
   * @param {string} type - Optional notification type filter
   * @returns {Promise<Array>} - List of notifications
   */
  async getUserNotifications(userId, type = null) {
    try {
      let query = `
        SELECT n.*, u.username as sender_name
        FROM notifications n
        LEFT JOIN users u ON n.sender_id = u.id
        WHERE n.user_id = $1
      `;
      
      const queryParams = [userId];
      
      // Add type filter if specified
      if (type) {
        query += ' AND n.type = $2';
        queryParams.push(type);
      }
      
      // Order by creation time, newest first
      query += ' ORDER BY n.created_at DESC';
      
      const result = await pool.query(query, queryParams);
      
      return result.rows;
    } catch (error) {
      console.error('NotificationService - Error fetching notifications:', error);
      throw error;
    }
  }
  
  /**
   * Mark notification as read
   * @param {number} notificationId - Notification ID
   * @returns {Promise<Object>} - Updated notification
   */
  async markAsRead(notificationId) {
    try {
      const result = await pool.query(
        'UPDATE notifications SET is_read = true WHERE id = $1 RETURNING *',
        [notificationId]
      );
      
      if (result.rows.length === 0) {
        throw new Error('Notification not found');
      }
      
      return result.rows[0];
    } catch (error) {
      console.error('NotificationService - Error marking as read:', error);
      throw error;
    }
  }
  
  /**
   * Mark all notifications as read for a user
   * @param {number} userId - User ID
   * @param {string} type - Optional notification type filter
   * @returns {Promise<number>} - Number of notifications updated
   */
  async markAllAsRead(userId, type = null) {
    try {
      let query = `
        UPDATE notifications 
        SET is_read = true 
        WHERE user_id = $1 AND is_read = false
      `;
      
      const queryParams = [userId];
      
      // Add type filter if specified
      if (type) {
        query += ' AND type = $2';
        queryParams.push(type);
      }
      
      // Add RETURNING to get count of updated rows
      query += ' RETURNING id';
      
      const result = await pool.query(query, queryParams);
      
      return result.rows.length;
    } catch (error) {
      console.error('NotificationService - Error marking all as read:', error);
      throw error;
    }
  }
}

module.exports = new NotificationService();
