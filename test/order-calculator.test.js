"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  calculateLine,
  calculateOrderTotal
} = require("../srv/lib/order-calculator");

test("calculateLine multiplies quantity and price", () => {
  assert.deepEqual(calculateLine(2, "125.50"), {
    quantity: 2,
    unitPrice: 125.5,
    lineTotal: 251
  });
});

test("calculateLine rejects invalid quantity", () => {
  assert.throws(() => calculateLine(0, 100), /Quantity/);
});

test("calculateOrderTotal sums line totals", () => {
  assert.equal(
    calculateOrderTotal([{ lineTotal: 100 }, { lineTotal: 250 }]),
    350
  );
});
