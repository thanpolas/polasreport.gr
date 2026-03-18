#!/usr/bin/env node

/**
 * Fetch EU fuel prices from the European Commission Weekly Oil Bulletin.
 *
 * Downloads the historical XLSX file, extracts prices with taxes for
 * target countries (EU avg, Greece, Italy, Bulgaria, Romania) and
 * fuel types (Euro-super 95, Diesel), and writes a clean CSV.
 *
 * Prices in the source are EUR per 1000 litres; we convert to EUR per litre.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import xlsx from "node-xlsx";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = join(__dirname, "..", "_fuel-pdfs", "eu_prices.csv");

const XLSX_URL =
  "https://energy.ec.europa.eu/document/download/906e60ca-8b6a-44e7-8589-652854d2fd3f_en?filename=Weekly_Oil_Bulletin_Prices_History_maticni_4web.xlsx";

// Columns we want: { csv_column_name: xlsx_header_match }
const TARGET_COLUMNS = {
  eu_euro95: "EU_price_with_tax_euro95",
  eu_diesel: "EU_price_with_tax_diesel",
  gr_euro95: "GR_price_with_tax_euro95",
  gr_diesel: "GR_price_with_tax_diesel",
  it_euro95: "IT_price_with_tax_euro95",
  it_diesel: "IT_price_with_tax_diesel",
  bg_euro95: "BG_price_with_tax_euro95",
  bg_diesel: "BG_price_with_tax_diesel",
  ro_euro95: "RO_price_with_tax_euro95",
  ro_diesel: "RO_price_with_tax_diesel",
};

/**
 * Convert Excel serial date number to ISO date string.
 * Excel epoch is 1900-01-01 with a known leap year bug (day 60 = Feb 29, 1900).
 */
function excelDateToISO(serial) {
  if (typeof serial === "string") {
    // Already a date string
    if (/^\d{4}-\d{2}-\d{2}/.test(serial)) return serial.slice(0, 10);
    return null;
  }
  if (typeof serial !== "number" || serial < 1) return null;

  // Excel leap year bug: serial 60 is Feb 29 1900 which doesn't exist
  const adjusted = serial > 60 ? serial - 1 : serial;
  const ms = (adjusted - 1) * 86400000;
  const date = new Date(Date.UTC(1900, 0, 1) + ms);
  return date.toISOString().slice(0, 10);
}

async function main() {
  console.log("Downloading Weekly Oil Bulletin XLSX...");

  let resp;
  try {
    resp = await fetch(XLSX_URL, { signal: AbortSignal.timeout(60000) });
  } catch (err) {
    console.error(`Download failed: ${err.message}`);
    process.exit(1);
  }

  if (!resp.ok) {
    console.error(`Download returned ${resp.status}`);
    process.exit(1);
  }

  const buffer = Buffer.from(await resp.arrayBuffer());
  console.log(`  Downloaded ${(buffer.length / 1024 / 1024).toFixed(1)} MB`);

  // Parse XLSX -- first sheet is "Prices with taxes"
  const workbook = xlsx.parse(buffer);
  const sheet = workbook[0];
  console.log(`  Sheet: "${sheet.name}" (${sheet.data.length} rows)`);

  // Find header row -- look for a row containing our target column names
  let headerRowIdx = -1;
  let columnMap = {}; // { csv_name: column_index }

  for (let r = 0; r < Math.min(10, sheet.data.length); r++) {
    const row = sheet.data[r];
    if (!row) continue;

    // Check if this row contains any of our target headers
    const found = {};
    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] || "").trim();
      for (const [csvName, xlsxHeader] of Object.entries(TARGET_COLUMNS)) {
        if (cell === xlsxHeader) {
          found[csvName] = c;
        }
      }
    }

    if (Object.keys(found).length >= 5) {
      headerRowIdx = r;
      columnMap = found;
      break;
    }
  }

  if (headerRowIdx < 0) {
    console.error("Could not find header row with target columns.");
    console.error("First 5 rows sample:");
    for (let r = 0; r < Math.min(5, sheet.data.length); r++) {
      console.error(`  Row ${r}: ${(sheet.data[r] || []).slice(0, 10).join(" | ")}`);
    }
    process.exit(1);
  }

  console.log(`  Header row: ${headerRowIdx}`);
  console.log(`  Columns found: ${Object.keys(columnMap).join(", ")}`);

  // Find date column (column A or look for "Date" header)
  let dateCol = 0;
  for (let c = 0; c < (sheet.data[headerRowIdx] || []).length; c++) {
    if (String(sheet.data[headerRowIdx][c] || "").trim().toLowerCase() === "date") {
      dateCol = c;
      break;
    }
  }

  // Extract data rows
  const csvHeader = "date," + Object.keys(TARGET_COLUMNS).join(",");
  const csvRows = [];

  for (let r = headerRowIdx + 1; r < sheet.data.length; r++) {
    const row = sheet.data[r];
    if (!row || !row[dateCol]) continue;

    const dateStr = excelDateToISO(row[dateCol]);
    if (!dateStr) continue;

    const values = Object.keys(TARGET_COLUMNS).map((csvName) => {
      const colIdx = columnMap[csvName];
      if (colIdx == null) return "";
      const val = row[colIdx];
      if (val == null || val === "" || val === "-") return "";
      const num = parseFloat(val);
      if (isNaN(num)) return "";
      // Convert EUR/1000L to EUR/L
      return (num / 1000).toFixed(3);
    });

    // Skip rows where all values are empty
    if (values.every((v) => v === "")) continue;

    csvRows.push(`${dateStr},${values.join(",")}`);
  }

  // Sort by date
  csvRows.sort();

  // Short-circuit: skip write if CSV already exists with the same latest date
  const newLatestDate = csvRows[csvRows.length - 1]?.split(",")[0];
  if (existsSync(CSV_PATH) && newLatestDate) {
    const existing = readFileSync(CSV_PATH, "utf-8").trim().split("\n");
    const existingLatest = existing[existing.length - 1]?.split(",")[0];
    if (existingLatest === newLatestDate) {
      console.log(`Done: already up to date (latest: ${newLatestDate}). No write needed.`);
      return;
    }
  }

  writeFileSync(CSV_PATH, csvHeader + "\n" + csvRows.join("\n") + "\n");

  console.log(`Done: ${csvRows.length} rows written to ${CSV_PATH}`);
  if (csvRows.length > 0) {
    console.log(`  Date range: ${csvRows[0].split(",")[0]} to ${newLatestDate}`);
  }
}

main();
