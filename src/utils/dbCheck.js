const { pool } = require('../../db');

const checkDatabaseDetails = async () => {
    let client;
    try {
        client = await pool.connect();
        
        // Get PostgreSQL version
        const versionResult = await client.query('SELECT version()');
        const version = versionResult.rows[0].version;
        
        // Get current database name
        const dbNameResult = await client.query('SELECT current_database()');
        const dbName = dbNameResult.rows[0].current_database;
        
        // Get active connections
        const connectionsResult = await client.query(
            'SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()'
        );
        const connections = connectionsResult.rows[0].count;
        
        // Get database size
        const sizeResult = await client.query(
            'SELECT pg_size_pretty(pg_database_size(current_database())) as size'
        );
        const size = sizeResult.rows[0].size;
        
        return {
            success: true,
            details: {
                version,
                dbName,
                connections,
                size,
                timestamp: new Date().toISOString()
            }
        };
    } catch (error) {
        console.error('Database check error:', error.message);
        return {
            success: false,
            error: error.message
        };
    } finally {
        if (client) client.release();
    }
};

module.exports = {
    checkDatabaseDetails
};
