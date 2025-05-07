const messageService = require('../services/MessageService');

class MessageController {
  /**
   * Get messages for an exchange
   */
  async getExchangeMessages(req, res) {
    try {
      const exchangeId = parseInt(req.params.exchangeId);
      const userId = req.user.id;
      
      const data = await messageService.getExchangeMessages(exchangeId, userId);
      res.json(data);
    } catch (error) {
      console.error('Error fetching exchange messages:', error);
      res.status(500).json({ error: 'Failed to fetch exchange messages' });
    }
  }
  
  /**
   * Get user's chats
   */
  async getUserChats(req, res) {
    try {
      const userId = req.user.id;
      
      const chats = await messageService.getUserChats(userId);
      res.json(chats);
    } catch (error) {
      console.error('Error fetching user chats:', error);
      res.status(500).json({ error: 'Failed to fetch user chats' });
    }
  }
}

module.exports = new MessageController();
