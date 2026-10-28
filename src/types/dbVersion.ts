/**
 * Lives in its own file (rather than directly in src/data/db.ts, which also
 * imports the browser-only `idb` package) so server code can depend on the
 * IndexedDB schema version — needed to validate an uploaded local backup —
 * without pulling IndexedDB-only code into a Node serverless function
 * bundle. src/data/db.ts re-exports this for existing imports.
 */
export const DB_VERSION = 3
