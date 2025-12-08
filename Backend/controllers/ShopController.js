const ShopService = require("../services/ShopService");
const { getDb } = require("../utils/getDb");

const errorResponse = (res, message, status = 400) => {
  return res.status(status).json({ success: false, message });
};

async function listItems(req, res) {
  const userId = req.user?.id;
  const { page = 1, limit = 20 } = req.query;

  // userId is optional - can browse without auth, but recommended
  
  try {
    const db = getDb();
    if (!db) {
      return errorResponse(res, "Service temporarily unavailable", 503);
    }

    const result = await ShopService.listItems(db, { page: Number(page), limit: Number(limit) });
    
    // Destructure to separate items from pagination metadata
    const { items, ...paginationMetadata } = result;

    return res.status(200).json({ 
      success: true, 
      data: items, 
      pagination: paginationMetadata 
    });
  } catch (err) {
    console.error("Error in listItems:", err.message);
    return errorResponse(res, err.message || "Failed to list items", 500);
  }
}

async function redeem(req, res) {
  const userId = req.user?.id;
  const { itemId } = req.body;

  if (!userId) {
    return errorResponse(res, "Authentication required to purchase items", 401);
  }

  if (!itemId) {
    return errorResponse(res, "Item ID is required", 400);
  }

  try {
    const db = getDb();
    if (!db) {
      return errorResponse(res, "Service temporarily unavailable", 503);
    }

    const result = await ShopService.redeemItem(db, userId, itemId);

    return res.status(200).json({ 
      success: true, 
      message: `Successfully purchased item! Coins remaining: ${result.coinsRemaining}`,
      data: result 
    });
  } catch (err) {
    console.error("Error in redeem:", err.message);
    
    let status = 500;
    if (err.message.includes("Insufficient") || err.message.includes("already")) {
      status = 400;
    } else if (err.message.includes("not found")) {
      status = 404;
    } else if (err.message.includes("Authentication")) {
      status = 401;
    }
    
    return errorResponse(res, err.message || "Failed to redeem item", status);
  }
}

async function getTransactions(req, res) {
  const userId = req.user?.id;
  const { page = 1, limit = 50 } = req.query;

  if (!userId) {
    return errorResponse(res, "Authentication required", 401);
  }

  try {
    const db = getDb();
    if (!db) {
      return errorResponse(res, "Service temporarily unavailable", 503);
    }

    const result = await ShopService.getTransactions(db, userId, { 
      page: Number(page), 
      limit: Number(limit) 
    });
    
    // Destructure to separate transactions from pagination metadata
    const { transactions, ...paginationMetadata } = result;

    return res.status(200).json({ 
      success: true, 
      data: transactions, 
      pagination: paginationMetadata 
    });
  } catch (err) {
    console.error("Error in getTransactions:", err.message);
    return errorResponse(res, err.message || "Failed to fetch transactions", 500);
  }
}

module.exports = { listItems, redeem, getTransactions };