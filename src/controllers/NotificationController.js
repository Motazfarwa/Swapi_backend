const notificationService = require('../services/NotificationService');

class NotificationController {
  /**
   * Get user notifications
   */
  async getUserNotifications(req, res) {
    try {
      const userId = req.user.id;
      const { limit, offset, isRead } = req.query;
      
      const options = {
        limit: limit ? parseInt(limit) : 50,
        offset: offset ? parseInt(offset) : 0,
        isRead: isRead !== undefined ? isRead === 'true' : null
      };
      
      const notifications = await notificationService.getUserNotifications(userId, options);
      res.json(notifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  }
  
  /**
   * Mark notification as read
   */
  async markAsRead(req, res) {
    try {
      const notificationId = parseInt(req.params.id);
      const userId = req.user.id;
      
      const notification = await notificationService.markAsRead(notificationId, userId);
      res.json(notification);
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({ error: 'Failed to mark notification as read' });
    }
  }
  
  /**
   * Mark all notifications as read
   */
  async markAllAsRead(req, res) {
    try {
      const userId = req.user.id;
      
      const count = await notificationService.markAllAsRead(userId);
      res.json({ 
        message: 'All notifications marked as read',
        count
      });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      res.status(500).json({ error: 'Failed to mark all notifications as read' });
    }
  }
}

module.exports = new NotificationController();
