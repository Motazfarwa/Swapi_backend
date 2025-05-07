const { pool } = require('../../db');
const Favorite = require('../entities/Favorite');
const BookService = require('./BookService');
const { FavoriteResponseDto } = require('../dtos/FavoriteDto');

/**
 * Favorite Service
 * Handles business logic for user's favorite books
 */
class FavoriteService {
  /**
   * Get user's favorites with book details
   */
  async getUserFavorites(userId) {
    try {
      const result = await pool.query(`
        SELECT f.*, b.*, u.username as owner_name
        FROM favorites f
        JOIN books b ON f.book_id = b.id
        JOIN users u ON b.owner_id = u.id
        WHERE f.user_id = $1
        ORDER BY f.created_at DESC
      `, [userId]);
      
      return result.rows.map(row => {
        const book = {
          id: row.book_id,
          title: row.title,
          author: row.author,
          description: row.description,
          cover_image: row.cover_image,
          isbn: row.isbn,
          condition: row.condition,
          owner_id: row.owner_id,
          owner_name: row.owner_name,
          status: row.status,
          price: row.price,
          rent_price: row.rent_price,
          is_rentable: row.is_rentable,
          is_sellable: row.is_sellable,
          created_at: row.created_at
        };
        
        const favorite = {
          id: row.id,
          user_id: row.user_id,
          book_id: row.book_id,
          created_at: row.created_at
        };
        
        return new FavoriteResponseDto(favorite, book);
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check if a book is in user's favorites
   */
  async isFavorite(userId, bookId) {
    try {
      const result = await pool.query(
        'SELECT * FROM favorites WHERE user_id = $1 AND book_id = $2',
        [userId, bookId]
      );
      
      return result.rows.length > 0;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Add a book to favorites
   */
  async addFavorite(createFavoriteDto) {
    try {
      // Create and validate
      const favorite = new Favorite(createFavoriteDto);
      const validation = favorite.validate();
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }
      
      // Check if book exists
      const book = await BookService.getBookById(favorite.book_id);
      if (!book) {
        throw new Error('Book not found');
      }
      
      // Check if already in favorites
      const isAlreadyFavorite = await this.isFavorite(favorite.user_id, favorite.book_id);
      if (isAlreadyFavorite) {
        throw new Error('Book is already in favorites');
      }
      
      // Add to favorites
      const result = await pool.query(
        'INSERT INTO favorites (user_id, book_id, created_at) VALUES ($1, $2, NOW()) RETURNING *',
        [favorite.user_id, favorite.book_id]
      );
      
      return new FavoriteResponseDto(result.rows[0], book);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Remove a book from favorites
   */
  async removeFavorite(userId, bookId) {
    try {
      // Check if in favorites
      const isAlreadyFavorite = await this.isFavorite(userId, bookId);
      if (!isAlreadyFavorite) {
        throw new Error('Book is not in favorites');
      }
      
      // Remove from favorites
      await pool.query(
        'DELETE FROM favorites WHERE user_id = $1 AND book_id = $2',
        [userId, bookId]
      );
      
      return { 
        user_id: userId, 
        book_id: bookId, 
        message: 'Book removed from favorites' 
      };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new FavoriteService();
