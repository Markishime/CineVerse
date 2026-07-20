/**
 * Client-safe re-export of seed content for offline guest library resolution.
 * Production client should resolve library items via API batch fetch.
 */
export { SEED_CONTENT as catalog } from "./seed-content";
