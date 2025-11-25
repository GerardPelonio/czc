// routes/shop.js

const express = require("express");
const router = express.Router();
const ShopController = require("../controllers/ShopController");

router.get("/", ShopController.listItems);

router.post("/redeem", ShopController.redeem);

router.get("/transactions/:userId", ShopController.getTransactions);

module.exports = router;