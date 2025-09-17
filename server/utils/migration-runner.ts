/**
 * Migration Runner for Validation Settings
 * 
 * This utility handles database migrations for the validation settings system,
 * including schema updates, data integrity verification, and rollback capabilities.
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';
import { readFileSync } from 'fs';
import { join } from 'path';

export interface MigrationResult {
  success: boolean;
  migrationName: string;
  version: string;
  executionTimeMs: number;
  errorMessage?: string;
  recordsAffected?: number;
  integrityIssues?: number;
}

export interface MigrationStatus {
  id: number;
  migrationName: string;
  version: string;
  description: string;
  appliedAt: Date;
  appliedBy: string;
  status: 'applied' | 'rolled_back' | 'failed';
  executionTimeMs?: number;
  errorMessage?: string;
}

export class ValidationSettingsMigrationRunner {
  private migrationsPath: string;

  constructor(migrationsPath: string = join(process.cwd(), 'migrations')) {
    this.migrationsPath = migrationsPath;
  }

  /**
   * Run all pending migrations
   */
  async runAllMigrations(appliedBy: string = 'system'): Promise<MigrationResult[]> {
    const results: MigrationResult[] = [];
    
    try {
      // Get list of available migrations
      const availableMigrations = await this.getAvailableMigrations();
      
      // Get list of applied migrations
      const appliedMigrations = await this.getAppliedMigrations();
      
      // Find pending migrations
      const pendingMigrations = availableMigrations.filter(
        migration => !appliedMigrations.some(applied => applied.migrationName === migration.name)
      );

      console.log(`[MigrationRunner] Found ${pendingMigrations.length} pending migrations`);

      // Run each pending migration
      for (const migration of pendingMigrations) {
        console.log(`[MigrationRunner] Running migration: ${migration.name}`);
        const result = await this.runMigration(migration.name, appliedBy);
        results.push(result);
        
        if (!result.success) {
          console.error(`[MigrationRunner] Migration ${migration.name} failed: ${result.errorMessage}`);
          break; // Stop on first failure
        }
      }

      return results;
    } catch (error) {
      console.error('[MigrationRunner] Error running migrations:', error);
      throw error;
    }
  }

  /**
   * Run a specific migration
   */
  async runMigration(migrationName: string, appliedBy: string = 'system'): Promise<MigrationResult> {
    const startTime = Date.now();
    
    try {
      // Read migration file
      const migrationPath = join(this.migrationsPath, `${migrationName}.sql`);
      const migrationSQL = readFileSync(migrationPath, 'utf-8');
      
      // Execute migration
      await db.execute(sql.raw(migrationSQL));
      
      const executionTime = Date.now() - startTime;
      
      // Verify data integrity
      const integrityIssues = await this.verifyDataIntegrity();
      
      // Update migration status
      await this.updateMigrationStatus(migrationName, 'applied', appliedBy, executionTime);
      
      console.log(`[MigrationRunner] Migration ${migrationName} completed successfully in ${executionTime}ms`);
      
      return {
        success: true,
        migrationName,
        version: await this.getMigrationVersion(migrationName),
        executionTimeMs: executionTime,
        integrityIssues
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Update migration status as failed
      await this.updateMigrationStatus(migrationName, 'failed', appliedBy, executionTime, errorMessage);
      
      console.error(`[MigrationRunner] Migration ${migrationName} failed:`, error);
      
      return {
        success: false,
        migrationName,
        version: await this.getMigrationVersion(migrationName),
        executionTimeMs: executionTime,
        errorMessage
      };
    }
  }

  /**
   * Rollback a specific migration
   */
  async rollbackMigration(migrationName: string, appliedBy: string = 'system'): Promise<MigrationResult> {
    const startTime = Date.now();
    
    try {
      // Get migration rollback SQL
      const rollbackSQL = await this.getMigrationRollbackSQL(migrationName);
      
      if (!rollbackSQL) {
        throw new Error(`No rollback SQL found for migration ${migrationName}`);
      }
      
      // Execute rollback
      await db.execute(sql.raw(rollbackSQL));
      
      const executionTime = Date.now() - startTime;
      
      // Update migration status
      await this.updateMigrationStatus(migrationName, 'rolled_back', appliedBy, executionTime);
      
      console.log(`[MigrationRunner] Migration ${migrationName} rolled back successfully in ${executionTime}ms`);
      
      return {
        success: true,
        migrationName,
        version: await this.getMigrationVersion(migrationName),
        executionTimeMs: executionTime
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.error(`[MigrationRunner] Rollback of migration ${migrationName} failed:`, error);
      
      return {
        success: false,
        migrationName,
        version: await this.getMigrationVersion(migrationName),
        executionTimeMs: executionTime,
        errorMessage
      };
    }
  }

  /**
   * Verify data integrity after migration
   */
  async verifyDataIntegrity(): Promise<number> {
    try {
      const result = await db.execute(sql`
        SELECT COUNT(*) as integrity_issues_count 
        FROM verify_validation_settings_integrity() 
        WHERE is_valid = false
      `);
      
      const integrityIssues = result.rows[0]?.integrity_issues_count || 0;
      
      if (integrityIssues > 0) {
        console.warn(`[MigrationRunner] Found ${integrityIssues} data integrity issues`);
      } else {
        console.log('[MigrationRunner] Data integrity verification passed');
      }
      
      return integrityIssues;
    } catch (error) {
      console.error('[MigrationRunner] Error verifying data integrity:', error);
      return -1; // Indicate error
    }
  }

  /**
   * Get migration statistics
   */
  async getMigrationStatistics(): Promise<any> {
    try {
      const result = await db.execute(sql`
        SELECT * FROM get_validation_settings_statistics()
      `);
      
      return result.rows[0];
    } catch (error) {
      console.error('[MigrationRunner] Error getting migration statistics:', error);
      throw error;
    }
  }

  /**
   * Get list of available migrations
   */
  private async getAvailableMigrations(): Promise<Array<{ name: string; path: string }>> {
    // In a real implementation, this would scan the migrations directory
    // For now, return the known migrations
    return [
      { name: '001_rock_solid_validation_settings', path: '001_rock_solid_validation_settings.sql' },
      { name: '002_enhanced_validation_settings_audit_trail', path: '002_enhanced_validation_settings_audit_trail.sql' }
    ];
  }

  /**
   * Get list of applied migrations
   */
  private async getAppliedMigrations(): Promise<MigrationStatus[]> {
    try {
      const result = await db.execute(sql`
        SELECT 
          id,
          migration_name as "migrationName",
          version,
          description,
          applied_at as "appliedAt",
          applied_by as "appliedBy",
          status,
          execution_time_ms as "executionTimeMs",
          error_message as "errorMessage"
        FROM validation_settings_migrations
        ORDER BY applied_at
      `);
      
      return result.rows as MigrationStatus[];
    } catch (error) {
      // If the migrations table doesn't exist yet, return empty array
      console.log('[MigrationRunner] Migrations table not found, assuming no migrations applied');
      return [];
    }
  }

  /**
   * Update migration status
   */
  private async updateMigrationStatus(
    migrationName: string, 
    status: 'applied' | 'rolled_back' | 'failed',
    appliedBy: string,
    executionTimeMs?: number,
    errorMessage?: string
  ): Promise<void> {
    try {
      await db.execute(sql`
        INSERT INTO validation_settings_migrations (
          migration_name, version, description, applied_by, status, execution_time_ms, error_message
        ) VALUES (
          ${migrationName}, 
          ${await this.getMigrationVersion(migrationName)}, 
          ${await this.getMigrationDescription(migrationName)}, 
          ${appliedBy}, 
          ${status}, 
          ${executionTimeMs || null}, 
          ${errorMessage || null}
        )
        ON CONFLICT (migration_name) 
        DO UPDATE SET 
          status = ${status},
          execution_time_ms = ${executionTimeMs || null},
          error_message = ${errorMessage || null}
      `);
    } catch (error) {
      console.error('[MigrationRunner] Error updating migration status:', error);
    }
  }

  /**
   * Get migration version from migration file
   */
  private async getMigrationVersion(migrationName: string): Promise<string> {
    try {
      const migrationPath = join(this.migrationsPath, `${migrationName}.sql`);
      const migrationSQL = readFileSync(migrationPath, 'utf-8');
      
      // Extract version from migration file
      const versionMatch = migrationSQL.match(/-- Version: ([\d.]+)/);
      return versionMatch ? versionMatch[1] : '1.0';
    } catch (error) {
      return '1.0';
    }
  }

  /**
   * Get migration description from migration file
   */
  private async getMigrationDescription(migrationName: string): Promise<string> {
    try {
      const migrationPath = join(this.migrationsPath, `${migrationName}.sql`);
      const migrationSQL = readFileSync(migrationPath, 'utf-8');
      
      // Extract description from migration file
      const descMatch = migrationSQL.match(/-- Description: (.+)/);
      return descMatch ? descMatch[1] : 'Migration';
    } catch (error) {
      return 'Migration';
    }
  }

  /**
   * Get migration rollback SQL
   */
  private async getMigrationRollbackSQL(migrationName: string): Promise<string | null> {
    try {
      const migrationPath = join(this.migrationsPath, `${migrationName}.sql`);
      const migrationSQL = readFileSync(migrationPath, 'utf-8');
      
      // Extract rollback SQL from migration file
      const rollbackMatch = migrationSQL.match(/-- ROLLBACK SCRIPT.*?```(.*?)```/s);
      return rollbackMatch ? rollbackMatch[1].trim() : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if migrations table exists
   */
  async checkMigrationsTable(): Promise<boolean> {
    try {
      await db.execute(sql`
        SELECT 1 FROM validation_settings_migrations LIMIT 1
      `);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Initialize migrations table if it doesn't exist
   */
  async initializeMigrationsTable(): Promise<void> {
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS validation_settings_migrations (
          id SERIAL PRIMARY KEY,
          migration_name VARCHAR(255) NOT NULL UNIQUE,
          version VARCHAR(50) NOT NULL,
          description TEXT,
          applied_at TIMESTAMP DEFAULT NOW(),
          applied_by VARCHAR(255),
          rollback_sql TEXT,
          status VARCHAR(20) DEFAULT 'applied' CHECK (status IN ('applied', 'rolled_back', 'failed')),
          execution_time_ms INTEGER,
          error_message TEXT
        )
      `);
      
      console.log('[MigrationRunner] Migrations table initialized');
    } catch (error) {
      console.error('[MigrationRunner] Error initializing migrations table:', error);
      throw error;
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let migrationRunnerInstance: ValidationSettingsMigrationRunner | null = null;

export function getMigrationRunner(): ValidationSettingsMigrationRunner {
  if (!migrationRunnerInstance) {
    migrationRunnerInstance = new ValidationSettingsMigrationRunner();
  }
  return migrationRunnerInstance;
}

// ============================================================================
// CLI Interface
// ============================================================================

if (require.main === module) {
  const command = process.argv[2];
  const migrationName = process.argv[3];
  
  const runner = getMigrationRunner();
  
  switch (command) {
    case 'run':
      runner.runAllMigrations('cli').then(results => {
        console.log('Migration results:', results);
        process.exit(0);
      }).catch(error => {
        console.error('Migration failed:', error);
        process.exit(1);
      });
      break;
      
    case 'rollback':
      if (!migrationName) {
        console.error('Migration name required for rollback');
        process.exit(1);
      }
      runner.rollbackMigration(migrationName, 'cli').then(result => {
        console.log('Rollback result:', result);
        process.exit(result.success ? 0 : 1);
      }).catch(error => {
        console.error('Rollback failed:', error);
        process.exit(1);
      });
      break;
      
    case 'verify':
      runner.verifyDataIntegrity().then(issues => {
        console.log(`Data integrity issues: ${issues}`);
        process.exit(issues > 0 ? 1 : 0);
      }).catch(error => {
        console.error('Verification failed:', error);
        process.exit(1);
      });
      break;
      
    case 'stats':
      runner.getMigrationStatistics().then(stats => {
        console.log('Migration statistics:', stats);
        process.exit(0);
      }).catch(error => {
        console.error('Failed to get statistics:', error);
        process.exit(1);
      });
      break;
      
    default:
      console.log('Usage: node migration-runner.js [run|rollback|verify|stats] [migration-name]');
      process.exit(1);
  }
}
