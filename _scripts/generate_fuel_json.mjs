#!/usr/bin/env node

/**
 * Merge fuel prices and Brent crude CSVs into a single JSON file
 * optimized for the /fuel frontend page.
 *
 * Also copies CSVs to assets/data/ for public download.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "_fuel-pdfs");
const OUT_DIR = join(__dirname, "..", "assets", "data");

const FUEL_CSV = join(DATA_DIR, "fuel_prices.csv");
const BRENT_CSV = join(DATA_DIR, "brent_prices.csv");
const OUT_JSON = join(OUT_DIR, "fuel-chart.json");

function parseCSV(path) {
  const lines = readFileSync(path, "utf-8").trim().split("\n");
  const header = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const vals = line.split(",");
    const row = {};
    header.forEach((col, i) => (row[col] = vals[i]));
    return row;
  });
}

function toTimestamp(dateStr) {
  return Math.floor(new Date(dateStr + "T00:00:00Z").getTime() / 1000);
}

function pctChange(prev, curr) {
  if (prev == null || curr == null || prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}

function avg(arr) {
  const valid = arr.filter((v) => v != null);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function round(val, decimals = 3) {
  if (val == null) return null;
  return Math.round(val * 10 ** decimals) / 10 ** decimals;
}

function main() {
  if (!existsSync(FUEL_CSV) || !existsSync(BRENT_CSV)) {
    console.error("Missing CSV files. Run fuel:extract and fuel:brent first.");
    process.exit(1);
  }

  const fuelRows = parseCSV(FUEL_CSV);
  const brentRows = parseCSV(BRENT_CSV);

  // Index Brent by date
  const brentByDate = new Map();
  brentRows.forEach((r) => brentByDate.set(r.date, parseFloat(r.price)));

  // Build aligned arrays — only dates that exist in fuel data
  const timestamps = [];
  const unleaded95 = [];
  const unleaded100 = [];
  const diesel = [];
  const autogas = [];
  const heatingDiesel = [];
  const brent = [];

  for (const row of fuelRows) {
    const date = row.date;
    const u95 = row.unleaded_95 ? parseFloat(row.unleaded_95) : null;
    const u100 = row.unleaded_100 ? parseFloat(row.unleaded_100) : null;
    const d = row.diesel ? parseFloat(row.diesel) : null;
    const ag = row.autogas ? parseFloat(row.autogas) : null;
    const hd = row.heating_diesel ? parseFloat(row.heating_diesel) : null;

    // Find closest Brent price (same day or most recent prior weekday)
    let brentPrice = brentByDate.get(date) ?? null;
    if (brentPrice == null) {
      // Look back up to 10 days for weekends/holidays/FRED lag
      const dt = new Date(date);
      for (let i = 1; i <= 10; i++) {
        dt.setDate(dt.getDate() - 1);
        const prev = dt.toISOString().slice(0, 10);
        if (brentByDate.has(prev)) {
          brentPrice = brentByDate.get(prev);
          break;
        }
      }
    }

    timestamps.push(toTimestamp(date));
    unleaded95.push(u95);
    unleaded100.push(u100);
    diesel.push(d);
    autogas.push(ag);
    heatingDiesel.push(hd);
    brent.push(brentPrice);
  }

  // Compute daily % changes
  const pctU95 = unleaded95.map((v, i) =>
    i === 0 ? null : round(pctChange(unleaded95[i - 1], v)),
  );
  const pctBrent = brent.map((v, i) =>
    i === 0 ? null : round(pctChange(brent[i - 1], v)),
  );

  // Compute cumulative spread (pump % change − crude % change)
  const cumulativeSpread = [];
  let running = 0;
  for (let i = 0; i < pctU95.length; i++) {
    if (pctU95[i] != null && pctBrent[i] != null) {
      running += pctU95[i] - pctBrent[i];
    }
    cumulativeSpread.push(round(running));
  }

  // Compute 365-day rolling averages for the latest date
  const len = unleaded95.length;
  const window = Math.min(365, len);
  const tail = (arr) => arr.slice(len - window);

  const latest = {
    date: fuelRows[len - 1].date,
    unleaded_95: unleaded95[len - 1],
    unleaded_100: unleaded100[len - 1],
    diesel: diesel[len - 1],
    autogas: autogas[len - 1],
    heating_diesel: heatingDiesel[len - 1],
    brent: brent[len - 1],
    avg_365: {
      unleaded_95: round(avg(tail(unleaded95))),
      unleaded_100: round(avg(tail(unleaded100))),
      diesel: round(avg(tail(diesel))),
      autogas: round(avg(tail(autogas))),
      heating_diesel: round(avg(tail(heatingDiesel))),
      brent: round(avg(tail(brent))),
    },
  };

  const output = {
    updated: new Date().toISOString().slice(0, 10),
    latest,
    series: {
      timestamps,
      unleaded_95: unleaded95.map((v) => round(v)),
      unleaded_100: unleaded100.map((v) => round(v)),
      diesel: diesel.map((v) => round(v)),
      autogas: autogas.map((v) => round(v)),
      heating_diesel: heatingDiesel.map((v) => round(v)),
      brent: brent.map((v) => round(v)),
      pct_unleaded_95: pctU95,
      pct_brent: pctBrent,
      cumulative_spread: cumulativeSpread,
    },
  };

  // Write JSON
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_JSON, JSON.stringify(output));

  // Copy CSVs for public download
  copyFileSync(FUEL_CSV, join(OUT_DIR, "fuel_prices.csv"));
  copyFileSync(BRENT_CSV, join(OUT_DIR, "brent_prices.csv"));

  const jsonSize = (readFileSync(OUT_JSON).length / 1024).toFixed(1);
  console.log(`Generated ${OUT_JSON} (${jsonSize} KB)`);
  console.log(`  ${len} data points, latest: ${latest.date}`);
  console.log(`  Unleaded 95: €${latest.unleaded_95} (avg365: €${latest.avg_365.unleaded_95})`);
  console.log(`  Brent: $${latest.brent} (avg365: $${latest.avg_365.brent})`);
  console.log(`Copied CSVs to ${OUT_DIR}/`);
}

main();
