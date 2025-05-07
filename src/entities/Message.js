/**
 * Message Entity
 * Represents a chat message in the system
 */
class Message {
  constructor(data = {}) {
    this.id = data.id || null;
    this.sender_id = data.sender_id || null;
    this.recipient_id = data.recipient_id || null;
    this.exchange_id = data.exchange_id || null;
    this.content = data.content || '';
    this.is_read = data.is_read !== undefined ? data.is_read : false;
    this.created_at = data.created_at || new Date();
  }

  /**
   * Validate the message object
   */
  validate() {
    const errors = [];
    
    if (!this.sender_id) {
      errors.push('Sender ID is required');
    }
    
    if (!this.recipient_id) {
      errors.push('Recipient ID is required');
    }
    
    if (!this.exchange_id) {
      errors.push('Exchange ID is required');
    }
    
    if (!this.content || this.content.trim().length < 1) {
      errors.push('Message content is required');
    }
    
    return { isValid: errors.length === 0, errors };
  }
}

module.exports = Message;
