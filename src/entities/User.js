/**
 * User Entity
 * Represents the core user data structure
 */
class User {
  constructor(data = {}) {
    this.id = data.id || null;
    this.username = data.username || '';
    this.email = data.email || '';
    this.password = data.password || ''; // Hashed password
    this.role = data.role || 'user';
    this.created_at = data.created_at || null;
    this.updated_at = data.updated_at || null;
  }
  
  /**
   * Returns a user object without sensitive information
   */
  toSafeObject() {
    const { password, ...safeUser } = this;
    return safeUser;
  }
  
  /**
   * Validate the user object
   */
  validate() {
    const errors = [];
    
    if (!this.username || this.username.trim().length < 3) {
      errors.push('Username must be at least 3 characters');
    }
    
    if (!this.email || !this.email.includes('@')) {
      errors.push('Valid email is required');
    }
    
    if (!this.id && (!this.password || this.password.length < 6)) {
      errors.push('Password must be at least 6 characters');
    }
    
    return { isValid: errors.length === 0, errors };
  }
}

module.exports = User;
