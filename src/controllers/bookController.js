const bookService = require('../services/BookService');
const { CreateBookDto, UpdateBookDto } = require('../dtos/BookDto');

const bookController = {
  // Get all books
  getAllBooks: async (req, res) => {
    try {
      const books = await bookService.getAllBooks();
      return res.status(200).json(books);
    } catch (error) {
      console.error('Error getting books:', error);
      return res.status(500).json({ error: 'Server error' });
    }
  },

  // Get books by owner
  getBooksByOwner: async (req, res) => {
    try {
      const ownerId = req.params.userId;
      const books = await bookService.getBooksByOwnerId(ownerId);
      return res.status(200).json(books);
    } catch (error) {
      console.error('Error getting user books:', error);
      return res.status(500).json({ error: 'Server error' });
    }
  },

  // Get book by ID
  getBookById: async (req, res) => {
    try {
      const book = await bookService.getBookById(req.params.id);
      if (!book) {
        return res.status(404).json({ error: 'Book not found' });
      }
      return res.status(200).json(book);
    } catch (error) {
      console.error('Error getting book:', error);
      return res.status(500).json({ error: 'Server error' });
    }
  },

  // Create new book
  createBook: async (req, res) => {
    try {
      // Set owner_id from authenticated user
      const createBookDto = new CreateBookDto({
        ...req.body,
        owner_id: req.user.id // From JWT auth middleware
      });
      
      const newBook = await bookService.createBook(createBookDto);
      return res.status(201).json(newBook);
    } catch (error) {
      console.error('Error creating book:', error);
      if (error.message.includes('must be') || error.message.includes('required')) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Server error' });
    }
  },

  // Update book
  updateBook: async (req, res) => {
    try {
      const bookId = req.params.id;
      
      // Verify book exists and user owns it
      const existingBook = await bookService.getBookById(bookId);
      if (!existingBook) {
        return res.status(404).json({ error: 'Book not found' });
      }
      
      // Only owner or admin can update
      if (existingBook.owner_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'You are not authorized to update this book' });
      }
      
      const updateBookDto = new UpdateBookDto({
        ...req.body,
        id: bookId
      });
      
      const updatedBook = await bookService.updateBook(bookId, updateBookDto);
      return res.status(200).json(updatedBook);
    } catch (error) {
      console.error('Error updating book:', error);
      if (error.message.includes('must be') || error.message.includes('required')) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Server error' });
    }
  },

  // Delete book
  deleteBook: async (req, res) => {
    try {
      const bookId = req.params.id;
      
      // Verify book exists and user owns it
      const existingBook = await bookService.getBookById(bookId);
      if (!existingBook) {
        return res.status(404).json({ error: 'Book not found' });
      }
      
      // Only owner or admin can delete
      if (existingBook.owner_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'You are not authorized to delete this book' });
      }
      
      const result = await bookService.deleteBook(bookId);
      return res.status(200).json(result);
    } catch (error) {
      console.error('Error deleting book:', error);
      return res.status(500).json({ error: 'Server error' });
    }
  },

  // Search books
  searchBooks: async (req, res) => {
    try {
      const { query } = req.query;
      if (!query) {
        return res.status(400).json({ error: 'Search query is required' });
      }
      
      const books = await bookService.searchBooks(query);
      return res.status(200).json(books);
    } catch (error) {
      console.error('Error searching books:', error);
      return res.status(500).json({ error: 'Server error' });
    }
  }
};

module.exports = bookController;
