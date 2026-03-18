#!/usr/bin/env node

/**
 * Fetch daily EUR/USD exchange rates and save to CSV.
 *
 * Primary source: FRED (DEXUSEU series) — authoritative but ~1 week lag.
 * Fallback: Frankfurter API (ECB data) — near-realtime, fills the gap.
 * When FRED catches up, its data overwrites Frankfurter's for the same dates.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = join(__dirname, "..", "_fuel-pdfs", "eurusd_prices.csv");

const HEADER = "date,rate,source";
const FRED_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv";
const FRANKFURTER_URL = "https://api.frankfurter.dev/v1";

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
    const [date, rate, source] = line.split(",");
    map.set(date, { rate, source: source || "fred" });
  }
  return map;
}

async function fetchFromFRED(startDate, endDate) {
  const url = `${FRED_URL}?id=DEXUSEU&cosd=${startDate}&coed=${endDate}`;
  let resp;
  try {
    resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
  } catch (err) {
    console.warn(
      `FRED fetch failed (${err.cause?.code || err.message}), skipping.`,
    );
    return [];
  }
  if (!resp.ok) {
    console.warn(`FRED returned ${resp.status}, skipping.`);
    return [];
  }

  const text = await resp.text();
  const rows = [];

  for (const line of text.trim().split("\n").slice(1)) {
    const [date, rate] = line.split(",");
    if (!rate || rate === ".") continue;
    if (date < startDate) continue;
    rows.push({ date, rate, source: "fred" });
  }

  return rows;
}

async function fetchFromFrankfurter(startDate, endDate) {
  const url = `${FRANKFURTER_URL}/${startDate}..${endDate}?base=EUR&symbols=USD`;
  let resp;
  try {
    resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
  } catch (err) {
    console.warn(
      `Frankfurter fetch failed (${err.cause?.code || err.message}), skipping.`,
    );
    return [];
  }
  if (!resp.ok) {
    console.warn(`Frankfurter returned ${resp.status}, skipping.`);
    return [];
  }

  const data = await resp.json();
  const rates = data?.rates;
  if (!rates) return [];

  const rows = [];
  for (const [date, values] of Object.entries(rates)) {
    if (date < startDate || !values?.USD) continue;
    rows.push({ date, rate: values.USD.toFixed(4), source: "frankfurter" });
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

  // 1. Fetch from FRED (primary, overwrites frankfurter)
  const fredRows = await fetchFromFRED(
    isIncremental ? startDate : "2023-01-01",
    today,
  );
  let fredNew = 0;
  for (const row of fredRows) {
    byDate.set(row.date, { rate: row.rate, source: "fred" });
    fredNew++;
  }
  console.log(`  FRED: ${fredNew} rows`);

  // 2. Fetch from Frankfurter (fallback, only fills dates FRED doesn't have)
  let latestFred = lastFredDate;
  for (const row of fredRows) {
    if (!latestFred || row.date > latestFred) latestFred = row.date;
  }

  const fallbackStart = latestFred ? addDays(latestFred, 1) : startDate;
  const frankfurterRows = await fetchFromFrankfurter(fallbackStart, today);
  let frankfurterNew = 0;
  for (const row of frankfurterRows) {
    if (
      !byDate.has(row.date) ||
      byDate.get(row.date).source === "frankfurter"
    ) {
      byDate.set(row.date, { rate: row.rate, source: "frankfurter" });
      frankfurterNew++;
    }
  }
  console.log(`  Frankfurter (gap fill): ${frankfurterNew} rows`);

  // Write CSV
  const allRows = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { rate, source }]) => `${date},${rate},${source}`);

  writeFileSync(CSV_PATH, HEADER + "\n" + allRows.join("\n") + "\n");

  const totalNew = allRows.length - hadRows;
  console.log(`Done: ${totalNew} new rows. Total: ${allRows.length} rows.`);
}

main();
