/**
 * Database Backup Script
 * Creates a SQL dump of the entire database before running migrations
 */
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

async function createBackup() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(process.cwd(), 'backups');
    const backupFile = path.join(backupDir, `backup_before_remove_data_${timestamp}.sql`);
    
    // Ensure backup directory exists
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    console.log('📦 Creating database backup...');
    console.log(`   Database: ${DATABASE_URL.replace(/:[^:@]+@/, ':****@')}`);
    console.log(`   Backup file: ${backupFile}`);
    
    // Connect to database and get schema + data
    const pool = new Pool({ connectionString: DATABASE_URL });
    let backupSQL = '-- Database Backup\n';
    backupSQL += `-- Created: ${new Date().toISOString()}\n`;
    backupSQL += `-- Database: ${DATABASE_URL.replace(/:[^:@]+@/, ':****@')}\n\n`;
    
    try {
      // Get all tables
      const tablesResult = await pool.query(`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        ORDER BY tablename;
      `);
      
      console.log(`   Found ${tablesResult.rows.length} tables to backup`);
      
      for (const { tablename } of tablesResult.rows) {
        console.log(`   - Backing up table: ${tablename}`);
        
        // Get table schema
        const schemaResult = await pool.query(`
          SELECT 
            'CREATE TABLE ' || quote_ident(tablename) || ' (' ||
            string_agg(
              quote_ident(column_name) || ' ' || data_type ||
              CASE WHEN character_maximum_length IS NOT NULL 
                THEN '(' || character_maximum_length || ')' 
                ELSE '' END,
              ', '
            ) || ');' as create_statement
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1
          GROUP BY tablename;
        `, [tablename]);
        
        if (schemaResult.rows.length > 0) {
          backupSQL += `\n-- Table: ${tablename}\n`;
          backupSQL += `DROP TABLE IF EXISTS "${tablename}" CASCADE;\n`;
          backupSQL += schemaResult.rows[0].create_statement + '\n\n';
        }
        
        // Get row count
        const countResult = await pool.query(`SELECT COUNT(*) as count FROM "${tablename}"`);
        const rowCount = parseInt(countResult.rows[0].count);
        
        if (rowCount > 0) {
          backupSQL += `-- Data for ${tablename} (${rowCount} rows)\n`;
          // Note: For very large tables, this could be optimized with streaming
          const dataResult = await pool.query(`SELECT * FROM "${tablename}"`);
          
          if (dataResult.rows.length > 0) {
            const columns = Object.keys(dataResult.rows[0]);
            const columnList = columns.map(c => `"${c}"`).join(', ');
            
            for (const row of dataResult.rows) {
              const values = columns.map(col => {
                const val = row[col];
                if (val === null) return 'NULL';
                if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
                if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
                if (val instanceof Date) return `'${val.toISOString()}'`;
                return val;
              }).join(', ');
              
              backupSQL += `INSERT INTO "${tablename}" (${columnList}) VALUES (${values});\n`;
            }
          }
        }
      }
      
      // Write to file
      fs.writeFileSync(backupFile, backupSQL, 'utf-8');
      
      // Check file size
      const stats = fs.statSync(backupFile);
      const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      
      console.log(`✅ Backup created successfully!`);
      console.log(`   File: ${backupFile}`);
      console.log(`   Size: ${fileSizeMB} MB`);
      
      // Show table statistics
      const statsResult = await pool.query(`
        SELECT schemaname, tablename, n_live_tup as row_count 
        FROM pg_stat_user_tables 
        WHERE schemaname = 'public' 
        ORDER BY n_live_tup DESC;
      `);
      
      console.log('\n📊 Current table statistics:');
      statsResult.rows.forEach(row => {
        console.log(`   ${row.tablename}: ${row.row_count} rows`);
      });
      
      return backupFile;
    } finally {
      await pool.end();
    }
  } catch (error: any) {
    console.error('❌ Backup failed:', error.message);
    throw error;
  }
}

// Run backup
createBackup()
  .then(() => {
    console.log('\n✅ Backup process completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Backup process failed:', error);
    process.exit(1);
  });

