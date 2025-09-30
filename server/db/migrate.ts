import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const pool = new Pool({
  connectionString: DATABASE_URL,
});

const db = drizzle(pool);

async function runMigration(direction: 'up' | 'down', migrationNumber?: string) {
  try {
    console.log(`Running migration ${direction}...`);
    
    if (direction === 'up') {
      // Run forward migration using Drizzle
      await migrate(db, { migrationsFolder: './migrations' });
      console.log('✅ Migration completed successfully');
    } else if (direction === 'down') {
      // Manual rollback - execute specific down migration
      if (!migrationNumber) {
        throw new Error('Migration number is required for rollback');
      }
      
      const downFile = path.join(process.cwd(), 'migrations', `${migrationNumber}_down.sql`);
      
      if (!fs.existsSync(downFile)) {
        throw new Error(`Rollback migration file not found: ${downFile}`);
      }
      
      const sql = fs.readFileSync(downFile, 'utf-8');
      await pool.query(sql);
      console.log(`✅ Rollback migration ${migrationNumber} completed successfully`);
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// CLI usage
const args = process.argv.slice(2);
const direction = args[0] as 'up' | 'down';
const migrationNumber = args[1];

if (!direction || !['up', 'down'].includes(direction)) {
  console.error('Usage: tsx server/db/migrate.ts <up|down> [migration_number]');
  console.error('Example: tsx server/db/migrate.ts up');
  console.error('Example: tsx server/db/migrate.ts down 013_per_aspect_validation_storage');
  process.exit(1);
}

runMigration(direction, migrationNumber);
