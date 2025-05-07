const favoriteService = require('../services/FavoriteService');
const { CreateFavoriteDto } = require('../dtos/FavoriteDto');

const favoriteController = {
  // Get user's favorites
  getUserFavorites: async (req, res) => {
    try {
      const userId = req.user.id;
      const favorites = await favoriteService.getUserFavorites(userId);
      return res.status(200).json(favorites);
    } catch (error) {
      console.error('Error getting favorites:', error);
      return res.status(500).json({ error: 'Server error' });
    }
  },

  // Check if book is in favorites
  checkFavorite: async (req, res) => {
    try {
      const userId = req.user.id;
      const bookId = req.params.bookId;
      
      const isFavorite = await favoriteService.isFavorite(userId, bookId);
      return res.status(200).json({ isFavorite });
    } catch (error) {
      console.error('Error checking favorite:', error);
      return res.status(500).json({ error: 'Server error' });
    }
  },

  // Add book to favorites
  addFavorite: async (req, res) => {
    try {
      const createFavoriteDto = new CreateFavoriteDto({
        user_id: req.user.id,
        book_id: req.params.bookId
      });
      
      const newFavorite = await favoriteService.addFavorite(createFavoriteDto);
      return res.status(201).json(newFavorite);
    } catch (error) {
      console.error('Error adding favorite:', error);
      if (error.message.includes('already in favorites') || 
          error.message.includes('not found')) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Server error' });
    }
  },

  // Remove book from favorites
  removeFavorite: async (req, res) => {
    try {
      const userId = req.user.id;
      const bookId = req.params.bookId;
      
      const result = await favoriteService.removeFavorite(userId, bookId);
      return res.status(200).json(result);
    } catch (error) {
      console.error('Error removing favorite:', error);
      if (error.message.includes('not in favorites')) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Server error' });
    }
  }
};

module.exports = favoriteController;
