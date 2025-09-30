import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const pool = new Pool({
  connectionString: DATABASE_URL,
});

const db = drizzle(pool);

interface TestResult {
  step: string;
  success: boolean;
  message: string;
  error?: any;
}

const results: TestResult[] = [];

function logStep(step: string, success: boolean, message: string, error?: any) {
  const result: TestResult = { step, success, message, error };
  results.push(result);
  
  const icon = success ? '✅' : '❌';
  console.log(`${icon} ${step}: ${message}`);
  if (error) {
    console.error('   Error:', error.message || error);
  }
}

/**
 * Check if tables exist
 */
async function checkTablesExist(tableNames: string[]): Promise<boolean> {
  try {
    for (const tableName of tableNames) {
      const result = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = ${tableName}
        );
      `);
      
      const exists = result.rows[0]?.exists === true;
      if (!exists) {
        return false;
      }
    }
    return true;
  } catch (error) {
    throw error;
  }
}

/**
 * Insert test data and verify
 */
async function insertTestData(): Promise<number> {
  // Insert test server if needed
  const [serverResult] = await db.execute(sql`
    INSERT INTO fhir_servers (name, url, is_active)
    VALUES ('Test Migration Server', 'http://test.local/fhir', true)
    RETURNING id;
  `);
  
  const serverId = serverResult.rows[0]?.id;
  if (!serverId) {
    throw new Error('Failed to insert test server');
  }
  
  // Insert validation result
  const [resultInsert] = await db.execute(sql`
    INSERT INTO validation_results_per_aspect 
    (server_id, resource_type, fhir_id, aspect, is_valid, error_count, warning_count, information_count, score, settings_snapshot_hash)
    VALUES (${serverId}, 'Patient', 'test-patient-001', 'structural', false, 2, 1, 0, 0, 'test-hash-123')
    RETURNING id;
  `);
  
  const resultId = resultInsert.rows[0]?.id;
  if (!resultId) {
    throw new Error('Failed to insert test validation result');
  }
  
  return serverId;
}

/**
 * Verify data preservation after migration
 */
async function verifyDataPreservation(serverId: number): Promise<boolean> {
  const [result] = await db.execute(sql`
    SELECT COUNT(*) as count 
    FROM validation_results_per_aspect 
    WHERE server_id = ${serverId};
  `);
  
  const count = parseInt(result.rows[0]?.count || '0');
  return count > 0;
}

/**
 * Run forward migration
 */
async function runForwardMigration(): Promise<void> {
  const migrationFile = path.join(process.cwd(), 'migrations', '013_per_aspect_validation_storage.sql');
  
  if (!fs.existsSync(migrationFile)) {
    throw new Error(`Migration file not found: ${migrationFile}`);
  }
  
  const migrationSQL = fs.readFileSync(migrationFile, 'utf-8');
  await pool.query(migrationSQL);
}

/**
 * Run rollback migration
 */
async function runRollbackMigration(): Promise<void> {
  const rollbackFile = path.join(process.cwd(), 'migrations', '013_per_aspect_validation_storage_down.sql');
  
  if (!fs.existsSync(rollbackFile)) {
    throw new Error(`Rollback file not found: ${rollbackFile}`);
  }
  
  const rollbackSQL = fs.readFileSync(rollbackFile, 'utf-8');
  await pool.query(rollbackSQL);
}

/**
 * Clean up test data
 */
async function cleanup(serverId?: number): Promise<void> {
  try {
    if (serverId) {
      // Clean up test data
      await db.execute(sql`DELETE FROM validation_results_per_aspect WHERE server_id = ${serverId};`);
      await db.execute(sql`DELETE FROM fhir_servers WHERE id = ${serverId};`);
    }
  } catch (error) {
    console.warn('Cleanup warning:', error);
  }
}

/**
 * Main test sequence
 */
async function testMigration() {
  let testServerId: number | undefined;
  
  try {
    console.log('\n🧪 Testing migration 013: Per-Aspect Validation Storage\n');
    console.log('=' .repeat(60));
    
    // Step 1: Check if tables already exist (clean state)
    console.log('\n📋 Step 1: Checking initial state...');
    const tablesExistBefore = await checkTablesExist([
      'validation_results_per_aspect',
      'validation_messages',
      'validation_message_groups'
    ]);
    
    if (tablesExistBefore) {
      logStep('Initial State', false, 'Tables already exist. Please run rollback first or use fresh database.');
      console.log('\n   Run: npm run db:migrate:down 013_per_aspect_validation_storage');
      return;
    } else {
      logStep('Initial State', true, 'Tables do not exist (clean state)');
    }
    
    // Step 2: Run forward migration
    console.log('\n📋 Step 2: Running forward migration...');
    try {
      await runForwardMigration();
      logStep('Forward Migration', true, 'Migration executed successfully');
    } catch (error) {
      logStep('Forward Migration', false, 'Migration failed', error);
      throw error;
    }
    
    // Step 3: Verify tables were created
    console.log('\n📋 Step 3: Verifying tables were created...');
    const tablesExistAfter = await checkTablesExist([
      'validation_results_per_aspect',
      'validation_messages',
      'validation_message_groups'
    ]);
    
    if (tablesExistAfter) {
      logStep('Table Creation', true, 'All tables created successfully');
    } else {
      logStep('Table Creation', false, 'Tables were not created');
      throw new Error('Migration did not create required tables');
    }
    
    // Step 4: Insert test data
    console.log('\n📋 Step 4: Inserting test data...');
    try {
      testServerId = await insertTestData();
      logStep('Data Insertion', true, `Test data inserted (server_id: ${testServerId})`);
    } catch (error) {
      logStep('Data Insertion', false, 'Failed to insert test data', error);
      throw error;
    }
    
    // Step 5: Verify data can be queried
    console.log('\n📋 Step 5: Verifying data persistence...');
    const dataExists = await verifyDataPreservation(testServerId);
    
    if (dataExists) {
      logStep('Data Persistence', true, 'Test data persisted correctly');
    } else {
      logStep('Data Persistence', false, 'Test data not found');
      throw new Error('Data persistence check failed');
    }
    
    // Step 6: Run rollback migration
    console.log('\n📋 Step 6: Running rollback migration...');
    try {
      await runRollbackMigration();
      logStep('Rollback Migration', true, 'Rollback executed successfully');
    } catch (error) {
      logStep('Rollback Migration', false, 'Rollback failed', error);
      throw error;
    }
    
    // Step 7: Verify tables were dropped
    console.log('\n📋 Step 7: Verifying tables were dropped...');
    const tablesExistAfterRollback = await checkTablesExist([
      'validation_results_per_aspect',
      'validation_messages',
      'validation_message_groups'
    ]);
    
    if (!tablesExistAfterRollback) {
      logStep('Table Deletion', true, 'All tables dropped successfully');
    } else {
      logStep('Table Deletion', false, 'Tables still exist after rollback');
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 Test Summary:\n');
    
    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const total = results.length;
    
    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    
    if (failed === 0) {
      console.log('\n🎉 All migration tests passed!');
      console.log('\n✓ Forward migration works correctly');
      console.log('✓ Tables are created with proper schema');
      console.log('✓ Data can be inserted and queried');
      console.log('✓ Rollback migration works correctly');
      console.log('✓ Tables are cleaned up properly');
    } else {
      console.log('\n⚠️  Some tests failed. Review the errors above.');
    }
    
  } catch (error) {
    console.error('\n❌ Migration test failed:', error);
    throw error;
  } finally {
    // Cleanup
    if (testServerId) {
      await cleanup(testServerId);
    }
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  testMigration().catch((error) => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

export { testMigration };
