const { pool } = require('../../db');
const Exchange = require('../entities/Exchange');
const BookService = require('./BookService');
const { ExchangeResponseDto } = require('../dtos/ExchangeDto');

/**
 * Exchange Service
 * Handles business logic for exchange operations (renting and buying)
 */
class ExchangeService {
  /**
   * Get exchange by ID
   */
  async getExchangeById(id) {
    try {
      const result = await pool.query(`
        SELECT e.*, 
          b.title as book_title,
          o.username as owner_name,
          r.username as requester_name
        FROM exchanges e
        JOIN books b ON e.book_id = b.id
        JOIN users o ON e.owner_id = o.id
        JOIN users r ON e.requester_id = r.id
        WHERE e.id = $1
      `, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const exchange = result.rows[0];
      return new ExchangeResponseDto(
        exchange, 
        exchange.book_title,
        exchange.owner_name,
        exchange.requester_name
      );
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get exchanges by user (as owner or requester)
   */
  async getExchangesByUser(userId) {
    try {
      const result = await pool.query(`
        SELECT e.*, 
          b.title as book_title,
          o.username as owner_name,
          r.username as requester_name
        FROM exchanges e
        JOIN books b ON e.book_id = b.id
        JOIN users o ON e.owner_id = o.id
        JOIN users r ON e.requester_id = r.id
        WHERE e.owner_id = $1 OR e.requester_id = $1
        ORDER BY e.created_at DESC
      `, [userId]);
      
      return result.rows.map(exchange => 
        new ExchangeResponseDto(
          exchange, 
          exchange.book_title,
          exchange.owner_name,
          exchange.requester_name
        )
      );
    } catch (error) {
      throw error;
    }
  }

  /**
   * Create a new exchange (request to rent or buy)
   */
  async createExchange(createExchangeDto) {
    try {
      // First, verify the book exists and is available
      const book = await BookService.getBookById(createExchangeDto.book_id);
      if (!book) {
        throw new Error('Book not found');
      }
      
      if (book.status !== 'available') {
        throw new Error('Book is not available for exchange');
      }
      
      // Check if the book can be rented/bought based on the request
      if (createExchangeDto.type === 'rent' && !book.is_rentable) {
        throw new Error('Book is not available for rent');
      }
      
      if (createExchangeDto.type === 'buy' && !book.is_sellable) {
        throw new Error('Book is not available for sale');
      }
      
      // Verify the owner matches
      if (book.owner_id !== createExchangeDto.owner_id) {
        throw new Error('Owner ID does not match book owner');
      }
      
      // Prevent user from exchanging with themselves
      if (createExchangeDto.owner_id === createExchangeDto.requester_id) {
        throw new Error('You cannot exchange a book with yourself');
      }
      
      // Create Exchange entity and validate
      const exchange = new Exchange(createExchangeDto);
      const validation = exchange.validate();
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }
      
      // Begin transaction
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        
        // Create the exchange record
        const exchangeResult = await client.query(
          `INSERT INTO exchanges (
            book_id, owner_id, requester_id, type, status,
            start_date, end_date, price, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
          RETURNING *`,
          [
            exchange.book_id, exchange.owner_id, exchange.requester_id,
            exchange.type, 'pending', exchange.start_date, 
            exchange.end_date, exchange.price
          ]
        );
        
        // Update book status to 'pending'
        await client.query(
          'UPDATE books SET status = $1, updated_at = NOW() WHERE id = $2',
          ['pending', exchange.book_id]
        );
        
        await client.query('COMMIT');
        
        return await this.getExchangeById(exchangeResult.rows[0].id);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update exchange status (accept, reject, complete, cancel)
   */
  async updateExchangeStatus(id, status, userId) {
    try {
      // Verify the exchange exists
      const existingExchange = await this.getExchangeById(id);
      if (!existingExchange) {
        throw new Error('Exchange not found');
      }
      
      // Verify the user is authorized (must be owner or requester)
      if (existingExchange.owner_id !== userId && existingExchange.requester_id !== userId) {
        throw new Error('You are not authorized to update this exchange');
      }
      
      // Validate status transitions
      this.validateStatusTransition(existingExchange.status, status, userId, existingExchange);
      
      // Begin transaction
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        
        // Update exchange status
        const result = await client.query(
          'UPDATE exchanges SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
          [status, id]
        );
        
        // Update book status based on exchange status
        let bookStatus;
        if (status === 'accepted') {
          // If it's a rental, mark as rented; if it's a purchase, mark as sold
          bookStatus = existingExchange.type === 'rent' ? 'rented' : 'sold';
        } else if (status === 'rejected' || status === 'canceled') {
          bookStatus = 'available';
        } else if (status === 'completed') {
          // For completed rentals, return to available; for completed sales, keep as sold
          bookStatus = existingExchange.type === 'rent' ? 'available' : 'sold';
        }
        
        await client.query(
          'UPDATE books SET status = $1, updated_at = NOW() WHERE id = $2',
          [bookStatus, existingExchange.book_id]
        );
        
        await client.query('COMMIT');
        
        return await this.getExchangeById(id);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Validate status transition
   */
  validateStatusTransition(currentStatus, newStatus, userId, exchange) {
    const isOwner = exchange.owner_id === userId;
    const isRequester = exchange.requester_id === userId;
    
    // Only allow certain status transitions
    if (currentStatus === 'pending') {
      // Owner can accept or reject
      if (isOwner && !['accepted', 'rejected'].includes(newStatus)) {
        throw new Error('Owner can only accept or reject a pending exchange');
      }
      
      // Requester can only cancel
      if (isRequester && newStatus !== 'canceled') {
        throw new Error('Requester can only cancel a pending exchange');
      }
    } else if (currentStatus === 'accepted') {
      // Only the owner can mark as completed
      if (isOwner && newStatus !== 'completed') {
        throw new Error('Owner can only mark an accepted exchange as completed');
      }
      
      // Requester cannot change status once accepted
      if (isRequester) {
        throw new Error('Requester cannot change status of an accepted exchange');
      }
    } else if (['rejected', 'completed', 'canceled'].includes(currentStatus)) {
      // Final states cannot be changed
      throw new Error(`Exchange is already ${currentStatus} and cannot be changed`);
    }
  }
}

module.exports = new ExchangeService();
