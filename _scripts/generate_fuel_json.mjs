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
const EURUSD_CSV = join(DATA_DIR, "eurusd_prices.csv");
const BRENT_EUR_CSV = join(DATA_DIR, "brent_eur_prices.csv");
const EU_CSV = join(DATA_DIR, "eu_prices.csv");
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

  // Sanitize fuel data: null out outliers where a value deviates >20% from
  // both neighbors. These are typically column-swap errors in the source PDFs.
  const fuelCols = ["unleaded_95", "unleaded_100", "diesel", "autogas", "heating_diesel"];
  let sanitized = 0;
  for (const col of fuelCols) {
    for (let i = 1; i < fuelRows.length - 1; i++) {
      const prev = fuelRows[i - 1][col] ? parseFloat(fuelRows[i - 1][col]) : null;
      const curr = fuelRows[i][col] ? parseFloat(fuelRows[i][col]) : null;
      const next = fuelRows[i + 1][col] ? parseFloat(fuelRows[i + 1][col]) : null;
      if (prev == null || curr == null || next == null) continue;
      const avgNeighbors = (prev + next) / 2;
      const pctDiff = Math.abs((curr - avgNeighbors) / avgNeighbors) * 100;
      if (pctDiff > 20) {
        fuelRows[i][col] = "";
        sanitized++;
      }
    }
  }
  if (sanitized > 0) {
    console.log(`  Sanitized ${sanitized} outlier value(s) in fuel data.`);
  }

  // Index Brent by date
  const brentByDate = new Map();
  brentRows.forEach((r) => brentByDate.set(r.date, parseFloat(r.price)));

  // Index EUR/USD by date (optional — pipeline works without it)
  const eurUsdByDate = new Map();
  if (existsSync(EURUSD_CSV)) {
    const eurUsdRows = parseCSV(EURUSD_CSV);
    eurUsdRows.forEach((r) => eurUsdByDate.set(r.date, parseFloat(r.rate)));
  } else {
    console.warn("No eurusd_prices.csv found — skipping EUR/USD normalization.");
  }

  // Load persisted brent_eur conversions
  const brentEurByDate = new Map();
  if (existsSync(BRENT_EUR_CSV)) {
    const brentEurRows = parseCSV(BRENT_EUR_CSV);
    brentEurRows.forEach((r) =>
      brentEurByDate.set(r.date, {
        brent_usd: parseFloat(r.brent_usd),
        eur_usd: parseFloat(r.eur_usd),
        brent_eur: parseFloat(r.brent_eur),
      }),
    );
  }

  // Build aligned arrays — only dates that exist in fuel data
  const timestamps = [];
  const unleaded95 = [];
  const unleaded100 = [];
  const diesel = [];
  const autogas = [];
  const heatingDiesel = [];
  const brent = [];
  const eurUsd = [];
  const brentEur = [];

  // Track new brent_eur conversions to persist
  let brentEurNewRows = 0;

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

    // Find EUR/USD rate (same carry-forward logic)
    let eurUsdRate = eurUsdByDate.get(date) ?? null;
    if (eurUsdRate == null && eurUsdByDate.size > 0) {
      const dt = new Date(date);
      for (let i = 1; i <= 10; i++) {
        dt.setDate(dt.getDate() - 1);
        const prev = dt.toISOString().slice(0, 10);
        if (eurUsdByDate.has(prev)) {
          eurUsdRate = eurUsdByDate.get(prev);
          break;
        }
      }
    }

    // Use persisted brent_eur if available; otherwise compute and store
    let brentEurPrice = null;
    const cached = brentEurByDate.get(date);
    if (cached && cached.brent_usd === brentPrice && cached.eur_usd === eurUsdRate) {
      brentEurPrice = cached.brent_eur;
    } else if (brentPrice != null && eurUsdRate != null) {
      brentEurPrice = brentPrice / eurUsdRate;
      brentEurByDate.set(date, {
        brent_usd: brentPrice,
        eur_usd: eurUsdRate,
        brent_eur: brentEurPrice,
      });
      brentEurNewRows++;
    }

    timestamps.push(toTimestamp(date));
    unleaded95.push(u95);
    unleaded100.push(u100);
    diesel.push(d);
    autogas.push(ag);
    heatingDiesel.push(hd);
    brent.push(brentPrice);
    eurUsd.push(eurUsdRate);
    brentEur.push(brentEurPrice);
  }

  // Persist brent_eur conversions CSV
  if (brentEurNewRows > 0 || !existsSync(BRENT_EUR_CSV)) {
    const brentEurCsvRows = [...brentEurByDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([date, { brent_usd, eur_usd, brent_eur }]) =>
          `${date},${round(brent_usd)},${round(eur_usd, 4)},${round(brent_eur)}`,
      );
    writeFileSync(
      BRENT_EUR_CSV,
      "date,brent_usd,eur_usd,brent_eur\n" + brentEurCsvRows.join("\n") + "\n",
    );
    console.log(`  Persisted ${brentEurNewRows} new brent_eur conversions (${brentEurByDate.size} total).`);
  }

  // Compute daily % changes
  const pctU95 = unleaded95.map((v, i) =>
    i === 0 ? null : round(pctChange(unleaded95[i - 1], v)),
  );
  const pctBrent = brent.map((v, i) =>
    i === 0 ? null : round(pctChange(brent[i - 1], v)),
  );
  const pctBrentEur = brentEur.map((v, i) =>
    i === 0 ? null : round(pctChange(brentEur[i - 1], v)),
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
    eur_usd: eurUsd[len - 1],
    brent_eur: round(brentEur[len - 1]),
    avg_365: {
      unleaded_95: round(avg(tail(unleaded95))),
      unleaded_100: round(avg(tail(unleaded100))),
      diesel: round(avg(tail(diesel))),
      autogas: round(avg(tail(autogas))),
      heating_diesel: round(avg(tail(heatingDiesel))),
      brent: round(avg(tail(brent))),
      eur_usd: round(avg(tail(eurUsd)), 4),
      brent_eur: round(avg(tail(brentEur))),
    },
  };

  // Build EU comparison data (optional)
  let euComparison = null;
  if (existsSync(EU_CSV)) {
    const euRows = parseCSV(EU_CSV);
    const euCols = ["eu_euro95", "eu_diesel", "gr_euro95", "gr_diesel", "it_euro95", "it_diesel", "bg_euro95", "bg_diesel", "ro_euro95", "ro_diesel"];
    const euTimestamps = [];
    const euSeries = {};
    for (const col of euCols) euSeries[col] = [];

    for (const row of euRows) {
      if (!row.date) continue;
      euTimestamps.push(toTimestamp(row.date));
      for (const col of euCols) {
        const val = row[col] ? parseFloat(row[col]) : null;
        euSeries[col].push(val != null && !isNaN(val) ? round(val) : null);
      }
    }

    euComparison = {
      resolution: "weekly",
      countries: ["EU", "GR", "IT", "BG", "RO"],
      country_labels: {
        EU: "\u039c.\u039f. \u0395\u0395",
        GR: "\u0395\u03bb\u03bb\u03ac\u03b4\u03b1",
        IT: "\u0399\u03c4\u03b1\u03bb\u03af\u03b1",
        BG: "\u0392\u03bf\u03c5\u03bb\u03b3\u03b1\u03c1\u03af\u03b1",
        RO: "\u03a1\u03bf\u03c5\u03bc\u03b1\u03bd\u03af\u03b1",
      },
      fuels: ["euro95", "diesel"],
      timestamps: euTimestamps,
      series: euSeries,
    };

    console.log(`  EU comparison: ${euTimestamps.length} weekly data points.`);
  } else {
    console.warn("No eu_prices.csv found -- skipping EU comparison.");
  }

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
      eur_usd: eurUsd.map((v) => round(v, 4)),
      brent_eur: brentEur.map((v) => round(v)),
      pct_unleaded_95: pctU95,
      pct_brent: pctBrent,
      pct_brent_eur: pctBrentEur,
      cumulative_spread: cumulativeSpread,
    },
  };

  if (euComparison) {
    output.eu_comparison = euComparison;
  }

  // Write JSON
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_JSON, JSON.stringify(output));

  // Copy CSVs for public download
  copyFileSync(FUEL_CSV, join(OUT_DIR, "fuel_prices.csv"));
  copyFileSync(BRENT_CSV, join(OUT_DIR, "brent_prices.csv"));
  if (existsSync(EURUSD_CSV)) {
    copyFileSync(EURUSD_CSV, join(OUT_DIR, "eurusd_prices.csv"));
  }
  if (existsSync(BRENT_EUR_CSV)) {
    copyFileSync(BRENT_EUR_CSV, join(OUT_DIR, "brent_eur_prices.csv"));
  }
  if (existsSync(EU_CSV)) {
    copyFileSync(EU_CSV, join(OUT_DIR, "eu_prices.csv"));
  }

  const jsonSize = (readFileSync(OUT_JSON).length / 1024).toFixed(1);
  console.log(`Generated ${OUT_JSON} (${jsonSize} KB)`);
  console.log(`  ${len} data points, latest: ${latest.date}`);
  console.log(`  Unleaded 95: €${latest.unleaded_95} (avg365: €${latest.avg_365.unleaded_95})`);
  console.log(`  Brent: $${latest.brent} (avg365: $${latest.avg_365.brent})`);
  if (latest.brent_eur != null) {
    console.log(`  Brent EUR: €${latest.brent_eur} (avg365: €${latest.avg_365.brent_eur})`);
  }
  console.log(`Copied CSVs to ${OUT_DIR}/`);
}

main();
