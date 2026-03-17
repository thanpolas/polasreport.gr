#!/usr/bin/env node

/**
 * Fetch daily Brent crude oil prices and save to CSV.
 *
 * Primary source: FRED (EIA spot price) — authoritative but ~1 week lag.
 * Fallback: Yahoo Finance (BZ=F futures) — near-realtime, fills the gap.
 * When FRED catches up, its data overwrites Yahoo's for the same dates.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = join(__dirname, "..", "_fuel-pdfs", "brent_prices.csv");

const HEADER = "date,price,source";
const FRED_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv";
const YAHOO_URL = "https://query1.finance.yahoo.com/v8/finance/chart/BZ=F";

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function loadExisting() {
  if (!existsSync(CSV_PATH)) return new Map();
  const lines = readFileSync(CSV_PATH, "utf-8").trim().split("\n").slice(1);
  const map = new Map();
  for (const line of lines) {
    const [date, price, source] = line.split(",");
    map.set(date, { price, source: source || "fred" });
  }
  return map;
}

async function fetchFromFRED(startDate, endDate) {
  const url = `${FRED_URL}?id=DCOILBRENTEU&cosd=${startDate}&coed=${endDate}`;
  let resp;
  try {
    resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
  } catch (err) {
    console.warn(`FRED fetch failed (${err.cause?.code || err.message}), skipping.`);
    return [];
  }
  if (!resp.ok) {
    console.warn(`FRED returned ${resp.status}, skipping.`);
    return [];
  }

  const text = await resp.text();
  const rows = [];

  for (const line of text.trim().split("\n").slice(1)) {
    const [date, price] = line.split(",");
    if (!price || price === ".") continue;
    if (date < startDate) continue;
    rows.push({ date, price, source: "fred" });
  }

  return rows;
}

async function fetchFromYahoo(startDate) {
  // Fetch ~45 days to cover any gap
  const url = `${YAHOO_URL}?interval=1d&range=45d`;
  const resp = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!resp.ok) {
    console.warn(`Yahoo returned ${resp.status}, skipping.`);
    return [];
  }

  const data = await resp.json();
  const result = data?.chart?.result?.[0];
  if (!result) return [];

  const timestamps = result.timestamp;
  const closes = result.indicators.quote[0].close;
  const rows = [];

  for (let i = 0; i < timestamps.length; i++) {
    const date = new Date(timestamps[i] * 1000).toISOString().slice(0, 10);
    const price = closes[i];
    if (date < startDate || price == null) continue;
    rows.push({ date, price: price.toFixed(2), source: "yahoo" });
  }

  return rows;
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const byDate = loadExisting();
  const hadRows = byDate.size;

  // Find the last FRED date to know where the gap starts
  let lastFredDate = null;
  for (const [date, { source }] of byDate) {
    if (source === "fred" && (!lastFredDate || date > lastFredDate)) {
      lastFredDate = date;
    }
  }

  const startDate = lastFredDate ? addDays(lastFredDate, 1) : "2023-01-01";
  const isIncremental = hadRows > 0;

  console.log(
    isIncremental
      ? `Fetching from ${startDate} to ${today} (incremental)...`
      : `Fetching from 2023-01-01 to ${today} (full)...`,
  );

  // 1. Fetch from FRED (primary, overwrites yahoo)
  const fredRows = await fetchFromFRED(
    isIncremental ? startDate : "2023-01-01",
    today,
  );
  let fredNew = 0;
  for (const row of fredRows) {
    byDate.set(row.date, { price: row.price, source: "fred" });
    fredNew++;
  }
  console.log(`  FRED: ${fredNew} rows`);

  // 2. Fetch from Yahoo (fallback, only fills dates FRED doesn't have)
  // Determine where FRED coverage ends now
  let latestFred = lastFredDate;
  for (const row of fredRows) {
    if (!latestFred || row.date > latestFred) latestFred = row.date;
  }

  const yahooStart = latestFred ? addDays(latestFred, 1) : startDate;
  const yahooRows = await fetchFromYahoo(yahooStart);
  let yahooNew = 0;
  for (const row of yahooRows) {
    // Only add if FRED doesn't already have this date
    if (!byDate.has(row.date) || byDate.get(row.date).source === "yahoo") {
      byDate.set(row.date, { price: row.price, source: "yahoo" });
      yahooNew++;
    }
  }
  console.log(`  Yahoo (gap fill): ${yahooNew} rows`);

  // Write CSV
  const allRows = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { price, source }]) => `${date},${price},${source}`);

  writeFileSync(CSV_PATH, HEADER + "\n" + allRows.join("\n") + "\n");

  const totalNew = allRows.length - hadRows;
  console.log(`Done: ${totalNew} new rows. Total: ${allRows.length} rows.`);
}

main();
