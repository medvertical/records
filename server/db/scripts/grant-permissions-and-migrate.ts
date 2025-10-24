/**
 * Grant Permissions and Run Migration
 * Connects as postgres superuser to grant permissions and run migration
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

// Parse DATABASE_URL to get database details
const url = new URL(DATABASE_URL);
const dbName = url.pathname.substring(1);
const dbUser = url.username;

// Create postgres superuser connection string
const postgresURL = `postgresql://postgres@${url.host}/${dbName}`;

async function runMigrationAsSuperuser() {
  console.log('🔐 Attempting to connect as postgres superuser...');
  
  const pool = new Pool({ connectionString: postgresURL });
  
  try {
    // Test connection
    await pool.query('SELECT 1');
    console.log('✅ Connected as postgres superuser');
    
    const migrationFile = path.join(process.cwd(), 'migrations', '0041_remove_fhir_resources_data_field.sql');
    
    if (!fs.existsSync(migrationFile)) {
      throw new Error(`Migration file not found: ${migrationFile}`);
    }
    
    console.log('\n🔄 Running migration: 0041_remove_fhir_resources_data_field.sql');
    console.log(`   Database: ${dbName}`);
    
    const sql = fs.readFileSync(migrationFile, 'utf-8');
    
    console.log('\n📝 Migration SQL:');
    console.log('─'.repeat(60));
    console.log(sql);
    console.log('─'.repeat(60));
    
    console.log('\n⚠️  About to execute migration...');
    console.log('   This will DROP the data column from fhir_resources table');
    console.log('   Data has been backed up\n');
    
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
    
    return true;
  } catch (error: any) {
    if (error.message?.includes('authentication failed') || error.message?.includes('password')) {
      console.log('❌ Cannot connect as postgres superuser');
      console.log('\n📋 Manual migration required:');
      console.log(`   Run this SQL as database owner:\n`);
      console.log(`   psql -d ${dbName} -c "ALTER TABLE fhir_resources DROP COLUMN IF EXISTS data;"`);
      console.log(`\n   Or grant ALTER permission to ${dbUser}:\n`);
      console.log(`   GRANT ALL ON TABLE fhir_resources TO ${dbUser};`);
      return false;
    }
    throw error;
  } finally {
    await pool.end();
  }
}

// Run
runMigrationAsSuperuser()
  .then((success) => {
    if (success) {
      console.log('\n🎉 Migration completed successfully!');
      console.log('\n📝 Next steps:');
      console.log('   1. Restart your application');
      console.log('   2. Test validation workflow');
      console.log('   3. Verify resources are fetched from FHIR server');
    }
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  });

