/**
 * User Data Transfer Objects
 * For handling data that passes between layers
 */

/**
 * DTO for user creation requests
 */
class CreateUserDto {
  constructor(data) {
    this.username = data.username;
    this.email = data.email;
    this.password = data.password;
    this.role = data.role || 'user';
  }
}

/**
 * DTO for user update requests
 */
class UpdateUserDto {
  constructor(data) {
    this.id = data.id;
    this.username = data.username;
    this.email = data.email;
    this.role = data.role;
  }
}

/**
 * DTO for user responses
 */
class UserResponseDto {
  constructor(user) {
    this.id = user.id;
    this.username = user.username;
    this.email = user.email;
    this.role = user.role;
    this.created_at = user.created_at;
  }
}

/**
 * DTO for login requests
 */
class LoginDto {
  constructor(data) {
    this.email = data.email;
    this.password = data.password;
  }
}

/**
 * DTO for authentication responses
 */
class AuthResponseDto {
  constructor(user, token) {
    this.user = new UserResponseDto(user);
    this.token = token;
    this.message = 'Login successful';
  }
}

module.exports = {
  CreateUserDto,
  UpdateUserDto,
  UserResponseDto,
  LoginDto,
  AuthResponseDto
};
