"use strict";

const cds = require("@sap/cds");
const {
  calculateLine,
  calculateOrderTotal
} = require("./lib/order-calculator");

/**
 * CAP service implementation.
 *
 * Handler phases used here:
 * - before: validate or enrich the incoming request
 * - on: implement actions/functions or replace default processing
 * - after: enrich the response without changing persisted data
 */
module.exports = class LearningService extends cds.ApplicationService {
  async init() {
    const { Products, Customers, Orders } = this.entities;

    /** Validate product master data before generic CREATE/UPDATE persists it. */
    this.before(["CREATE", "UPDATE"], Products, (req) => {
      const { name, price, stock } = req.data;

      if (name !== undefined && !String(name).trim()) {
        req.reject(400, "Product name is required");
      }
      if (price !== undefined && Number(price) <= 0) {
        req.reject(400, "Product price must be greater than zero");
      }
      if (stock !== undefined && (!Number.isInteger(Number(stock)) || Number(stock) < 0)) {
        req.reject(400, "Stock must be a non-negative integer");
      }
    });

    /** Normalize and validate customer e-mail before it reaches the database. */
    this.before(["CREATE", "UPDATE"], Customers, (req) => {
      if (req.data.email === undefined) return;

      const email = String(req.data.email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        req.reject(400, "A valid customer e-mail address is required");
      }
      req.data.email = email;
    });

    /**
     * Prepare a deep Order create.
     *
     * Important security rule: the browser sends product IDs and quantities,
     * but the backend reads the authoritative price from Products.
     */
    this.before("CREATE", Orders, async (req) => {
      const items = req.data.items;
      if (!Array.isArray(items) || items.length === 0) {
        req.reject(400, "An order must contain at least one item");
      }

      const productIDs = [...new Set(items.map((item) => item.product_ID).filter(Boolean))];
      if (productIDs.length !== items.length) {
        req.reject(400, "Every order item needs a product_ID");
      }

      const rows = await cds.tx(req).run(
        SELECT.from(Products)
          .columns("ID", "price", "active")
          .where({ ID: { in: productIDs } })
      );
      const byID = new Map(rows.map((row) => [row.ID, row]));

      const calculatedItems = items.map((item) => {
        const product = byID.get(item.product_ID);
        if (!product) req.reject(400, `Unknown product: ${item.product_ID}`);
        if (!product.active) req.reject(400, `Inactive product: ${item.product_ID}`);

        const calculated = calculateLine(item.quantity, product.price);
        return {
          ...item,
          ...calculated
        };
      });

      req.data.items = calculatedItems;
      req.data.totalAmount = calculateOrderTotal(calculatedItems);
      req.data.status = "DRAFT";
    });

    /**
     * Response-only enrichment. This does not update the database.
     * It demonstrates how an after hook can add a transient convenience field.
     */
    this.after("READ", Products, (data) => {
      const products = Array.isArray(data) ? data : [data];
      for (const product of products) {
        if (product) product.stockStatus = product.stock < 10 ? "LOW" : "OK";
      }
    });

    /** Read-only function implemented with an on handler. */
    this.on("lowStock", async (req) => {
      const threshold = Number(req.data.threshold ?? 10);
      if (!Number.isInteger(threshold) || threshold < 0) {
        req.reject(400, "Threshold must be a non-negative integer");
      }

      return cds.tx(req).run(
        SELECT.from(Products).where`stock < ${threshold} and active = true`
      );
    });

    /**
     * State-changing action. Both the read and update use the same request
     * transaction, so an error rolls back the business operation as one unit.
     */
    this.on("restock", async (req) => {
      const { productID } = req.data;
      const quantity = Number(req.data.quantity);

      if (!productID) req.reject(400, "productID is required");
      if (!Number.isInteger(quantity) || quantity <= 0) {
        req.reject(400, "Restock quantity must be a positive integer");
      }

      const tx = cds.tx(req);
      const product = await tx.run(SELECT.one.from(Products).where({ ID: productID }));
      if (!product) req.reject(404, "Product not found");

      await tx.run(
        UPDATE(Products)
          .set({ stock: Number(product.stock) + quantity })
          .where({ ID: productID })
      );

      return tx.run(SELECT.one.from(Products).where({ ID: productID }));
    });

    /** Bound action for one order instance. */
    this.on("submit", Orders, async (req) => {
      const orderID = req.params?.[0]?.ID;
      if (!orderID) req.reject(400, "Order key is missing");

      const tx = cds.tx(req);
      const order = await tx.run(SELECT.one.from(Orders).where({ ID: orderID }));
      if (!order) req.reject(404, "Order not found");
      if (order.status !== "DRAFT") {
        req.reject(409, `Only DRAFT orders can be submitted; current status is ${order.status}`);
      }

      await tx.run(UPDATE(Orders).set({ status: "SUBMITTED" }).where({ ID: orderID }));
      const submitted = await tx.run(SELECT.one.from(Orders).where({ ID: orderID }));

      await this.emit("OrderSubmitted", {
        orderID,
        totalAmount: submitted.totalAmount
      });

      return submitted;
    });

    return super.init();
  }
};
