/**
 * Script to add terminology_servers column to validation_settings table
 */

import { sql } from 'drizzle-orm';
import { db } from '../server/db';

async function addColumn() {
  console.log('🔧 Adding terminology_servers column...');
  
  try {
    // Add column
    await db.execute(sql`
      ALTER TABLE validation_settings 
      ADD COLUMN IF NOT EXISTS terminology_servers jsonb DEFAULT '[]'::jsonb
    `);
    
    console.log('✅ Column added successfully!');
    
    // Update existing rows with default value
    await db.execute(sql`
      UPDATE validation_settings 
      SET terminology_servers = '[]'::jsonb 
      WHERE terminology_servers IS NULL
    `);
    
    console.log('✅ Existing rows updated!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

addColumn();

