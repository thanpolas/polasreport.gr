#!/usr/bin/env node

/**
 * Extract daily fuel prices from fuelprices.gr PDF bulletins into a CSV.
 * Scans _fuel-pdfs/pdfs/ for all PDFs. For daily single-PDF updates, use fetch_today_pdf.mjs.
 * Requires `pdftotext` (poppler) installed on the system.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { extractPricesFromPDF } from "./lib/parse-fuel-pdf.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PDFS_DIR = join(__dirname, "..", "_fuel-pdfs", "pdfs");
const CSV_PATH = join(__dirname, "..", "_fuel-pdfs", "fuel_prices.csv");

const HEADER = "date,unleaded_95,unleaded_100,diesel,autogas,heating_diesel,filename";

function parseDateFromFilename(filename) {
  const match = filename.match(/(\d{1,2})_(\d{2})_(\d{4})\.pdf$/);
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month}-${day.padStart(2, "0")}`;
}

function loadExistingFiles() {
  if (!existsSync(CSV_PATH)) return new Set();
  const lines = readFileSync(CSV_PATH, "utf-8").trim().split("\n").slice(1);
  return new Set(lines.map((line) => line.split(",").pop()));
}

function loadExistingRows() {
  if (!existsSync(CSV_PATH)) return [];
  return readFileSync(CSV_PATH, "utf-8").trim().split("\n").slice(1);
}

function main() {
  const existingFiles = loadExistingFiles();
  const pdfFiles = readdirSync(PDFS_DIR)
    .filter((f) => f.endsWith(".pdf"))
    .sort();

  let newCount = 0;
  let skipCount = 0;
  let failCount = 0;
  const newRows = [];

  for (const filename of pdfFiles) {
    if (existingFiles.has(filename)) {
      skipCount++;
      continue;
    }

    const date = parseDateFromFilename(filename);
    if (!date) {
      console.error(`  SKIP (bad filename): ${filename}`);
      failCount++;
      continue;
    }

    const prices = extractPricesFromPDF(join(PDFS_DIR, filename));
    if (!prices) {
      console.error(`  FAIL (no prices found): ${filename}`);
      failCount++;
      continue;
    }

    const row = [
      date,
      prices.unleaded_95 ?? "",
      prices.unleaded_100 ?? "",
      prices.diesel ?? "",
      prices.autogas ?? "",
      prices.heating_diesel ?? "",
      filename,
    ].join(",");

    newRows.push(row);
    newCount++;
  }

  const allRows = [...loadExistingRows(), ...newRows];
  allRows.sort((a, b) => a.localeCompare(b));

  writeFileSync(CSV_PATH, HEADER + "\n" + allRows.join("\n") + "\n");

  console.log(`Done: ${newCount} new, ${skipCount} skipped, ${failCount} failed.`);
  console.log(`Total rows in CSV: ${allRows.length}`);
}

main();
