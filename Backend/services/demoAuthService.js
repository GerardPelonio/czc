// In-memory user storage for demo/development mode when Firebase is unavailable
const users = new Map();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const jwtKey = process.env.JWT_KEY || 'demo-secret-key';

async function demoRegisterUser({ username, email, password, id, role }) {
  if (users.has(email)) {
    throw Object.assign(new Error('Email already exists'), { status: 409 });
  }

  const salt = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(password, salt);
  const userId = id || `user-${Date.now()}`;

  const userData = {
    id: userId,
    email,
    username,
    password: hashed,
    role: role || 'student',
    createdAt: new Date().toISOString()
  };

  users.set(email, userData);
  
  const safe = { ...userData };
  delete safe.password;
  return safe;
}

async function demoAuthenticateUser(email, password, role) {
  const user = users.get(email);
  
  if (!user) {
    throw Object.assign(new Error('Invalid email or password'), { status: 401 });
  }

  if (role && user.role !== role) {
    throw Object.assign(new Error('Invalid email or password'), { status: 401 });
  }

  const match = await bcrypt.compare(password, user.password || '');
  if (!match) {
    throw Object.assign(new Error('Invalid email or password'), { status: 401 });
  }

  const payload = { id: user.id, email: user.email, username: user.username, role: user.role };
  const token = jwt.sign(payload, jwtKey, { expiresIn: '7d' });

  const safe = { ...user };
  delete safe.password;
  return { user: safe, token };
}

module.exports = {
  demoRegisterUser,
  demoAuthenticateUser,
  // For debugging: get all users
  getAllUsers: () => Array.from(users.values()).map(u => {
    const { password, ...safe } = u;
    return safe;
  })
};
