/**
 * Notification Entity
 * Represents a notification in the system
 */
class Notification {
  constructor(data = {}) {
    this.id = data.id || null;
    this.user_id = data.user_id || null;
    this.sender_id = data.sender_id || null;
    this.type = data.type || 'general';
    this.message = data.message || '';
    this.is_read = data.is_read !== undefined ? data.is_read : false;
    this.data = data.data || null; // Additional JSON data
    this.created_at = data.created_at || new Date();
  }

  /**
   * Validate the notification object
   */
  validate() {
    const errors = [];
    
    if (!this.user_id) {
      errors.push('User ID is required');
    }
    
    if (!this.message || this.message.trim().length < 1) {
      errors.push('Message is required');
    }
    
    if (!this.type || !['general', 'exchange_request', 'message', 'system'].includes(this.type)) {
      errors.push('Valid notification type is required');
    }
    
    return { isValid: errors.length === 0, errors };
  }
}

module.exports = Notification;
