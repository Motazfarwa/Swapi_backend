/**
 * Data Transfer Objects for Book operations
 */

/**
 * DTO for book creation requests
 */
class CreateBookDto {
  constructor(data) {
    this.title = data.title;
    this.author = data.author;
    this.description = data.description || '';
    this.cover_image = data.cover_image || null;
    this.isbn = data.isbn || null;
    this.condition = data.condition || 'good';
    this.owner_id = data.owner_id;
    this.price = data.price || null;
    this.rent_price = data.rent_price || null;
    this.is_rentable = data.is_rentable !== undefined ? data.is_rentable : true;
    this.is_sellable = data.is_sellable !== undefined ? data.is_sellable : true;
  }
}

/**
 * DTO for book update requests
 */
class UpdateBookDto {
  constructor(data) {
    this.id = data.id;
    this.title = data.title;
    this.author = data.author;
    this.description = data.description;
    this.cover_image = data.cover_image;
    this.isbn = data.isbn;
    this.condition = data.condition;
    this.status = data.status;
    this.price = data.price;
    this.rent_price = data.rent_price;
    this.is_rentable = data.is_rentable;
    this.is_sellable = data.is_sellable;
  }
}

/**
 * DTO for book response
 */
class BookResponseDto {
  constructor(book, ownerName = null) {
    this.id = book.id;
    this.title = book.title;
    this.author = book.author;
    this.description = book.description;
    this.cover_image = book.cover_image;
    this.isbn = book.isbn;
    this.condition = book.condition;
    this.owner_id = book.owner_id;
    this.owner_name = ownerName;
    this.status = book.status;
    this.price = book.price;
    this.rent_price = book.rent_price;
    this.is_rentable = book.is_rentable;
    this.is_sellable = book.is_sellable;
    this.created_at = book.created_at;
  }
}

module.exports = {
  CreateBookDto,
  UpdateBookDto,
  BookResponseDto
};
