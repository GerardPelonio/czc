const COLLECTION = 'shop';

const shopItemSchema = {
  id: { type: 'string', required: true, unique: true },
  title: { type: 'string', required: true },
  description: { type: 'string', default: '' },
  cost: { type: 'number', required: true },
  imageUrl: { type: 'string', default: null },
  category: { type: 'string', default: 'general' },
  stock: { type: 'number', default: 1 },
  createdAt: { type: 'timestamp', default: null },
  updatedAt: { type: 'timestamp', default: null },
};

const COLLECTION_TRANSACTIONS = 'shopTransactions';

const transactionSchema = {
  userId: { type: 'string', required: true },
  itemId: { type: 'string', required: true },
  cost: { type: 'number', required: true },
  itemSnapshot: { type: 'object', required: true },
  status: { type: 'string', enum: ['completed', 'failed'], required: true },
  reason: { type: 'string', default: null },
  createdAt: { type: 'timestamp', default: null },
};

module.exports = { COLLECTION, shopItemSchema, COLLECTION_TRANSACTIONS, transactionSchema };
