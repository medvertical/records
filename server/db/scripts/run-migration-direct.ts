/**
 * Run Migration Directly
 * Runs the SQL migration without using Drizzle's migration system
 */
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

async function runMigration() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  
  try {
    const migrationFile = path.join(process.cwd(), 'migrations', '0041_remove_fhir_resources_data_field.sql');
    
    if (!fs.existsSync(migrationFile)) {
      throw new Error(`Migration file not found: ${migrationFile}`);
    }
    
    console.log('🔄 Running migration: 0041_remove_fhir_resources_data_field.sql');
    console.log(`   Database: ${DATABASE_URL.replace(/:[^:@]+@/, ':****@')}`);
    
    const sql = fs.readFileSync(migrationFile, 'utf-8');
    
    console.log('\n📝 Migration SQL:');
    console.log('─'.repeat(60));
    console.log(sql);
    console.log('─'.repeat(60));
    
    console.log('\n⚠️  About to execute migration...');
    console.log('   This will DROP the data column from fhir_resources table');
    console.log('   Data has been backed up to: backups/fhir_resources_data_*.json\n');
    
    await pool.query(sql);
    
    console.log('✅ Migration completed successfully!');
    
    // Verify the column was dropped
    const checkResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'fhir_resources' AND column_name = 'data';
    `);
    
    if (checkResult.rows.length === 0) {
      console.log('✅ Verified: data column has been removed');
    } else {
      console.log('⚠️  Warning: data column still exists');
    }
    
    // Show remaining columns
    const columnsResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'fhir_resources'
      ORDER BY ordinal_position;
    `);
    
    console.log('\n📊 Remaining columns in fhir_resources:');
    columnsResult.rows.forEach(row => {
      console.log(`   - ${row.column_name} (${row.data_type})`);
    });
    
    // Show row count
    const countResult = await pool.query(`SELECT COUNT(*) as count FROM fhir_resources`);
    console.log(`\n✅ Table still contains ${countResult.rows[0].count} resource records (metadata only)`);
    
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run migration
runMigration()
  .then(() => {
    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Restart your application');
    console.log('   2. Test validation workflow');
    console.log('   3. Verify resources are fetched from FHIR server');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    console.error('\n🔄 Rollback: You can restore from backup if needed');
    process.exit(1);
  });

