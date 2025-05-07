/**
 * Book Entity
 * Represents the core book data structure
 */
class Book {
  constructor(data = {}) {
    this.id = data.id || null;
    this.title = data.title || '';
    this.author = data.author || '';
    this.description = data.description || '';
    this.cover_image = data.cover_image || null;
    this.isbn = data.isbn || null;
    this.condition = data.condition || 'good';
    this.owner_id = data.owner_id || null;
    this.status = data.status || 'available';
    this.price = data.price || null; // For selling
    this.rent_price = data.rent_price || null; // For renting
    this.is_rentable = data.is_rentable !== undefined ? data.is_rentable : true;
    this.is_sellable = data.is_sellable !== undefined ? data.is_sellable : true;
    this.created_at = data.created_at || null;
    this.updated_at = data.updated_at || null;
  }
  
  /**
   * Validate the book object
   */
  validate() {
    const errors = [];
    
    if (!this.title || this.title.trim().length < 2) {
      errors.push('Title must be at least 2 characters');
    }
    
    if (!this.author || this.author.trim().length < 2) {
      errors.push('Author must be at least 2 characters');
    }
    
    if (!this.owner_id) {
      errors.push('Owner ID is required');
    }
    
    // If book is sellable, it must have a price
    if (this.is_sellable && (!this.price || this.price <= 0)) {
      errors.push('Price is required for books that are for sale');
    }
    
    // If book is rentable, it must have a rent price
    if (this.is_rentable && (!this.rent_price || this.rent_price <= 0)) {
      errors.push('Rent price is required for books that are for rent');
    }
    
    return { isValid: errors.length === 0, errors };
  }
}

module.exports = Book;
