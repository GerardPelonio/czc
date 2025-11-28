const ShopService = require("../services/ShopService");

async function listItems(req, res) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await ShopService.listItems({ page: Number(page), limit: Number(limit) });
    
    // FIX 1: Destructure to remove the 'items' array from the pagination metadata
    const { items, ...paginationMetadata } = result;

    return res.status(200).json({ success: true, data: items, pagination: paginationMetadata });
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
    // Note: The service layer should throw an error with the exact message 
    // for this array check to work correctly.
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
    
    // FIX 2: Destructure to remove the 'transactions' array from the pagination metadata
    const { transactions, ...paginationMetadata } = result;

    return res.status(200).json({ success: true, data: transactions, pagination: paginationMetadata });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch transactions" });
  }
}

module.exports = { listItems, redeem, getTransactions };