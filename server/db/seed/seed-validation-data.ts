import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { 
  validationResultsPerAspect, 
  validationMessages, 
  validationMessageGroups 
} from '../../../shared/schema-validation-per-aspect';
import { fhirServers } from '../../../shared/schema';
import { 
  createValidationResultFixtures,
  createValidationMessageFixtures,
  createMessageGroupFixtures
} from './validation-fixtures';
import { eq } from 'drizzle-orm';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const pool = new Pool({
  connectionString: DATABASE_URL,
});

const db = drizzle(pool);

async function seedValidationData() {
  try {
    console.log('🌱 Seeding validation data...');
    
    // Get the first active server (or create a test one)
    let servers = await db.select().from(fhirServers).where(eq(fhirServers.isActive, true)).limit(1);
    
    if (servers.length === 0) {
      console.log('No active server found, checking for any server...');
      servers = await db.select().from(fhirServers).limit(1);
    }
    
    if (servers.length === 0) {
      console.log('⚠️  No FHIR servers found in database. Please add a server first.');
      console.log('   Example: INSERT INTO fhir_servers (name, url, is_active) VALUES (\'Test Server\', \'http://localhost:8080/fhir\', true);');
      return;
    }
    
    const serverId = servers[0].id;
    console.log(`Using server ID: ${serverId} (${servers[0].name})`);
    
    // Create validation result fixtures
    console.log('Creating validation result fixtures...');
    const resultFixtures = createValidationResultFixtures(serverId);
    const insertedResults = await db.insert(validationResultsPerAspect).values(resultFixtures).returning();
    console.log(`✅ Inserted ${insertedResults.length} validation results`);
    
    // Create message fixtures
    console.log('Creating validation message fixtures...');
    const resultIds = insertedResults.map(r => r.id);
    const messageFixtures = createValidationMessageFixtures(resultIds, serverId);
    const insertedMessages = await db.insert(validationMessages).values(messageFixtures).returning();
    console.log(`✅ Inserted ${insertedMessages.length} validation messages`);
    
    // Create message group fixtures
    console.log('Creating message group fixtures...');
    const groupFixtures = createMessageGroupFixtures(serverId);
    const insertedGroups = await db.insert(validationMessageGroups).values(groupFixtures).returning();
    console.log(`✅ Inserted ${insertedGroups.length} message groups`);
    
    console.log('🎉 Validation data seeding completed successfully!');
    console.log('\nSeeded data summary:');
    console.log(`  - Server ID: ${serverId}`);
    console.log(`  - Validation Results: ${insertedResults.length}`);
    console.log(`  - Messages: ${insertedMessages.length}`);
    console.log(`  - Groups: ${insertedGroups.length}`);
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  seedValidationData().catch(console.error);
}

export { seedValidationData };
