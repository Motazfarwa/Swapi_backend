const jwt = require('jsonwebtoken');
const { pool } = require('../../db');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const OLD_JWT_SECRET = '12345'; // Secret key used in the old Swapiservice.js

const authMiddleware = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization token required' });
    }
    
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Authorization token required' });
    }
    
    // Try to verify token with both secrets
    let decoded;
    try {
      // First try with the new secret
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (newSecretError) {
      try {
        // If that fails, try with the old secret
        decoded = jwt.verify(token, OLD_JWT_SECRET);
      } catch (oldSecretError) {
        // If both fail, then the token is invalid
        return res.status(401).json({ error: 'Invalid token' });
      }
    }
    
    // Check which key was used in the token (old or new format)
    if (decoded.userId) {
      // New format
      const result = await pool.query('SELECT * FROM users WHERE id = $1', [decoded.userId]);
      
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'User no longer exists' });
      }
      
      req.user = {
        id: decoded.userId,
        email: result.rows[0].email,
        username: result.rows[0].username,
        role: result.rows[0].role || 'user'
      };
    } else if (decoded.id) {
      // Alternative format
      const result = await pool.query('SELECT * FROM users WHERE id = $1', [decoded.id]);
      
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'User no longer exists' });
      }
      
      req.user = {
        id: decoded.id,
        email: result.rows[0].email,
        username: result.rows[0].username,
        role: result.rows[0].role || 'user'
      };
    } else {
      // Legacy format using the old Swapiservice endpoints
      try {
        // Check if the user exists in the utilisateur table
        const legacyResult = await pool.query('SELECT * FROM utilisateur WHERE id = $1', [decoded.userId || decoded.id]);
        
        if (legacyResult.rows.length > 0) {
          req.user = {
            id: decoded.userId || decoded.id,
            email: legacyResult.rows[0].email,
            role: legacyResult.rows[0].role || 'user'
          };
        } else {
          return res.status(401).json({ error: 'User no longer exists' });
        }
      } catch (legacyError) {
        console.error('Error checking legacy user:', legacyError);
        return res.status(401).json({ error: 'Invalid user credentials' });
      }
    }
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    
    res.status(500).json({ error: 'Server error during authentication' });
  }
};

module.exports = { authMiddleware };
