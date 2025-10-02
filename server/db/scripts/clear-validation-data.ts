import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { 
  validationResultsPerAspect, 
  validationMessages, 
  validationMessageGroups 
} from '../../../shared/schema-validation-per-aspect';
import { validationResults } from '../../../shared/schema';
import { sql } from 'drizzle-orm';
import * as readline from 'readline';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const pool = new Pool({
  connectionString: DATABASE_URL,
});

const db = drizzle(pool);

/**
 * Prompt user for confirmation
 */
function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question + ' (y/N): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Clear all per-aspect validation data
 */
async function clearPerAspectData(force: boolean = false) {
  try {
    console.log('🗑️  Clearing per-aspect validation data...');
    
    if (!force) {
      const confirmed = await confirm('Are you sure you want to delete all per-aspect validation data?');
      if (!confirmed) {
        console.log('Operation cancelled.');
        return { success: false, cleared: 0 };
      }
    }
    
    // Delete in order (respecting FK constraints)
    const [groupsResult] = await db.execute(sql`DELETE FROM ${validationMessageGroups}`);
    const groupsCleared = groupsResult.rowCount || 0;
    console.log(`✅ Cleared ${groupsCleared} message groups`);
    
    const [messagesResult] = await db.execute(sql`DELETE FROM ${validationMessages}`);
    const messagesCleared = messagesResult.rowCount || 0;
    console.log(`✅ Cleared ${messagesCleared} validation messages`);
    
    const [resultsResult] = await db.execute(sql`DELETE FROM ${validationResultsPerAspect}`);
    const resultsCleared = resultsResult.rowCount || 0;
    console.log(`✅ Cleared ${resultsCleared} validation results`);
    
    const totalCleared = groupsCleared + messagesCleared + resultsCleared;
    console.log(`🎉 Total records cleared: ${totalCleared}`);
    
    return { success: true, cleared: totalCleared };
  } catch (error) {
    console.error('❌ Failed to clear data:', error);
    throw error;
  }
}

/**
 * Clear legacy validation results (old monolithic table)
 */
async function clearLegacyData(force: boolean = false) {
  try {
    console.log('🗑️  Clearing legacy validation data...');
    
    if (!force) {
      const confirmed = await confirm('Are you sure you want to delete all legacy validation results?');
      if (!confirmed) {
        console.log('Operation cancelled.');
        return { success: false, cleared: 0 };
      }
    }
    
    const [result] = await db.execute(sql`DELETE FROM ${validationResults}`);
    const cleared = result.rowCount || 0;
    console.log(`✅ Cleared ${cleared} legacy validation results`);
    
    return { success: true, cleared };
  } catch (error) {
    console.error('❌ Failed to clear legacy data:', error);
    throw error;
  }
}

/**
 * Clear all validation data (both per-aspect and legacy)
 */
async function clearAllValidationData(force: boolean = false) {
  try {
    console.log('🗑️  Clearing ALL validation data (per-aspect + legacy)...');
    
    if (!force) {
      const confirmed = await confirm('⚠️  WARNING: This will delete ALL validation data. Continue?');
      if (!confirmed) {
        console.log('Operation cancelled.');
        return { success: false, perAspect: 0, legacy: 0 };
      }
    }
    
    const perAspectResult = await clearPerAspectData(true);
    const legacyResult = await clearLegacyData(true);
    
    console.log(`\n🎉 All validation data cleared!`);
    console.log(`  - Per-aspect records: ${perAspectResult.cleared}`);
    console.log(`  - Legacy records: ${legacyResult.cleared}`);
    console.log(`  - Total: ${perAspectResult.cleared + legacyResult.cleared}`);
    
    return { 
      success: true, 
      perAspect: perAspectResult.cleared, 
      legacy: legacyResult.cleared 
    };
  } catch (error) {
    console.error('❌ Failed to clear all data:', error);
    throw error;
  }
}

/**
 * Get validation data statistics
 */
async function getValidationStats() {
  try {
    const [perAspectCount] = await db.execute(sql`SELECT COUNT(*) as count FROM ${validationResultsPerAspect}`);
    const [messagesCount] = await db.execute(sql`SELECT COUNT(*) as count FROM ${validationMessages}`);
    const [groupsCount] = await db.execute(sql`SELECT COUNT(*) as count FROM ${validationMessageGroups}`);
    const [legacyCount] = await db.execute(sql`SELECT COUNT(*) as count FROM ${validationResults}`);
    
    return {
      perAspectResults: parseInt(perAspectCount.rows[0]?.count || '0'),
      messages: parseInt(messagesCount.rows[0]?.count || '0'),
      groups: parseInt(groupsCount.rows[0]?.count || '0'),
      legacyResults: parseInt(legacyCount.rows[0]?.count || '0'),
    };
  } catch (error) {
    console.error('❌ Failed to get stats:', error);
    throw error;
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const forceFlag = args.includes('--force') || args.includes('-f');
  
  try {
    // Show current stats
    console.log('\n📊 Current validation data:');
    const stats = await getValidationStats();
    console.log(`  - Per-aspect results: ${stats.perAspectResults}`);
    console.log(`  - Messages: ${stats.messages}`);
    console.log(`  - Message groups: ${stats.groups}`);
    console.log(`  - Legacy results: ${stats.legacyResults}\n`);
    
    switch (command) {
      case 'per-aspect':
        await clearPerAspectData(forceFlag);
        break;
      case 'legacy':
        await clearLegacyData(forceFlag);
        break;
      case 'all':
        await clearAllValidationData(forceFlag);
        break;
      case 'stats':
        // Stats already shown above
        break;
      default:
        console.log('Usage: tsx server/db/scripts/clear-validation-data.ts <command> [--force]');
        console.log('\nCommands:');
        console.log('  per-aspect  - Clear per-aspect validation data (new tables)');
        console.log('  legacy      - Clear legacy validation results (old table)');
        console.log('  all         - Clear all validation data (per-aspect + legacy)');
        console.log('  stats       - Show validation data statistics');
        console.log('\nOptions:');
        console.log('  --force, -f - Skip confirmation prompts');
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { 
  clearPerAspectData, 
  clearLegacyData, 
  clearAllValidationData,
  getValidationStats 
};
