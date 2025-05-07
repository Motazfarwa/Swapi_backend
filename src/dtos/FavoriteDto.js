/**
 * Data Transfer Objects for Favorite operations
 */

/**
 * DTO for favorite creation requests
 */
class CreateFavoriteDto {
  constructor(data) {
    this.user_id = data.user_id;
    this.book_id = data.book_id;
  }
}

/**
 * DTO for favorite response
 */
class FavoriteResponseDto {
  constructor(favorite, bookData = null) {
    this.id = favorite.id;
    this.user_id = favorite.user_id;
    this.book_id = favorite.book_id;
    this.book = bookData;
    this.created_at = favorite.created_at;
  }
}

module.exports = {
  CreateFavoriteDto,
  FavoriteResponseDto
};
