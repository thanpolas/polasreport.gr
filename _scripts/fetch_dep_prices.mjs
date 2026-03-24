#!/usr/bin/env node

/**
 * Fetch Greek refinery (ΔΕΠ) prices from the akosiaris/greek-oil-refinery-prices
 * GitHub repository and produce a clean dep_prices.csv aligned with our fuel types.
 *
 * Source: https://github.com/akosiaris/greek-oil-refinery-prices
 * Original data: oil.gge.gov.gr (General Secretariat of Commerce)
 *
 * Prices are stored as vatPrice in EUR/liter (including taxes + VAT),
 * directly comparable with retail pump prices.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = join(__dirname, "..", "_fuel-pdfs", "dep_prices.csv");

const GITHUB_CSV_URL =
  "https://raw.githubusercontent.com/akosiaris/greek-oil-refinery-prices/main/fuels.csv";

const HEADER =
  "date,dep_unleaded_95,dep_unleaded_100,dep_diesel,dep_heating_diesel,dep_autogas";

/**
 * Map source fuel names to our column names.
 * The source uses BIO suffix for newer entries and sometimes Greek Ε in DIESEL.
 */
function normalizeFuelName(raw) {
  // Normalize Greek characters to Latin for matching
  const s = raw.replace(/\u0395/g, "E").trim();
  if (/^UNLEADED\s+95/i.test(s)) return "dep_unleaded_95";
  if (/^UNLEADED\s+100/i.test(s)) return "dep_unleaded_100";
  if (/^DI.?SEL\s+AUTO/i.test(s)) return "dep_diesel";
  if (/^HEATING\s+GASOIL/i.test(s)) return "dep_heating_diesel";
  if (/^LPG\s+AUTO/i.test(s)) return "dep_autogas";
  return null;
}

/** Convert raw price to EUR/liter. Liquids are EUR/m3, LPG is EUR/metric-ton. */
function toEurPerLiter(value, col) {
  if (value == null || isNaN(value)) return null;
  // LPG AUTO is in EUR/metric-ton; 1 metric ton ≈ 1770 liters (derived from
  // published per-liter equivalents on popek.gr)
  if (col === "dep_autogas") return value / 1770;
  // All others are EUR/m3 → divide by 1000
  return value / 1000;
}

function parseNum(s) {
  if (!s || s === "NaN" || s === "") return NaN;
  return parseFloat(s);
}

/**
 * Parse the GitHub CSV. It's a quoted CSV with fields:
 * date,category,notes,fuel,elpePrice,motoroilPrice,unit,meanPrice,vatPrice
 */
function parseSourceCSV(text) {
  const lines = text.split("\n");
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle quoted fields (the "notes" column contains commas)
    const parts = [];
    let inQuote = false;
    let current = "";
    for (const ch of line) {
      if (ch === '"') {
        inQuote = !inQuote;
      } else if (ch === "," && !inQuote) {
        parts.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
    parts.push(current);

    if (parts.length < 9) continue;

    const [dateStr, , , fuel, , , , meanPriceStr, vatPriceStr] = parts;

    const col = normalizeFuelName(fuel);
    if (!col) continue;

    // Parse date: "2026-03-24T00:00:00.000Z" → "2026-03-24"
    const date = dateStr.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

    const meanPrice = parseNum(meanPriceStr);
    const vatPrice = parseNum(vatPriceStr);

    // Prefer vatPrice; fall back to meanPrice × 1.24
    let price = vatPrice;
    if (isNaN(price) && !isNaN(meanPrice)) {
      price = meanPrice * 1.24;
    }
    if (isNaN(price)) continue;

    const eurPerLiter = toEurPerLiter(price, col);
    if (eurPerLiter == null) continue;

    rows.push({ date, col, price: eurPerLiter });
  }

  return rows;
}

async function main() {
  console.log("Fetching ΔΕΠ refinery prices from GitHub...");

  const resp = await fetch(GITHUB_CSV_URL);
  if (!resp.ok) {
    console.error(`Failed to fetch: ${resp.status} ${resp.statusText}`);
    process.exit(1);
  }

  const text = await resp.text();
  const rows = parseSourceCSV(text);
  console.log(`  Parsed ${rows.length} relevant price entries from source.`);

  // Filter out future dates (source occasionally has bad data)
  const today = new Date().toISOString().slice(0, 10);

  // Group by date, taking the LAST entry per fuel per date (handles duplicates)
  const byDate = new Map();
  for (const { date, col, price } of rows) {
    if (date > today) continue; // skip future dates (bad source data)
    if (!byDate.has(date)) byDate.set(date, {});
    byDate.get(date)[col] = price;
  }

  // Build CSV rows sorted by date
  const cols = [
    "dep_unleaded_95",
    "dep_unleaded_100",
    "dep_diesel",
    "dep_heating_diesel",
    "dep_autogas",
  ];

  const csvRows = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, prices]) => {
      const vals = cols.map((c) => {
        const v = prices[c];
        return v != null ? (Math.round(v * 1000) / 1000).toString() : "";
      });
      return `${date},${vals.join(",")}`;
    });

  writeFileSync(CSV_PATH, HEADER + "\n" + csvRows.join("\n") + "\n");

  const totalDates = csvRows.length;
  const latest = csvRows[csvRows.length - 1];
  console.log(`  Wrote ${totalDates} dates to ${CSV_PATH}`);
  console.log(`  Latest: ${latest}`);
}

main();
