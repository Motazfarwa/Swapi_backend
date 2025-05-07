const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const { initDatabase } = require('./src/db/initDb');

// Import routes
const userRoutes = require('./src/routes/userRoutes');
const dbCheckRoutes = require('./src/routes/dbCheckRoutes');
const bookRoutes = require('./src/routes/bookRoutes');
const exchangeRoutes = require('./src/routes/exchangeRoutes');
const favoriteRoutes = require('./src/routes/favoriteRoutes');
const chatRoutes = require('./src/routes/chatRoutes');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// WebSocket connections store
const connectedUsers = {};

// Socket.io middleware for authentication
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    console.log('Socket connection attempt without token');
    return next(new Error('Authentication error: No token provided'));
  }
  
  try {
    // We'll use the same token verification as in auth middleware
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
    
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.userId = decoded.userId || decoded.id;
    console.log('Socket authenticated for user:', socket.userId);
    next();
  } catch (error) {
    console.error('Socket authentication error:', error.message);
    return next(new Error('Authentication error: Invalid token'));
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  const userId = socket.userId;
  
  console.log(`User connected: ${userId}`);
  
  // Store the connection
  connectedUsers[userId] = socket.id;
  
  // User joins their private notification channel
  socket.join(`user:${userId}`);
  
  // Send confirmation to client
  socket.emit('connected', { userId });
  
  // Send any pending notifications immediately
  sendPendingNotifications(userId, socket);
  
  // Handle chat messages
  socket.on('send_message', async (data) => {
    try {
      const { recipientId, message, exchangeId } = data;
      const senderId = userId;
      
      console.log(`Message from ${senderId} to ${recipientId} in exchange ${exchangeId}`);
      
      // Use the message service
      const messageService = require('./src/services/MessageService');
      const newMessage = await messageService.createMessage({
        sender_id: senderId,
        recipient_id: recipientId,
        exchange_id: exchangeId,
        content: message
      });
      
      // Get sender name
      const { pool } = require('./db');
      const userResult = await pool.query('SELECT username FROM users WHERE id = $1', [senderId]);
      const senderName = userResult.rows[0]?.username || 'User';
      
      // Send to recipient if online
      messageService.sendRealtimeMessage(io, connectedUsers, recipientId, newMessage, senderName);
      
      // Send confirmation to sender
      socket.emit('message_sent', newMessage);
      
      // Create notification for recipient
      const notificationService = require('./src/services/NotificationService');
      const notification = await notificationService.createNotification({
        user_id: recipientId,
        sender_id: senderId,
        type: 'message',
        message: `${senderName} sent you a message: "${message.substring(0, 30)}${message.length > 30 ? '...' : ''}"`,
        data: {
          exchange_id: exchangeId,
          message_id: newMessage.id
        }
      });
      
      // Send notification
      notificationService.sendRealtimeNotification(io, connectedUsers, recipientId, notification);
    } catch (error) {
      console.error('Error handling message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });
  
  // Handle heartbeat
  socket.on('heartbeat', () => {
    // Respond with an ack
    socket.emit('heartbeat_ack', { timestamp: new Date().toISOString() });
  });
  
  // Handle user disconnection
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${userId}`);
    delete connectedUsers[userId];
  });
});

// Function to send pending notifications on connection
async function sendPendingNotifications(userId, socket) {
  try {
    const { pool } = require('./db');
    const result = await pool.query(
      `SELECT n.*, u.username as sender_name
       FROM notifications n
       LEFT JOIN users u ON n.sender_id = u.id
       WHERE n.user_id = $1 AND n.is_read = false
       ORDER BY n.created_at DESC`,
      [userId]
    );
    
    if (result.rows.length > 0) {
      console.log(`Sending ${result.rows.length} pending notifications to user ${userId}`);
      socket.emit('pending_notifications', result.rows);
    }
  } catch (error) {
    console.error('Error sending pending notifications:', error);
  }
}

// Export connectedUsers and io for use in other files
app.set('io', io);
app.set('connectedUsers', connectedUsers);

// Middleware
app.use(bodyParser.json());
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/users', userRoutes);
app.use('/api/db', dbCheckRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/exchanges', exchangeRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/chat', chatRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Initialize database before starting server
initDatabase()
  .then(() => {
    const PORT = process.env.PORT || 4000;
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
