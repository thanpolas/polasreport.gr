/**
 * Shared PDF parsing logic for fuel price bulletins.
 * Used by both the bulk extractor and the daily fetcher.
 */

import { execFileSync } from "node:child_process";

/**
 * Extract fuel prices from a PDF file using pdftotext.
 * @param {string} pdfPath - absolute path to the PDF file
 * @returns {object|null} - { unleaded_95, unleaded_100, diesel, autogas, heating_diesel } or null
 */
export function extractPricesFromPDF(pdfPath) {
  let text;
  try {
    text = execFileSync("pdftotext", ["-layout", pdfPath, "-"], {
      encoding: "utf-8",
    });
  } catch {
    return null;
  }

  return parseFuelText(text);
}

/**
 * Parse fuel prices from pdftotext output.
 * @param {string} text - raw text from pdftotext
 * @returns {object|null} - prices object or null if no prices found
 */
export function parseFuelText(text) {
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
