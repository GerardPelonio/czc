// controllers/ShopController.js

const ShopService = require("../services/ShopService");

const ShopController = {
  async listItems(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const result = await ShopService.listItems({ page: Number(page), limit: Number(limit) });
      res.json({ success: true, data: result.items, pagination: result });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async redeem(req, res) {
    try {
      const { itemId } = req.body;
      const userId = req.body.userId || req.headers["x-user-id"];

      if (!userId || !itemId) {
        return res.status(400).json({
          success: false,
          message: "userId and itemId are required",
        });
      }

      const result = await ShopService.redeemItem(userId, itemId);

      res.json({
        success: true,
        message: "Item redeemed successfully!",
        data: result,
      });
    } catch (err) {
      const clientErrors = ["Insufficient coins", "already purchased", "not found"];
      const isClientError = clientErrors.some(e => err.message.toLowerCase().includes(e));
      res.status(isClientError ? 400 : 500).json({
        success: false,
        message: err.message,
      });
    }
  },

  async getTransactions(req, res) {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 50 } = req.query;

      const result = await ShopService.getTransactions(userId, {
        page: Number(page),
        limit: Number(limit),
      });

      res.json({ success: true, data: result.transactions, pagination: result });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
};

module.exports = ShopController;