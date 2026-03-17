/** Fetch and cache JSON data files. */

const cache = new Map();

/**
 * Fetch a JSON file, returning cached result on subsequent calls.
 * @param {string} url
 * @param {string} [fallbackUrl] - local fallback if primary fails
 * @returns {Promise<any>}
 */
export async function fetchJSON(url, fallbackUrl) {
  if (cache.has(url)) return cache.get(url);

  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`${resp.status}`);
    const data = await resp.json();
    cache.set(url, data);
    return data;
  } catch (err) {
    if (fallbackUrl) {
      console.warn(`Primary fetch failed (${err.message}), using fallback: ${fallbackUrl}`);
      const resp = await fetch(fallbackUrl);
      if (!resp.ok) throw new Error(`Fallback also failed: ${resp.status}`);
      const data = await resp.json();
      cache.set(url, data);
      return data;
    }
    throw err;
  }
}
