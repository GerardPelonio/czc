const COLLECTION = 'teachers';

const teacherSchema = {
  teacherId: { type: 'string', required: true, unique: true },
  username: { type: 'string', required: true, unique: true },
  name: { type: 'string' },              
  subject: { type: 'string' },
  customization: { type: 'object' },
  avatarUrl: { type: 'string' },
  assignedStudents: { type: 'array' }
};

module.exports = { COLLECTION, teacherSchema };