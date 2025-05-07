const { pool } = require('../../db');
const Book = require('../entities/Book');
const { BookResponseDto } = require('../dtos/BookDto');

/**
 * Book Service
 * Handles business logic for book operations
 */
class BookService {
  /**
   * Get all books
   */
  async getAllBooks() {
    try {
      const result = await pool.query(`
        SELECT b.*, u.username as owner_name 
        FROM books b
        JOIN users u ON b.owner_id = u.id
        ORDER BY b.created_at DESC
      `);
      
      return result.rows.map(book => new BookResponseDto(book, book.owner_name));
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get books by owner ID
   */
  async getBooksByOwnerId(ownerId) {
    try {
      const result = await pool.query(
        'SELECT * FROM books WHERE owner_id = $1 ORDER BY created_at DESC',
        [ownerId]
      );
      
      return result.rows.map(book => new BookResponseDto(book));
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get book by ID
   */
  async getBookById(id) {
    try {
      const result = await pool.query(`
        SELECT b.*, u.username as owner_name 
        FROM books b
        JOIN users u ON b.owner_id = u.id
        WHERE b.id = $1
      `, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return new BookResponseDto(result.rows[0], result.rows[0].owner_name);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Create a new book
   */
  async createBook(createBookDto) {
    try {
      // Convert DTO to Entity
      const book = new Book(createBookDto);
      
      // Validate book
      const validation = book.validate();
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }
      
      const result = await pool.query(
        `INSERT INTO books (
          title, author, description, cover_image, isbn, condition, 
          owner_id, price, rent_price, is_rentable, is_sellable, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        RETURNING *`,
        [
          book.title, book.author, book.description, book.cover_image,
          book.isbn, book.condition, book.owner_id, book.price,
          book.rent_price, book.is_rentable, book.is_sellable
        ]
      );
      
      return new BookResponseDto(result.rows[0]);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update book details
   */
  async updateBook(id, updateBookDto) {
    try {
      // First check if book exists
      const existingBook = await this.getBookById(id);
      if (!existingBook) {
        throw new Error('Book not found');
      }
      
      // Merge existing book with update data
      const updatedBook = new Book({
        ...existingBook,
        ...updateBookDto,
        id
      });
      
      // Validate the updated book
      const validation = updatedBook.validate();
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }
      
      const result = await pool.query(
        `UPDATE books SET
          title = $1, author = $2, description = $3, cover_image = $4,
          isbn = $5, condition = $6, status = $7, price = $8,
          rent_price = $9, is_rentable = $10, is_sellable = $11,
          updated_at = NOW()
        WHERE id = $12
        RETURNING *`,
        [
          updatedBook.title, updatedBook.author, updatedBook.description,
          updatedBook.cover_image, updatedBook.isbn, updatedBook.condition,
          updatedBook.status, updatedBook.price, updatedBook.rent_price,
          updatedBook.is_rentable, updatedBook.is_sellable, id
        ]
      );
      
      return new BookResponseDto(result.rows[0]);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete a book
   */
  async deleteBook(id) {
    try {
      // First check if book exists
      const existingBook = await this.getBookById(id);
      if (!existingBook) {
        throw new Error('Book not found');
      }
      
      await pool.query('DELETE FROM books WHERE id = $1', [id]);
      
      return { id, message: 'Book deleted successfully' };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Search for books
   */
  async searchBooks(query) {
    try {
      const searchTerm = `%${query}%`;
      
      const result = await pool.query(`
        SELECT b.*, u.username as owner_name 
        FROM books b
        JOIN users u ON b.owner_id = u.id
        WHERE 
          b.title ILIKE $1 OR
          b.author ILIKE $1 OR
          b.description ILIKE $1 OR
          b.isbn ILIKE $1
        ORDER BY b.created_at DESC
      `, [searchTerm]);
      
      return result.rows.map(book => new BookResponseDto(book, book.owner_name));
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new BookService();
