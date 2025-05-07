const express = require('express');
const router = express.Router();
const { pool } = require('../../db');
const { authMiddleware } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

// Configure file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/books'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, 'book-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Get all books
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM books');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching books:', error);
    res.status(500).json({ error: 'Failed to fetch books' });
  }
});

// Get books by category
router.get('/category/:category', async (req, res) => {
  try {
    const category = req.params.category;
    
    // Log the requested category for debugging
    console.log(`Fetching books with category: ${category}`);
    
    // First check if the category column exists
    try {
      const columnCheck = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'books' AND column_name = 'category'
      `);
      
      if (columnCheck.rows.length === 0) {
        // If category column doesn't exist, add it
        await pool.query(`
          ALTER TABLE books 
          ADD COLUMN category VARCHAR(50) DEFAULT 'other'
        `);
        console.log('Added missing category column to books table');
      }
    } catch (error) {
      console.error('Error checking/adding category column:', error);
      // Continue anyway - we'll handle errors gracefully
    }
    
    // Try query with exact match first (case insensitive)
    try {
      const result = await pool.query(
        'SELECT * FROM books WHERE LOWER(category) = LOWER($1)',
        [category]
      );
      
      console.log(`Found ${result.rows.length} books in category ${category} (exact match)`);
      
      // If no results found, try partial match
      if (result.rows.length === 0) {
        const fallbackResult = await pool.query(
          'SELECT * FROM books WHERE LOWER(category) LIKE LOWER($1)',
          [`%${category}%`]
        );
        
        console.log(`Found ${fallbackResult.rows.length} books in category ${category} (partial match)`);
        
        // If still no results, just return empty array instead of error
        if (fallbackResult.rows.length === 0) {
          return res.json([]);
        }
        
        return res.json(fallbackResult.rows);
      }
      
      return res.json(result.rows);
    } catch (error) {
      console.error('Error in category query:', error);
      
      // Fallback: get books and filter manually in JavaScript if SQL fails
      try {
        const allBooks = await pool.query('SELECT * FROM books');
        const filteredBooks = allBooks.rows.filter(book => 
          book.category && book.category.toLowerCase().includes(category.toLowerCase())
        );
        
        console.log(`Found ${filteredBooks.length} books in category ${category} (JS filter)`);
        return res.json(filteredBooks);
      } catch (fallbackError) {
        console.error('Fallback query also failed:', fallbackError);
        // Return empty array instead of error
        return res.json([]);
      }
    }
  } catch (error) {
    console.error('Error fetching books by category:', error);
    // Return empty array instead of error for better UX
    return res.json([]);
  }
});

// Get user's books
router.get('/my-books', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Query to get all books owned by the user
    const result = await pool.query(
      'SELECT * FROM books WHERE owner_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching user books:', error);
    res.status(500).json({ error: 'Failed to fetch user books' });
  }
});

// Get book by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM books WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Book not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching book:', error);
    res.status(500).json({ error: 'Failed to fetch book' });
  }
});

// Create new book
router.post('/', authMiddleware, upload.single('cover_image'), async (req, res) => {
  try {
    const { 
      title, author, description, isbn, price, rent_price,
      condition, category, is_rentable, is_sellable
    } = req.body;
    
    // Get the path of the uploaded file
    const coverImage = req.file ? `/uploads/books/${req.file.filename}` : null;
    
    // Get user ID from auth middleware
    const ownerId = req.user.id;
    
    // Insert into database
    const result = await pool.query(
      `INSERT INTO books (
        title, author, description, isbn, price, rent_price,
        condition, category, is_rentable, is_sellable, cover_image, owner_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [
        title, author, description, isbn, 
        price || 0, rent_price || 0,
        condition || 'good', category || 'other',
        is_rentable === 'true', is_sellable === 'true',
        coverImage, ownerId
      ]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating book:', error);
    res.status(500).json({ error: 'Failed to create book' });
  }
});

// Update book
router.put('/:id', authMiddleware, upload.single('cover_image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      title, author, description, isbn, price, rent_price,
      condition, category, is_rentable, is_sellable, status
    } = req.body;
    
    // Check if the user owns the book
    const bookCheck = await pool.query(
      'SELECT * FROM books WHERE id = $1',
      [id]
    );
    
    if (bookCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Book not found' });
    }
    
    const book = bookCheck.rows[0];
    
    // Only allow the owner to update the book
    if (book.owner_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You do not have permission to update this book' });
    }
    
    // Get the path of the uploaded file or use existing one
    const coverImage = req.file 
      ? `/uploads/books/${req.file.filename}` 
      : book.cover_image;
    
    // Update in database
    const result = await pool.query(
      `UPDATE books SET
        title = $1, author = $2, description = $3, isbn = $4,
        price = $5, rent_price = $6, condition = $7, category = $8,
        is_rentable = $9, is_sellable = $10, cover_image = $11,
        status = $12, updated_at = CURRENT_TIMESTAMP
      WHERE id = $13 RETURNING *`,
      [
        title || book.title,
        author || book.author,
        description || book.description,
        isbn || book.isbn,
        price || book.price,
        rent_price || book.rent_price,
        condition || book.condition,
        category || book.category,
        is_rentable === 'true' ? true : (is_rentable === 'false' ? false : book.is_rentable),
        is_sellable === 'true' ? true : (is_sellable === 'false' ? false : book.is_sellable),
        coverImage,
        status || book.status,
        id
      ]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating book:', error);
    res.status(500).json({ error: 'Failed to update book' });
  }
});

// Delete book
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if the user owns the book
    const bookCheck = await pool.query(
      'SELECT * FROM books WHERE id = $1',
      [id]
    );
    
    if (bookCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Book not found' });
    }
    
    const book = bookCheck.rows[0];
    
    // Only allow the owner to delete the book
    if (book.owner_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You do not have permission to delete this book' });
    }
    
    // Delete from database
    await pool.query('DELETE FROM books WHERE id = $1', [id]);
    
    res.json({ message: 'Book deleted successfully' });
  } catch (error) {
    console.error('Error deleting book:', error);
    res.status(500).json({ error: 'Failed to delete book' });
  }
});

// Search books
router.get('/search', async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    // Perform search
    const result = await pool.query(
      `SELECT * FROM books 
       WHERE title ILIKE $1 OR author ILIKE $1 OR description ILIKE $1
       ORDER BY created_at DESC`,
      [`%${query}%`]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error searching books:', error);
    res.status(500).json({ error: 'Failed to search books' });
  }
});

module.exports = router;
