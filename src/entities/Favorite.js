/**
 * Favorite Entity
 * Represents a user's favorite book
 */
class Favorite {
  constructor(data = {}) {
    this.id = data.id || null;
    this.user_id = data.user_id || null;
    this.book_id = data.book_id || null;
    this.created_at = data.created_at || null;
  }
  
  /**
   * Validate the favorite object
   */
  validate() {
    const errors = [];
    
    if (!this.user_id) {
      errors.push('User ID is required');
    }
    
    if (!this.book_id) {
      errors.push('Book ID is required');
    }
    
    return { isValid: errors.length === 0, errors };
  }
}

module.exports = Favorite;
