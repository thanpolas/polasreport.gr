#!/usr/bin/env node

/**
 * Fetch today's (or most recent) fuel price PDF from fuelprices.gr,
 * extract prices, and append to fuel_prices.csv.
 *
 * Designed for daily cron use. Tries today, then up to 3 days back
 * (weekends/holidays). Skips if date already exists in CSV.
 */

import { existsSync, readFileSync, writeFileSync, mkdtempSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { extractPricesFromPDF } from "./lib/parse-fuel-pdf.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = join(__dirname, "..", "_fuel-pdfs", "fuel_prices.csv");

const HEADER = "date,unleaded_95,unleaded_100,diesel,autogas,heating_diesel,filename";
const BASE_URL = "https://www.fuelprices.gr/files/deltia";

function loadExistingDates() {
  if (!existsSync(CSV_PATH)) return new Set();
  const lines = readFileSync(CSV_PATH, "utf-8").trim().split("\n").slice(1);
  return new Set(lines.map((line) => line.split(",")[0]));
}

function loadExistingRows() {
  if (!existsSync(CSV_PATH)) return [];
  return readFileSync(CSV_PATH, "utf-8").trim().split("\n").slice(1);
}

function formatDate(d) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return { iso: `${yyyy}-${mm}-${dd}`, file: `${dd}_${mm}_${yyyy}` };
}

async function fetchPDF(dateStr) {
  const filename = `IMERISIO_DELTIO_PANELLINIO_${dateStr}.pdf`;
  const url = `${BASE_URL}/${filename}`;

  const resp = await fetch(url);
  if (!resp.ok) return null;

  const buffer = Buffer.from(await resp.arrayBuffer());
  const tmpDir = mkdtempSync(join(tmpdir(), "fuel-"));
  const tmpPath = join(tmpDir, filename);
  writeFileSync(tmpPath, buffer);

  return { tmpPath, filename };
}

async function main() {
  const existingDates = loadExistingDates();
  const now = new Date();

  // Try today, then up to 3 days back
  for (let offset = 0; offset <= 3; offset++) {
    const d = new Date(now);
    d.setDate(d.getDate() - offset);
    const { iso, file } = formatDate(d);

    if (existingDates.has(iso)) {
      if (offset === 0) {
        console.log(`Already have data for ${iso}. Up to date.`);
        return;
      }
      continue;
    }

    console.log(`Trying ${iso}...`);
    const result = await fetchPDF(file);

    if (!result) {
      console.log(`  No PDF available for ${iso}`);
      continue;
    }

    const { tmpPath, filename } = result;
    const prices = extractPricesFromPDF(tmpPath);

    // Clean up temp file
    try { unlinkSync(tmpPath); } catch {}

    if (!prices) {
      console.log(`  PDF found but no prices extracted for ${iso}`);
      continue;
    }

    const row = [
      iso,
      prices.unleaded_95 ?? "",
      prices.unleaded_100 ?? "",
      prices.diesel ?? "",
      prices.autogas ?? "",
      prices.heating_diesel ?? "",
      filename,
    ].join(",");

    const allRows = [...loadExistingRows(), row];
    allRows.sort((a, b) => a.localeCompare(b));

    writeFileSync(CSV_PATH, HEADER + "\n" + allRows.join("\n") + "\n");

    console.log(`  Added: ${iso} | Unleaded 95: €${prices.unleaded_95}`);
    return;
  }

  console.log("No new data found for the last 4 days.");
}

main();
