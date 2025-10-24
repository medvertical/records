/**
 * Backup FHIR Resources Data Column
 * This backs up only the data column from fhir_resources before it's dropped
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

async function backupDataColumn() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(process.cwd(), 'backups');
    const backupFile = path.join(backupDir, `fhir_resources_data_${timestamp}.json`);
    
    // Ensure backup directory exists
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    console.log('📦 Backing up fhir_resources data column...');
    console.log(`   Database: ${DATABASE_URL.replace(/:[^:@]+@/, ':****@')}`);
    
    // Check if data column exists
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'fhir_resources' AND column_name = 'data';
    `);
    
    if (columnCheck.rows.length === 0) {
      console.log('⚠️  Data column already removed - no backup needed');
      return null;
    }
    
    // Get count first
    const countResult = await pool.query(`SELECT COUNT(*) as count FROM fhir_resources WHERE data IS NOT NULL`);
    const count = parseInt(countResult.rows[0].count);
    
    console.log(`   Found ${count} resources with data to backup`);
    
    if (count === 0) {
      console.log('✅ No data to backup - data column is empty');
      return null;
    }
    
    // Stream data to file to avoid memory issues
    console.log(`   Exporting to: ${backupFile}`);
    
    const result = await pool.query(`
      SELECT id, server_id, resource_type, resource_id, version_id, data 
      FROM fhir_resources 
      WHERE data IS NOT NULL
      ORDER BY id
    `);
    
    const backup = {
      timestamp: new Date().toISOString(),
      count: result.rows.length,
      resources: result.rows
    };
    
    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2), 'utf-8');
    
    const stats = fs.statSync(backupFile);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    console.log(`✅ Backup created successfully!`);
    console.log(`   File: ${backupFile}`);
    console.log(`   Size: ${fileSizeMB} MB`);
    console.log(`   Resources backed up: ${count}`);
    
    return backupFile;
  } catch (error: any) {
    console.error('❌ Backup failed:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run backup
backupDataColumn()
  .then((file) => {
    if (file) {
      console.log('\n✅ Data column backup completed');
      console.log(`\n⚠️  IMPORTANT: This backup contains the full FHIR resources that will be deleted.`);
      console.log(`   If needed, you can restore individual resources from this file.`);
    } else {
      console.log('\n✅ No backup needed - data column empty or already removed');
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Backup failed:', error);
    process.exit(1);
  });

