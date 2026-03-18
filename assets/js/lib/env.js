/** Environment detection for browser-side code. */

const hostname = globalThis.location?.hostname ?? "";

/** True when running on localhost (Jekyll dev server). */
export const IS_DEV =
  hostname === "localhost" ||
  hostname === "127.0.0.1" ||
  hostname.startsWith("192.168.");
