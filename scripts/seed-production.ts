#!/usr/bin/env tsx
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq } from 'drizzle-orm';
import { fhirServers, validationSettings } from '../shared/schema.js';
import * as dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  console.error('   Set it in your .env file or environment');
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const db = drizzle(sql);

async function seedProduction() {
  console.log('🌱 Seeding production database with initial data...\n');
  
  try {
    // ============================================================================
    // 1. SEED FHIR SERVERS
    // ============================================================================
    console.log('📡 Seeding FHIR Servers...');
    
    const servers = [
      {
        name: 'HAPI FHIR Test Server (R4)',
        url: 'http://hapi.fhir.org/baseR4',
        fhirVersion: 'R4',
        isActive: true,
        authConfig: null
      },
      {
        name: 'SMART Health IT Test Server',
        url: 'https://r4.smarthealthit.org',
        fhirVersion: 'R4',
        isActive: false,
        authConfig: null
      },
      {
        name: 'Public HAPI Server (STU3)',
        url: 'http://hapi.fhir.org/baseDstu3',
        fhirVersion: 'STU3',
        isActive: false,
        authConfig: null
      }
    ];
    
    const insertedServers = [];
    for (const server of servers) {
      // Check if server already exists
      const existing = await db.select()
        .from(fhirServers)
        .where(eq(fhirServers.url, server.url))
        .limit(1);
      
      if (existing.length > 0) {
        console.log(`   ⏭️  Skipped: ${server.name} (already exists)`);
        insertedServers.push(existing[0]);
      } else {
        const [inserted] = await db.insert(fhirServers).values(server).returning();
        console.log(`   ✅ Added: ${server.name}`);
        insertedServers.push(inserted);
      }
    }
    
    console.log(`\n✅ FHIR Servers: ${insertedServers.length} total\n`);
    
    // ============================================================================
    // 2. SEED VALIDATION SETTINGS
    // ============================================================================
    console.log('⚙️  Seeding Validation Settings...');
    
    // Create default validation settings for the active server
    const activeServer = insertedServers.find(s => s.isActive);
    
    if (activeServer) {
      // Check if settings already exist for this server
      const existingSettings = await db.select()
        .from(validationSettings)
        .where(eq(validationSettings.serverId, activeServer.id))
        .limit(1);
      
      if (existingSettings.length > 0) {
        console.log(`   ⏭️  Skipped: Settings already exist for ${activeServer.name}`);
      } else {
        const defaultSettings = {
          serverId: activeServer.id,
          aspects: {
            structural: { enabled: true, severity: 'error' },
            profile: { enabled: true, severity: 'warning' },
            terminology: { enabled: true, severity: 'warning' },
            reference: { enabled: true, severity: 'error' },
            businessRules: { enabled: true, severity: 'error' },
            metadata: { enabled: true, severity: 'info' }
          },
          performance: {
            maxConcurrent: 4,
            batchSize: 50
          },
          resourceTypes: {
            enabled: true,
            includedTypes: [],
            excludedTypes: []
          },
          isActive: true,
          createdBy: 'system',
          updatedBy: 'system'
        };
        
        await db.insert(validationSettings).values(defaultSettings);
        console.log(`   ✅ Added: Default validation settings for ${activeServer.name}`);
      }
    } else {
      console.log(`   ⚠️  No active server found, skipping validation settings`);
    }
    
    console.log('\n✅ Validation Settings: Configured\n');
    
    // ============================================================================
    // 3. SUMMARY
    // ============================================================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🎉 Production Database Seeded Successfully!\n');
    console.log('📊 Summary:');
    console.log(`   • FHIR Servers: ${insertedServers.length}`);
    console.log(`   • Active Server: ${activeServer?.name || 'None'}`);
    console.log(`   • Validation Settings: Configured`);
    console.log('\n🔗 Test your setup:');
    console.log('   curl https://records2.dev.medvertical.com/api/servers');
    console.log('   curl https://records2.dev.medvertical.com/api/validation/settings');
    console.log('═══════════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    throw error;
  }
}

// Run the seed
seedProduction()
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

