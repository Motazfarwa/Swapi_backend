const express = require('express');
const router = express.Router();
const { pool } = require('../../db');

// GET /api/db/status - Check database connection status
router.get('/status', async (req, res) => {
    try {
        const result = await dbUtils.testConnection();
        
        if (result.success) {
            return res.status(200).json({ 
                status: 'ok',
                message: result.message,
                timestamp: new Date().toISOString()
            });
        } else {
            return res.status(500).json({ 
                status: 'error',
                message: result.message,
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        return res.status(500).json({ 
            status: 'error',
            message: 'Error checking database connection',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// GET /api/db/details - Check database details
router.get('/details', async (req, res) => {
    try {
        const result = await dbUtils.getDatabaseDetails();
        
        if (result.success) {
            return res.status(200).json({
                status: 'ok',
                ...result.details
            });
        } else {
            return res.status(500).json({
                status: 'error',
                message: 'Failed to get database details',
                error: result.error,
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        return res.status(500).json({
            status: 'error',
            message: 'Error checking database details',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Check database connection
router.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.status(200).json({
      status: 'ok',
      message: 'Database connection successful',
      timestamp: result.rows[0].now
    });
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Database connection failed',
      error: error.message
    });
  }
});

// Check database tables
router.get('/tables', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    res.status(200).json({
      status: 'ok',
      message: 'Tables retrieved successfully',
      tables: result.rows.map(row => row.table_name)
    });
  } catch (error) {
    console.error('Error fetching tables:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve database tables',
      error: error.message
    });
  }
});

module.exports = router;
