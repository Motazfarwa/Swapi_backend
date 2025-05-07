const userService = require('../services/UserService');
const { CreateUserDto, UpdateUserDto, LoginDto } = require('../dtos/UserDto');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

const userController = {
  // Get all users
  getAllUsers: async (req, res) => {
    try {
      const users = await userService.getAllUsers();
      return res.status(200).json(users);
    } catch (error) {
      console.error('Error getting users:', error);
      return res.status(500).json({ error: 'Server error' });
    }
  },

  // Get user by ID
  getUserById: async (req, res) => {
    try {
      const user = await userService.getUserById(req.params.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      return res.status(200).json(user);
    } catch (error) {
      console.error('Error getting user:', error);
      return res.status(500).json({ error: 'Server error' });
    }
  },

  // Create new user
  createUser: async (req, res) => {
    try {
      const createUserDto = new CreateUserDto(req.body);
      const newUser = await userService.createUser(createUserDto);
      return res.status(201).json(newUser);
    } catch (error) {
      console.error('Error creating user:', error);
      if (error.message.includes('already exists') || 
          error.message.includes('must be') || 
          error.message.includes('required')) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Server error' });
    }
  },

  // Update user
  updateUser: async (req, res) => {
    try {
      const updateUserDto = new UpdateUserDto({
        ...req.body,
        id: req.params.id
      });
      
      const updatedUser = await userService.updateUser(req.params.id, updateUserDto);
      return res.status(200).json(updatedUser);
    } catch (error) {
      console.error('Error updating user:', error);
      if (error.message === 'User not found') {
        return res.status(404).json({ error: 'User not found' });
      }
      return res.status(500).json({ error: 'Server error' });
    }
  },

  // Delete user
  deleteUser: async (req, res) => {
    try {
      const result = await userService.deleteUser(req.params.id);
      return res.status(200).json(result);
    } catch (error) {
      console.error('Error deleting user:', error);
      if (error.message === 'User not found') {
        return res.status(404).json({ error: 'User not found' });
      }
      return res.status(500).json({ error: 'Server error' });
    }
  },

  // Login user
  login: async (req, res) => {
    try {
      const loginDto = new LoginDto(req.body);
      
      // Basic validation
      if (!loginDto.email || !loginDto.password) {
        return res.status(400).json({ error: 'Please provide email and password' });
      }
      
      const authResult = await userService.authenticate(loginDto);
      
      if (!authResult) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      return res.status(200).json(authResult);
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({ error: 'Server error' });
    }
  }
};

module.exports = userController;
