/** Fetch and cache JSON data files. */

const cache = new Map();

/**
 * Fetch a JSON file, returning cached result on subsequent calls.
 * @param {string} url
 * @returns {Promise<any>}
 */
export async function fetchJSON(url) {
  if (cache.has(url)) return cache.get(url);

  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to load ${url}: ${resp.status}`);

  const data = await resp.json();
  cache.set(url, data);
  return data;
}
