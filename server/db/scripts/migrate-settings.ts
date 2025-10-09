import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { validationSettings } from '../../../shared/schema';
import { eq } from 'drizzle-orm';
import type { ValidationSettings } from '../../../shared/validation-settings';
import { DEFAULT_VALIDATION_SETTINGS_R4 } from '../../../shared/validation-settings';

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
 * Legacy settings structure (flat structure with direct boolean fields)
 */
interface LegacySettings {
  // Old flat structure
  structural?: { enabled: boolean; severity?: string };
  profile?: { enabled: boolean; severity?: string };
  terminology?: { enabled: boolean; severity?: string };
  reference?: { enabled: boolean; severity?: string };
  businessRule?: { enabled: boolean; severity?: string };
  metadata?: { enabled: boolean; severity?: string };
  
  // Or even older boolean-only structure
  enableStructuralValidation?: boolean;
  enableProfileValidation?: boolean;
  enableTerminologyValidation?: boolean;
  enableReferenceValidation?: boolean;
  enableBusinessRuleValidation?: boolean;
  enableMetadataValidation?: boolean;
  
  // Other legacy fields
  [key: string]: any;
}

/**
 * Convert legacy settings to canonical aspects.* format
 */
function migrateSettingsToCanonical(legacy: any): ValidationSettings {
  const canonical: ValidationSettings = JSON.parse(JSON.stringify(DEFAULT_VALIDATION_SETTINGS));
  
  // Detect format and migrate
  if (legacy.aspects) {
    // Already has aspects structure - just ensure it's complete
    canonical.aspects = {
      structural: legacy.aspects.structural || DEFAULT_VALIDATION_SETTINGS.aspects.structural,
      profile: legacy.aspects.profile || DEFAULT_VALIDATION_SETTINGS.aspects.profile,
      terminology: legacy.aspects.terminology || DEFAULT_VALIDATION_SETTINGS.aspects.terminology,
      reference: legacy.aspects.reference || DEFAULT_VALIDATION_SETTINGS.aspects.reference,
      businessRule: legacy.aspects.businessRule || DEFAULT_VALIDATION_SETTINGS.aspects.businessRule,
      metadata: legacy.aspects.metadata || DEFAULT_VALIDATION_SETTINGS.aspects.metadata,
    };
  } else if (legacy.structural || legacy.profile || legacy.terminology) {
    // Flat structure with aspect objects
    canonical.aspects = {
      structural: {
        enabled: legacy.structural?.enabled ?? true,
        severity: (legacy.structural?.severity as any) || 'error'
      },
      profile: {
        enabled: legacy.profile?.enabled ?? true,
        severity: (legacy.profile?.severity as any) || 'warning'
      },
      terminology: {
        enabled: legacy.terminology?.enabled ?? true,
        severity: (legacy.terminology?.severity as any) || 'warning'
      },
      reference: {
        enabled: legacy.reference?.enabled ?? true,
        severity: (legacy.reference?.severity as any) || 'error'
      },
      businessRule: {
        enabled: legacy.businessRule?.enabled ?? true,
        severity: (legacy.businessRule?.severity as any) || 'error'
      },
      metadata: {
        enabled: legacy.metadata?.enabled ?? true,
        severity: (legacy.metadata?.severity as any) || 'error'
      },
    };
  } else if (legacy.enableStructuralValidation !== undefined) {
    // Very old boolean-only structure
    canonical.aspects = {
      structural: {
        enabled: legacy.enableStructuralValidation ?? true,
        severity: 'error'
      },
      profile: {
        enabled: legacy.enableProfileValidation ?? true,
        severity: 'warning'
      },
      terminology: {
        enabled: legacy.enableTerminologyValidation ?? true,
        severity: 'warning'
      },
      reference: {
        enabled: legacy.enableReferenceValidation ?? true,
        severity: 'error'
      },
      businessRule: {
        enabled: legacy.enableBusinessRuleValidation ?? true,
        severity: 'error'
      },
      metadata: {
        enabled: legacy.enableMetadataValidation ?? true,
        severity: 'error'
      },
    };
  }
  
  // Migrate server settings if present
  if (legacy.server) {
    canonical.server = {
      url: legacy.server.url || canonical.server.url,
      timeout: legacy.server.timeout || canonical.server.timeout,
      retries: legacy.server.retries || canonical.server.retries,
    };
  }
  
  // Migrate performance settings if present
  if (legacy.performance) {
    canonical.performance = {
      maxConcurrent: legacy.performance.maxConcurrent || canonical.performance.maxConcurrent,
      batchSize: legacy.performance.batchSize || canonical.performance.batchSize,
    };
  }
  
  // Migrate resource type settings if present
  if (legacy.resourceTypes) {
    canonical.resourceTypes = {
      enabled: legacy.resourceTypes.enabled ?? canonical.resourceTypes.enabled,
      includedTypes: legacy.resourceTypes.includedTypes || canonical.resourceTypes.includedTypes,
      excludedTypes: legacy.resourceTypes.excludedTypes || canonical.resourceTypes.excludedTypes,
      latestOnly: legacy.resourceTypes.latestOnly ?? canonical.resourceTypes.latestOnly,
    };
  }
  
  return canonical;
}

