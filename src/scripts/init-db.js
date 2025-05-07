// const bcrypt = require('bcryptjs');
// const { pool } = require('../../db');
// const { runMigrations } = require('../db/migrate');

// async function createAdminUser() {
//   try {
//     // Check if admin user already exists
//     const checkUser = await pool.query('SELECT * FROM users WHERE email = $1', ['admin@example.com']);
//     if (checkUser.rows.length > 0) {
//       console.log('Admin user already exists');
//       return;
//     }

//     // Hash password
//     const salt = await bcrypt.genSalt(10);
//     const hashedPassword = await bcrypt.hash('admin123', salt);
    
//     // Create admin user
//     await pool.query(
//       'INSERT INTO users (username, email, password, role, created_at) VALUES ($1, $2, $3, $4, NOW())',
//       ['admin', 'admin@example.com', hashedPassword, 'admin']
//     );
    
//     console.log('Admin user created successfully');
//   } catch (error) {
//     console.error('Error creating admin user:', error);
//     throw error;
//   }
// }

// async function initializeDatabase() {
//   try {
//     console.log('Initializing database...');
    
//     // Run migrations first
//     await runMigrations();
    
//     // Create admin user
//     await createAdminUser();
    
//     console.log('Database initialization completed successfully');
//   } catch (error) {
//     console.error('Database initialization failed:', error);
//   } finally {
//     await pool.end();
//   }
// }

// // Run if this file is executed directly
// if (require.main === module) {
//   initializeDatabase().then(() => {
//     console.log('Database setup completed.');
//     process.exit(0);
//   }).catch(error => {
//     console.error('Database setup failed:', error);
//     process.exit(1);
//   });
// }

// module.exports = { initializeDatabase };
