#!/usr/bin/env node

/**
 * Extract daily fuel prices from fuelprices.gr PDF bulletins into a CSV.
 * Requires `pdftotext` (poppler) installed on the system.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

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

function extractPrices(pdfPath) {
  let text;
  try {
    text = execFileSync("pdftotext", ["-layout", pdfPath, "-"], {
      encoding: "utf-8",
    });
  } catch {
    return null;
  }

  const prices = {};

  for (const line of text.split("\n")) {
    const priceMatch = line.trim().match(/(\d+,\d{3})\s*$/);
    if (!priceMatch) continue;
    const price = priceMatch[1].replace(",", ".");

    if (line.includes("95") && !prices.unleaded_95) {
      prices.unleaded_95 = price;
    } else if (line.includes("100") && !prices.unleaded_100) {
      prices.unleaded_100 = price;
    } else if (/autogas/i.test(line)) {
      prices.autogas = price;
    } else if (line.includes("Diesel")) {
      if (!prices.diesel) {
        prices.diesel = price;
      } else {
        prices.heating_diesel = price;
      }
    }
  }

  return Object.keys(prices).length > 0 ? prices : null;
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

    const prices = extractPrices(join(PDFS_DIR, filename));
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