/**
 * Migrate all validation settings to canonical format
 */
async function migrateAllSettings() {
  try {
    console.log('\n🔄 Migrating validation settings to canonical format...\n');
    
    // Get all validation settings
    const allSettings = await db.select().from(validationSettings);
    
    if (allSettings.length === 0) {
      console.log('⚠️  No settings found in database.');
      console.log('   Creating default settings with canonical format...\n');
      
      const [newSettings] = await db.insert(validationSettings).values({
        version: 1,
        settings: DEFAULT_VALIDATION_SETTINGS as any,
        isActive: true,
        createdBy: 'migration-script',
        updatedBy: 'migration-script',
      }).returning();
      
      console.log('✅ Created default settings (ID:', newSettings.id, ')\n');
      return;
    }
    
    console.log(`Found ${allSettings.length} settings record(s)\n`);
    
    let migratedCount = 0;
    let alreadyCanonicalCount = 0;
    
    for (const setting of allSettings) {
      const legacy = setting.settings as any;
      
      // Check if already in canonical format
      if (legacy.aspects && 
          legacy.aspects.structural && 
          legacy.aspects.profile &&
          legacy.aspects.terminology &&
          legacy.aspects.reference &&
          legacy.aspects.businessRule &&
          legacy.aspects.metadata) {
        console.log(`✓ Settings ID ${setting.id}: Already in canonical format`);
        alreadyCanonicalCount++;
        continue;
      }
      
      // Migrate to canonical format
      console.log(`→ Settings ID ${setting.id}: Migrating...`);
      const canonical = migrateSettingsToCanonical(legacy);
      
      await db.update(validationSettings)
        .set({
          settings: canonical as any,
          updatedBy: 'migration-script',
          updatedAt: new Date(),
        })
        .where(eq(validationSettings.id, setting.id));
      
      console.log(`  ✅ Migrated to canonical format`);
      migratedCount++;
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 Migration Summary:\n');
    console.log(`Total settings: ${allSettings.length}`);
    console.log(`✅ Migrated: ${migratedCount}`);
    console.log(`✓ Already canonical: ${alreadyCanonicalCount}`);
    
    if (migratedCount > 0) {
      console.log('\n🎉 Settings migration completed successfully!');
      console.log('\nCanonical format:');
      console.log('  aspects: {');
      console.log('    structural: { enabled: boolean, severity: string },');
      console.log('    profile: { enabled: boolean, severity: string },');
      console.log('    ... (6 aspects total)');
      console.log('  }');
    } else {
      console.log('\n✨ All settings already in canonical format!');
    }
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

/**
 * Dry-run: Show what would be migrated without changing anything
 */
async function dryRun() {
  try {
    console.log('\n🔍 Dry-run: Analyzing settings migration...\n');
    
    const allSettings = await db.select().from(validationSettings);
    
    if (allSettings.length === 0) {
      console.log('⚠️  No settings found. Would create default canonical settings.');
      return;
    }
    
    console.log(`Found ${allSettings.length} settings record(s)\n`);
    
    for (const setting of allSettings) {
      const legacy = setting.settings as any;
      
      console.log(`Settings ID ${setting.id}:`);
      console.log(`  Active: ${setting.isActive}`);
      console.log(`  Version: ${setting.version}`);
      
      if (legacy.aspects?.structural) {
        console.log('  Format: ✅ Already canonical (aspects.*)');
      } else if (legacy.structural) {
        console.log('  Format: ⚠️  Flat structure (needs migration)');
      } else if (legacy.enableStructuralValidation !== undefined) {
        console.log('  Format: ⚠️  Legacy boolean structure (needs migration)');
      } else {
        console.log('  Format: ⚠️  Unknown structure (will use defaults)');
      }
      
      const canonical = migrateSettingsToCanonical(legacy);
      console.log('  Would migrate to:');
      console.log('    aspects.structural.enabled:', canonical.aspects.structural.enabled);
      console.log('    aspects.profile.enabled:', canonical.aspects.profile.enabled);
      console.log('    aspects.terminology.enabled:', canonical.aspects.terminology.enabled);
      console.log('    ...\n');
    }
    
    console.log('💡 Run without --dry-run to perform actual migration');
    
  } catch (error) {
    console.error('\n❌ Dry-run failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run') || args.includes('-d');
  
  if (isDryRun) {
    await dryRun();
  } else {
    await migrateAllSettings();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
}

export { migrateAllSettings, migrateSettingsToCanonical };
