const { pool } = require('../../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../entities/User');
const { UserResponseDto, AuthResponseDto } = require('../dtos/UserDto');

// Environment variables should be properly set
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

/**
 * User Service
 * Handles business logic for user operations
 */
class UserService {
  /**
   * Get all users
   */
  async getAllUsers() {
    try {
      const result = await pool.query('SELECT id, username, email, role, created_at FROM users');
      return result.rows.map(user => new UserResponseDto(user));
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(id) {
    try {
      const result = await pool.query(
        'SELECT id, username, email, role, created_at FROM users WHERE id = $1',
        [id]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return new UserResponseDto(result.rows[0]);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check if user exists by email
   */
  async userExists(email) {
    try {
      const result = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      return result.rows.length > 0;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Create new user
   */
  async createUser(createUserDto) {
    try {
      // Convert DTO to Entity
      const user = new User(createUserDto);
      
      // Validate user
      const validation = user.validate();
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }
      
      // Check if user already exists
      const exists = await this.userExists(user.email);
      if (exists) {
        throw new Error('User with this email already exists');
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(user.password, salt);
      
      // Save to database
      const result = await pool.query(
        'INSERT INTO users (username, email, password, role, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING id, username, email, role, created_at',
        [user.username, user.email, hashedPassword, user.role]
      );
      
      return new UserResponseDto(result.rows[0]);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update user
   */
  async updateUser(id, updateUserDto) {
    try {
      // First check if user exists
      const currentUser = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
      if (currentUser.rows.length === 0) {
        throw new Error('User not found');
      }
      
      // Update user in database
      const result = await pool.query(
        'UPDATE users SET username = $1, email = $2, role = $3, updated_at = NOW() WHERE id = $4 RETURNING id, username, email, role, created_at',
        [updateUserDto.username, updateUserDto.email, updateUserDto.role, id]
      );
      
      return new UserResponseDto(result.rows[0]);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete user
   */
  async deleteUser(id) {
    try {
      const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
      
      if (result.rows.length === 0) {
        throw new Error('User not found');
      }
      
      return { id: result.rows[0].id, message: 'User deleted successfully' };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Authenticate user
   */
  async authenticate(loginDto) {
    try {
      const result = await pool.query('SELECT * FROM users WHERE email = $1', [loginDto.email]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const user = result.rows[0];
      const isMatch = await bcrypt.compare(loginDto.password, user.password);
      
      if (!isMatch) {
        return null;
      }
      
      // Create JWT token
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '1d' }
      );
      
      return new AuthResponseDto(user, token);
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new UserService();
