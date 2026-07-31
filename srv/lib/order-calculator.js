"use strict";

/**
 * Calculate one order line using trusted backend price data.
 *
 * Keeping this function pure makes it easy to unit test: it has no database,
 * network, or CAP runtime dependency.
 */
function calculateLine(quantity, unitPrice) {
  const normalizedQuantity = Number(quantity);
  const normalizedPrice = Number(unitPrice);

  if (!Number.isInteger(normalizedQuantity) || normalizedQuantity <= 0) {
    throw new TypeError("Quantity must be a positive integer");
  }

  if (!Number.isFinite(normalizedPrice) || normalizedPrice <= 0) {
    throw new TypeError("Unit price must be a positive number");
  }

  // CAP Decimal values may arrive as strings. Number() normalizes them here.
  const lineTotal = normalizedQuantity * normalizedPrice;

  return {
    quantity: normalizedQuantity,
    unitPrice: normalizedPrice,
    lineTotal
  };
}

/** Sum all calculated line totals into the order header total. */
function calculateOrderTotal(lines) {
  if (!Array.isArray(lines)) {
    throw new TypeError("Lines must be an array");
  }

  return lines.reduce((total, line) => total + Number(line.lineTotal || 0), 0);
}

module.exports = {
  calculateLine,
  calculateOrderTotal
};
