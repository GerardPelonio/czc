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

/**
 * Initialize shop items in Firestore from JSON data
 * Admin/Internal endpoint (protected - requires valid context)
 */
async function initShopItems(req, res) {
  try {
    // For now, we'll require the admin key from header or allow during development
    const adminKey = process.env.ADMIN_KEY;
    const providedKey = req.headers['x-admin-key'];
    
    // Allow if:
    // 1. Admin key matches environment variable, OR
    // 2. In development mode with explicit flag
    const isAuthorized = (adminKey && providedKey === adminKey) || 
                        (process.env.NODE_ENV === 'development' && req.headers['x-init-shop'] === 'true');
    
    if (!isAuthorized && adminKey && process.env.NODE_ENV !== 'development') {
      console.warn("Unauthorized init attempt with key:", providedKey?.substring(0, 5) + '...');
      return errorResponse(res, "Unauthorized - Valid admin key required", 401);
    }

    const db = getDb();
    if (!db) {
      return errorResponse(res, "Service temporarily unavailable - Database not initialized", 503);
    }

    const shopItemsData = require("../data/shopItems.json");
    const shopCollection = db.collection('shopItems');
    
    let imported = 0;
    let updated = 0;

    // Batch write for better performance
    const batch = db.batch();
    
    for (const item of shopItemsData) {
      const docRef = shopCollection.doc(item.id);
      batch.set(docRef, item, { merge: true });
    }
    
    await batch.commit();
    imported = shopItemsData.length;

    console.log(`Shop items initialized successfully: ${imported} items`);
    
    return res.status(200).json({
      success: true,
      message: "Shop items initialized successfully in Firestore",
      stats: {
        itemsProcessed: imported,
        items: shopItemsData.map(item => ({ id: item.id, name: item.name }))
      }
    });
  } catch (err) {
    console.error("Error initializing shop items:", err.message);
    return errorResponse(res, err.message || "Failed to initialize shop items", 500);
  }
}

module.exports = { listItems, redeem, getTransactions, initShopItems };