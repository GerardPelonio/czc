const COLLECTION = 'settings';

const settingsSchema = {
  userId: { type: 'string', required: true, unique: true },
  notifications: {
    email: { type: 'boolean' },
    push: { type: 'boolean' },
    reminderSchedule: { type: 'object' } 
  },
  privacy: {
    shareProfile: { type: 'boolean' },
    twoFactorEnabled: { type: 'boolean' }
  },
  reading: {
    view: { type: 'string' }, 
    autoSave: { type: 'boolean' },
    showStats: { type: 'boolean' },
    showTimer: { type: 'boolean' }
  },
  updatedAt: { type: 'string' }
};

module.exports = { COLLECTION, settingsSchema };