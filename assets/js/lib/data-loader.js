/** Fetch and cache JSON data files. */

import { IS_DEV } from "./env.js";

const cache = new Map();

/** Append a cache-busting timestamp query param to a URL. */
function bustCache(url) {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}v=${Date.now()}`;
}

/**
 * Fetch a JSON file, returning cached result on subsequent calls.
 * In dev mode, local fallback is tried first (fresh local data).
 * In production, S3 is primary with local as fallback.
 * Cache-busting is applied to all fetches to bypass CDN/browser caches.
 * @param {string} url
 * @param {string} [fallbackUrl] - local fallback if primary fails
 * @returns {Promise<any>}
 */
export async function fetchJSON(url, fallbackUrl) {
  if (cache.has(url)) return cache.get(url);

  // In dev mode, swap order: local first, S3 as fallback
  const primary = IS_DEV && fallbackUrl ? fallbackUrl : url;
  const secondary = IS_DEV && fallbackUrl ? url : fallbackUrl;

  if (IS_DEV) {
    console.info("[DEV] Using local data:", primary);
  }

  try {
    const resp = await fetch(bustCache(primary));
    if (!resp.ok) throw new Error(`${resp.status}`);
    const data = await resp.json();
    cache.set(url, data);
    return data;
  } catch (err) {
    if (secondary) {
      console.warn(`Primary fetch failed (${err.message}), using fallback: ${secondary}`);
      const resp = await fetch(bustCache(secondary));
      if (!resp.ok) throw new Error(`Fallback also failed: ${resp.status}`);
      const data = await resp.json();
      cache.set(url, data);
      return data;
    }
    throw err;
  }
}
