module.exports = {
  COLLECTION: 'subscriptions',
  subscriptionSchema: {
    userId: { type: 'string', required: true, unique: true },
    plan: { type: 'string', required: true, enum: ['Free', 'Premium'] },
    status: { type: 'string', required: true, enum: ['active', 'cancelled', 'expired', 'pending'] },
    startDate: { type: 'string', required: false },
    endDate: { type: 'string', required: false },
    paymongo: {
      customerId: { type: 'string', required: false },
      subscriptionId: { type: 'string', required: false },
      invoiceId: { type: 'string', required: false }
    }
  }
};