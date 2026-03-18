/** Environment detection for Node pipeline scripts. */

/** True when NODE_ENV is explicitly set to "development". */
export const IS_DEV = process.env.NODE_ENV === "development";
