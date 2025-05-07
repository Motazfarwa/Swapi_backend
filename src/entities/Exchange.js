/**
 * Exchange Entity
 * Represents a book exchange transaction (rent or buy)
 */
class Exchange {
  constructor(data = {}) {
    this.id = data.id || null;
    this.book_id = data.book_id || null;
    this.owner_id = data.owner_id || null;
    this.requester_id = data.requester_id || null;
    this.type = data.type || null; // 'rent' or 'buy'
    this.status = data.status || 'pending'; // pending, accepted, rejected, completed, canceled
    this.start_date = data.start_date || null;
    this.end_date = data.end_date || null; // For rentals
    this.price = data.price || 0;
    this.created_at = data.created_at || null;
    this.updated_at = data.updated_at || null;
  }
  
  /**
   * Validate the exchange object
   */
  validate() {
    const errors = [];
    
    if (!this.book_id) {
      errors.push('Book ID is required');
    }
    
    if (!this.owner_id) {
      errors.push('Owner ID is required');
    }
    
    if (!this.requester_id) {
      errors.push('Requester ID is required');
    }
    
    if (!this.type || !['rent', 'buy'].includes(this.type)) {
      errors.push('Type must be either "rent" or "buy"');
    }
    
    if (this.type === 'rent' && !this.end_date) {
      errors.push('End date is required for rentals');
    }
    
    if (this.price <= 0) {
      errors.push('Price must be greater than 0');
    }
    
    return { isValid: errors.length === 0, errors };
  }
}

module.exports = Exchange;
