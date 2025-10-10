/**
 * Re-export db instance from parent directory
 * This file exists because there's a server/db/ directory,
 * so imports like "import { db } from '../db'" resolve to server/db/index.ts
 */

export { db, pool } from '../db.js';

