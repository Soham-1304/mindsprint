"use strict";

/**
 * Benign-looking public API surface for @sietch-demo/currency-format-lite.
 * Used during Sietch's `load` phase (`require()`) after `postinstall`.
 */

function roundCents(amount) {
  const num = Number(amount);
  if (!Number.isFinite(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

function formatCurrency(amount, currency = "USD", locale = "en-US") {
  const rounded = roundCents(amount);
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(rounded);
  } catch {
    return `$${rounded.toFixed(2)}`;
  }
}

module.exports = {
  formatCurrency,
  roundCents,
};
