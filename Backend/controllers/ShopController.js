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
 * Admin/Internal endpoint (protected by admin key)
 */
async function initShopItems(req, res) {
  try {
    // Security: Check for admin key in environment
    const adminKey = process.env.ADMIN_KEY;
    const providedKey = req.headers['x-admin-key'];
    
    if (!adminKey || providedKey !== adminKey) {
      return errorResponse(res, "Unauthorized - Admin key required", 401);
    }

    const db = getDb();
    if (!db) {
      return errorResponse(res, "Service temporarily unavailable", 503);
    }

    const shopItemsData = require("../data/shopItems.json");
    const shopCollection = db.collection('shopItems');
    
    let imported = 0;
    let updated = 0;

    for (const item of shopItemsData) {
      const docRef = shopCollection.doc(item.id);
      const docSnapshot = await docRef.get();
      
      if (docSnapshot.exists) {
        await docRef.update(item);
        updated++;
      } else {
        await docRef.set(item);
        imported++;
      }
    }

    console.log(`Shop items initialized: ${imported} imported, ${updated} updated`);
    
    return res.status(200).json({
      success: true,
      message: "Shop items initialized successfully",
      stats: {
        imported,
        updated,
        total: imported + updated
      }
    });
  } catch (err) {
    console.error("Error initializing shop items:", err.message);
    return errorResponse(res, err.message || "Failed to initialize shop items", 500);
  }
}

module.exports = { listItems, redeem, getTransactions, initShopItems };