const COLLECTION = 'users';

const userSchema = {
  id: { type: 'string', required: true, unique: true },
  email: { type: 'string', required: true, unique: true },
  username: { type: 'string', required: true, unique: true },
  password: { type: 'string', required: true },
  role: { type: 'string', required: true, enum: ['student', 'teacher'] },
};

module.exports = { COLLECTION, userSchema };