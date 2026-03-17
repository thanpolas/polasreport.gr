/** Number and date formatting utilities (Greek locale). */

const MONTHS_EL = [
  "Ιαν", "Φεβ", "Μαρ", "Απρ", "Μαϊ", "Ιουν",
  "Ιουλ", "Αυγ", "Σεπ", "Οκτ", "Νοε", "Δεκ",
];

/**
 * Format a unix timestamp (seconds) as "16 Μαρ 2026".
 * @param {number} ts - unix timestamp in seconds
 * @returns {string}
 */
export function fmtDate(ts) {
  const d = new Date(ts * 1000);
  return `${d.getUTCDate()} ${MONTHS_EL[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * Format EUR price: "1,924" (Greek decimal comma).
 * @param {number} val
 * @param {number} decimals
 * @returns {string}
 */
export function fmtEUR(val, decimals = 3) {
  if (val == null) return "—";
  return val.toFixed(decimals).replace(".", ",");
}

/**
 * Format USD price: "$94.35".
 * @param {number} val
 * @returns {string}
 */
export function fmtUSD(val) {
  if (val == null) return "—";
  return `$${val.toFixed(2)}`;
}

/**
 * Format percentage change: "+1.23%" or "−0.45%".
 * Uses proper minus sign (−) not hyphen (-).
 * @param {number} val
 * @returns {string}
 */
export function fmtPct(val) {
  if (val == null) return "—";
  const sign = val > 0 ? "+" : val < 0 ? "\u2212" : "";
  return `${sign}${Math.abs(val).toFixed(2)}%`;
}

/**
 * Format a full Greek date: "16 Μαρτίου 2026".
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {string}
 */
const MONTHS_EL_FULL = [
  "Ιανουαρίου", "Φεβρουαρίου", "Μαρτίου", "Απριλίου", "Μαΐου", "Ιουνίου",
  "Ιουλίου", "Αυγούστου", "Σεπτεμβρίου", "Οκτωβρίου", "Νοεμβρίου", "Δεκεμβρίου",
];

export function fmtDateFull(dateStr) {
  const [y, m, d] = dateStr.split("-");
  return `${parseInt(d)} ${MONTHS_EL_FULL[parseInt(m) - 1]} ${y}`;
}
