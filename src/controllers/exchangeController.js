const exchangeService = require('../services/ExchangeService');
const { CreateExchangeDto } = require('../dtos/ExchangeDto');

const exchangeController = {
  // Get exchange by ID
  getExchangeById: async (req, res) => {
    try {
      const exchange = await exchangeService.getExchangeById(req.params.id);
      if (!exchange) {
        return res.status(404).json({ error: 'Exchange not found' });
      }
      
      // Verify user is authorized (must be owner or requester)
      if (exchange.owner_id !== req.user.id && exchange.requester_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'You are not authorized to view this exchange' });
      }
      
      return res.status(200).json(exchange);
    } catch (error) {
      console.error('Error getting exchange:', error);
      return res.status(500).json({ error: 'Server error' });
    }
  },

  // Get user's exchanges (as owner or requester)
  getUserExchanges: async (req, res) => {
    try {
      const userId = req.user.id;
      const exchanges = await exchangeService.getExchangesByUser(userId);
      return res.status(200).json(exchanges);
    } catch (error) {
      console.error('Error getting user exchanges:', error);
      return res.status(500).json({ error: 'Server error' });
    }
  },

  // Create new exchange (request to rent or buy)
  createExchange: async (req, res) => {
    try {
      const createExchangeDto = new CreateExchangeDto({
        ...req.body,
        requester_id: req.user.id // From JWT auth middleware
      });
      
      const newExchange = await exchangeService.createExchange(createExchangeDto);
      return res.status(201).json(newExchange);
    } catch (error) {
      console.error('Error creating exchange:', error);
      if (error.message.includes('not available') || 
          error.message.includes('yourself') ||
          error.message.includes('must be') || 
          error.message.includes('required') ||
          error.message.includes('does not match')) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Server error' });
    }
  },

  // Update exchange status (accept, reject, complete, cancel)
  updateExchangeStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      if (!status || !['accepted', 'rejected', 'completed', 'canceled'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      
      const userId = req.user.id;
      const updatedExchange = await exchangeService.updateExchangeStatus(id, status, userId);
      
      return res.status(200).json(updatedExchange);
    } catch (error) {
      console.error('Error updating exchange status:', error);
      if (error.message.includes('not authorized') || 
          error.message.includes('can only') ||
          error.message.includes('cannot change')) {
        return res.status(403).json({ error: error.message });
      }
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Server error' });
    }
  }
};

module.exports = exchangeController;
