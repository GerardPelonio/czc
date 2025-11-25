const ShopService = require("../services/ShopService");

async function listItems(req, res) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await ShopService.listItems({ page: Number(page), limit: Number(limit) });
    return res.status(200).json({ success: true, data: result.items, pagination: result });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to list items" });
  }
}

async function redeem(req, res) {
  try {
    const { itemId } = req.body;
    const userId = req.body.userId || req.headers["x-user-id"];

    if (!userId || !itemId) {
      return res.status(400).json({ success: false, message: "userId and itemId are required" });
    }

    const result = await ShopService.redeemItem(userId, itemId);

    return res.status(200).json({ success: true, message: "Item redeemed successfully!", data: result });
  } catch (err) {
    const clientErrors = ["insufficient coins", "already purchased", "not found"];
    const isClientError = clientErrors.some(e => err.message.toLowerCase().includes(e));
    return res.status(isClientError ? 400 : 500).json({ success: false, message: err.message || "Failed to redeem item" });
  }
}

async function getTransactions(req, res) {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const result = await ShopService.getTransactions(userId, { page: Number(page), limit: Number(limit) });

    return res.status(200).json({ success: true, data: result.transactions, pagination: result });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch transactions" });
  }
}

module.exports = { listItems, redeem, getTransactions };
