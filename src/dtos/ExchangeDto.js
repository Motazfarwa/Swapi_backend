/**
 * Data Transfer Objects for Exchange operations
 */

/**
 * DTO for exchange creation requests
 */
class CreateExchangeDto {
  constructor(data) {
    this.book_id = data.book_id;
    this.owner_id = data.owner_id;
    this.requester_id = data.requester_id;
    this.type = data.type; // 'rent' or 'buy'
    this.start_date = data.start_date || new Date();
    this.end_date = data.end_date; // required for rentals
    this.price = data.price;
  }
}

/**
 * DTO for exchange update requests
 */
class UpdateExchangeDto {
  constructor(data) {
    this.id = data.id;
    this.status = data.status;
    this.end_date = data.end_date;
  }
}

/**
 * DTO for exchange response
 */
class ExchangeResponseDto {
  constructor(exchange, bookTitle = null, ownerName = null, requesterName = null) {
    this.id = exchange.id;
    this.book_id = exchange.book_id;
    this.book_title = bookTitle;
    this.owner_id = exchange.owner_id;
    this.owner_name = ownerName;
    this.requester_id = exchange.requester_id;
    this.requester_name = requesterName;
    this.type = exchange.type;
    this.status = exchange.status;
    this.start_date = exchange.start_date;
    this.end_date = exchange.end_date;
    this.price = exchange.price;
    this.created_at = exchange.created_at;
  }
}

module.exports = {
  CreateExchangeDto,
  UpdateExchangeDto,
  ExchangeResponseDto
};
