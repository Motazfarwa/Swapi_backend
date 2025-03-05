const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt= require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const stripe = require('stripe')("sk_test_51PFIvmRsp6m9X8kfSlRvFvYUP3ry62uUzpF4EPWVUTz6EgJ6OEn0hUDSnjFetfkUdUbn3knQ8uVhF97B2TZ54gWG00UMnRS5RH");

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Save files in the 'uploads' directory
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname); // Prevent duplicate names
  },
});

// File filter to allow only specific types
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/png', 'image/jpeg', 'image/jpg', // Images
    'video/mp4', 'video/mpeg', 'video/avi', 'video/quicktime', // Videos
    'application/pdf', // PDF
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // Excel (XLSX)
    'application/vnd.ms-excel', // Excel (XLS)
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file type'), false);
  }
};

// Initialize multer
const upload = multer({ 
  storage, 
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 } // 10MB file size limit
});

JWT_SECRET='12345'
router.post('/register', async (req, res) => {
  const { email, password, role } = req.body;

  try {
    // Check if the user already exists
    const userExists = await pool.query('SELECT * FROM utilisateur WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user into the database
    const result = await pool.query(
      'INSERT INTO utilisateur (email, password, role) VALUES ($1, $2, $3) RETURNING *',
      [email, hashedPassword, role]
    );

    res.status(200).json({ message: 'User created successfully', userId: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Registration failed' });
  }
});


router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if the user exists
    const result = await pool.query('SELECT * FROM utilisateur WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Compare the password with the stored hashed password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: '72h' }
    );

    res.status(200).json({ message: 'Login successful', token, role: user.role });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Login failed' });
  }
});


// Upload endpoint
router.post('/machines', upload.fields([{ name: 'file', maxCount: 1 }, { name: 'bookimagefile', maxCount: 1 }]), async (req, res) => {
  const { nom, description } = req.body;
  const file = req.files['file'][0].filename;
  const bookimagefile = req.files['bookimagefile'][0].filename;

  if (!nom || !description || !file  || !bookimagefile) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO books (nom, description, file, bookimagefile) VALUES ($1, $2, $3, $4) RETURNING *',
      [nom, description, file, bookimagefile]
    );

    res.status(201).json({ message: 'Machine added successfully', machine: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error adding machine' });
  }
});

router.get('/machines', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM books');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching machines' });
  }
});


router.get('/machines/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await pool.query('SELECT * FROM books WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'books not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching machine details' });
  }
});

router.delete('/machines/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Delete the machine record from the database
    const result = await pool.query('DELETE FROM books WHERE id = $1 RETURNING *', [id]);

    // If the result is empty, that means the machine was not found
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Machine not found' });
    }

    // Successfully deleted
    res.json({ message: 'books deleted successfully', machine: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error deleting machine' });
  }
});
 
router.put('/machines/:id', upload.fields([{ name: 'file', maxCount: 1 }, { name: 'bookimagefile', maxCount: 1 }]), async (req, res) => {
  const { nom, description } = req.body;
  const { id } = req.params; // Extract the machine ID from the URL
  const updatedFile = req.files['file'] ? req.files['file'][0].filename : null;
  const updatedImageFile = req.files['bookimagefile'] ? req.files['bookimagefile'][0].filename : null;

  // Validation: Make sure the required fields are provided
  if (!nom || !description) {
    return res.status(400).json({ message: 'Name and description are required' });
  }

  try {
    // Query to update the machine's data
    const result = await pool.query(
      `UPDATE books 
      SET nom = $1, description = $2, 
          file = COALESCE($3, file), 
          bookimagefile = COALESCE($4, bookimagefile) 
      WHERE id = $5 
      RETURNING *`,
      [
        nom, 
        description, 
        updatedFile, 
        updatedImageFile, 
        id
      ]
    );

    // Check if the machine was updated successfully
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Books not found' });
    }

    res.status(200).json({ message: 'Books updated successfully', machine: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error updating Books' });
  }
});


// File download endpoint
router.get('/download/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, '../uploads', filename);

  res.download(filePath, filename, (err) => {
    if (err) {
      console.error('File download error:', err);
      res.status(500).json({ message: 'Error downloading file' });
    }
  });
});

// Create Payment Intent
router.post('/create-payment-intent', async (req, res) => {
  try {
    const { amount, currency = 'usd', description } = req.body;
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      description,
      metadata: { integration_check: 'accept_a_payment' }
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Confirm Payment
router.post('/confirm-payment', async (req, res) => {
  try {
    const { paymentId, amount, metadata } = req.body;
    
    const payment = new Payment({
      paymentId,
      amount: amount / 100, // Store in dollars
      currency: 'usd',
      customerName: metadata.name,
      customerEmail: metadata.email,
      description: metadata.description
    });

    await payment.save();

    res.json({ success: true, payment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
