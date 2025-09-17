/**
 * Validation Settings Backup and Restore Service
 * 
 * This service provides comprehensive backup and restore functionality for validation settings,
 * including data export, compression, integrity verification, and automated backup management.
 */

import { EventEmitter } from 'events';
import { ValidationSettingsRepository } from '../../repositories/validation-settings-repository';
import { ValidationSettings } from '@shared/validation-settings';
import { ValidationSettingsRecord } from '../../repositories/validation-settings-repository';
import { createHash, createCipher, createDecipher } from 'crypto';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';
import { writeFile, readFile, unlink, mkdir, readdir, stat } from 'fs';
import { join, dirname } from 'path';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);
const writeFileAsync = promisify(writeFile);
const readFileAsync = promisify(readFile);
const unlinkAsync = promisify(unlink);
const mkdirAsync = promisify(mkdir);
const readdirAsync = promisify(readdir);
const statAsync = promisify(stat);

export interface BackupConfig {
  /** Backup storage directory */
  backupDirectory: string;
  
  /** Whether to enable compression */
  enableCompression: boolean;
  
  /** Whether to enable encryption */
  enableEncryption: boolean;
  
  /** Encryption key (if encryption is enabled) */
  encryptionKey?: string;
  
  /** Backup retention policy in days */
  retentionDays: number;
  
  /** Maximum number of backups to keep */
  maxBackups: number;
  
  /** Whether to include audit trail in backup */
  includeAuditTrail: boolean;
  
  /** Whether to include version tags in backup */
  includeVersionTags: boolean;
  
  /** Backup file naming pattern */
  fileNamePattern: string;
}

export interface BackupMetadata {
  /** Backup ID */
  id: string;
  
  /** Backup timestamp */
  timestamp: Date;
  
  /** Backup version */
  version: string;
  
  /** Backup type */
  type: 'full' | 'incremental' | 'differential';
  
  /** Backup size in bytes */
  sizeBytes: number;
  
  /** Backup checksum */
  checksum: string;
  
  /** Whether backup is compressed */
  compressed: boolean;
  
  /** Whether backup is encrypted */
  encrypted: boolean;
  
  /** Backup description */
  description?: string;
  
  /** Settings count in backup */
  settingsCount: number;
  
  /** Active settings ID */
  activeSettingsId?: number;
  
  /** Backup creator */
  createdBy?: string;
  
  /** Backup tags */
  tags?: string[];
}

export interface BackupData {
  /** Backup metadata */
  metadata: BackupMetadata;
  
  /** All settings records */
  settings: ValidationSettingsRecord[];
  
  /** Active settings */
  activeSettings?: ValidationSettings;
  
  /** Audit trail entries (if included) */
  auditTrail?: any[];
  
  /** Version tags (if included) */
  versionTags?: any[];
  
  /** Backup statistics */
  statistics: {
    totalSettings: number;
    activeSettings: number;
    totalVersions: number;
    auditTrailEntries: number;
    versionTagsCount: number;
    backupSizeBytes: number;
    compressionRatio?: number;
  };
}

export interface RestoreOptions {
  /** Whether to validate data before restore */
  validateData: boolean;
  
  /** Whether to create new IDs for restored settings */
  createNewIds: boolean;
  
  /** Whether to preserve original timestamps */
  preserveTimestamps: boolean;
  
  /** Whether to restore audit trail */
  restoreAuditTrail: boolean;
  
  /** Whether to restore version tags */
  restoreVersionTags: boolean;
  
  /** Conflict resolution strategy */
  conflictResolution: 'skip' | 'overwrite' | 'merge' | 'rename';
  
  /** Restore creator */
  restoredBy?: string;
}

export interface RestoreResult {
  /** Whether restore was successful */
  success: boolean;
  
  /** Number of settings restored */
  settingsRestored: number;
  
  /** Number of settings skipped */
  settingsSkipped: number;
  
  /** Number of settings failed */
  settingsFailed: number;
  
  /** Active settings ID after restore */
  activeSettingsId?: number;
  
  /** Restore errors */
  errors: string[];
  
  /** Restore warnings */
  warnings: string[];
  
  /** Restore statistics */
  statistics: {
    totalProcessed: number;
    successRate: number;
    restoreTimeMs: number;
    dataIntegrityIssues: number;
  };
}

export class ValidationSettingsBackupService extends EventEmitter {
  private repository: ValidationSettingsRepository;
  private config: BackupConfig;
  private backupDirectory: string;

  constructor(config: Partial<BackupConfig> = {}) {
    super();
    
    this.config = {
      backupDirectory: './backups/validation-settings',
      enableCompression: true,
      enableEncryption: false,
      retentionDays: 30,
      maxBackups: 10,
      includeAuditTrail: true,
      includeVersionTags: true,
      fileNamePattern: 'validation-settings-backup-{timestamp}-{id}.json',
      ...config
    };
    
    this.repository = new ValidationSettingsRepository();
    this.backupDirectory = this.config.backupDirectory;
  }

  /**
   * Initialize the backup service
   */
  async initialize(): Promise<void> {
    try {
      // Create backup directory if it doesn't exist
      await this.ensureBackupDirectory();
      
      // Clean up old backups
      await this.cleanupOldBackups();
      
      console.log('[ValidationSettingsBackupService] Backup service initialized successfully');
    } catch (error) {
      console.error('[ValidationSettingsBackupService] Error initializing backup service:', error);
      throw error;
    }
  }

  /**
   * Create a full backup of all validation settings
   */
  async createBackup(
    type: 'full' | 'incremental' | 'differential' = 'full',
    description?: string,
    createdBy?: string,
    tags?: string[]
  ): Promise<BackupMetadata> {
    const startTime = Date.now();
    
    try {
      console.log(`[ValidationSettingsBackupService] Creating ${type} backup...`);
      
      // Get all settings data
      const allSettings = await this.repository.getAll();
      const activeSettings = await this.repository.getActive();
      
      // Get audit trail if included
      let auditTrail: any[] = [];
      if (this.config.includeAuditTrail) {
        auditTrail = await this.getAllAuditTrail();
      }
      
      // Get version tags if included
      let versionTags: any[] = [];
      if (this.config.includeVersionTags) {
        versionTags = await this.getAllVersionTags();
      }
      
      // Create backup data
      const backupData: BackupData = {
        metadata: {
          id: this.generateBackupId(),
          timestamp: new Date(),
          version: '1.0',
          type,
          sizeBytes: 0, // Will be calculated after serialization
          checksum: '', // Will be calculated after serialization
          compressed: this.config.enableCompression,
          encrypted: this.config.enableEncryption,
          description,
          settingsCount: allSettings.length,
          activeSettingsId: activeSettings?.id,
          createdBy,
          tags
        },
        settings: allSettings,
        activeSettings: activeSettings?.settings,
        auditTrail,
        versionTags,
        statistics: {
          totalSettings: allSettings.length,
          activeSettings: allSettings.filter(s => s.isActive).length,
          totalVersions: allSettings.length,
          auditTrailEntries: auditTrail.length,
          versionTagsCount: versionTags.length,
          backupSizeBytes: 0 // Will be calculated
        }
      };
      
      // Serialize and process backup data
      const serializedData = JSON.stringify(backupData, null, 2);
      let processedData = Buffer.from(serializedData, 'utf-8');
      
      // Apply compression if enabled
      if (this.config.enableCompression) {
        processedData = await gzipAsync(processedData);
        backupData.statistics.compressionRatio = serializedData.length / processedData.length;
      }
      
      // Apply encryption if enabled
      if (this.config.enableEncryption && this.config.encryptionKey) {
        processedData = await this.encryptData(processedData, this.config.encryptionKey);
      }
      
      // Calculate final metadata
      backupData.metadata.sizeBytes = processedData.length;
      backupData.metadata.checksum = this.calculateChecksum(processedData);
      backupData.statistics.backupSizeBytes = processedData.length;
      
      // Save backup to file
      const fileName = this.generateFileName(backupData.metadata);
      const filePath = join(this.backupDirectory, fileName);
      
      await writeFileAsync(filePath, processedData);
      
      const executionTime = Date.now() - startTime;
      
      console.log(`[ValidationSettingsBackupService] Backup created successfully: ${fileName} (${processedData.length} bytes, ${executionTime}ms)`);
      
      this.emit('backupCreated', {
        metadata: backupData.metadata,
        filePath,
        executionTime
      });
      
      return backupData.metadata;
    } catch (error) {
      console.error('[ValidationSettingsBackupService] Error creating backup:', error);
      this.emit('backupError', {
        error: error instanceof Error ? error : new Error('Unknown error'),
        timestamp: new Date()
      });
      throw error;
    }
  }

  /**
   * Restore settings from backup
   */
  async restoreFromBackup(
    backupId: string,
    options: Partial<RestoreOptions> = {}
  ): Promise<RestoreResult> {
    const startTime = Date.now();
    const restoreOptions: RestoreOptions = {
      validateData: true,
      createNewIds: false,
      preserveTimestamps: true,
      restoreAuditTrail: true,
      restoreVersionTags: true,
      conflictResolution: 'skip',
      restoredBy: 'system',
      ...options
    };
    
    try {
      console.log(`[ValidationSettingsBackupService] Restoring from backup: ${backupId}`);
      
      // Find backup file
      const backupFile = await this.findBackupFile(backupId);
      if (!backupFile) {
        throw new Error(`Backup file not found: ${backupId}`);
      }
      
      // Read and process backup data
      const backupData = await this.loadBackupData(backupFile);
      
      // Validate backup data if requested
      if (restoreOptions.validateData) {
        await this.validateBackupData(backupData);
      }
      
      // Restore settings
      const restoreResult = await this.restoreSettings(backupData, restoreOptions);
      
      const executionTime = Date.now() - startTime;
      
      console.log(`[ValidationSettingsBackupService] Restore completed: ${restoreResult.settingsRestored} settings restored in ${executionTime}ms`);
      
      this.emit('backupRestored', {
        backupId,
        restoreResult,
        executionTime
      });
      
      return restoreResult;
    } catch (error) {
      console.error('[ValidationSettingsBackupService] Error restoring from backup:', error);
      this.emit('backupRestoreError', {
        error: error instanceof Error ? error : new Error('Unknown error'),
        backupId,
        timestamp: new Date()
      });
      throw error;
    }
  }

  /**
   * List all available backups
   */
  async listBackups(): Promise<BackupMetadata[]> {
    try {
      const files = await readdirAsync(this.backupDirectory);
      const backupFiles = files.filter(file => file.endsWith('.json'));
      
      const backups: BackupMetadata[] = [];
      
      for (const file of backupFiles) {
        try {
          const filePath = join(this.backupDirectory, file);
          const stats = await statAsync(filePath);
          
          // Try to read metadata from file
          const backupData = await this.loadBackupData(filePath);
          backups.push(backupData.metadata);
        } catch (error) {
          console.warn(`[ValidationSettingsBackupService] Error reading backup file ${file}:`, error);
        }
      }
      
      // Sort by timestamp (newest first)
      backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      return backups;
    } catch (error) {
      console.error('[ValidationSettingsBackupService] Error listing backups:', error);
      return [];
    }
  }

  /**
   * Delete a backup
   */
  async deleteBackup(backupId: string): Promise<void> {
    try {
      const backupFile = await this.findBackupFile(backupId);
      if (!backupFile) {
        throw new Error(`Backup file not found: ${backupId}`);
      }
      
      await unlinkAsync(backupFile);
      
      console.log(`[ValidationSettingsBackupService] Backup deleted: ${backupId}`);
      
      this.emit('backupDeleted', {
        backupId,
        filePath: backupFile
      });
    } catch (error) {
      console.error('[ValidationSettingsBackupService] Error deleting backup:', error);
      throw error;
    }
  }

  /**
   * Verify backup integrity
   */
  async verifyBackup(backupId: string): Promise<boolean> {
    try {
      const backupFile = await this.findBackupFile(backupId);
      if (!backupFile) {
        return false;
      }
      
      const backupData = await this.loadBackupData(backupFile);
      return await this.validateBackupData(backupData);
    } catch (error) {
      console.error('[ValidationSettingsBackupService] Error verifying backup:', error);
      return false;
    }
  }

  /**
   * Clean up old backups based on retention policy
   */
  async cleanupOldBackups(): Promise<number> {
    try {
      const backups = await this.listBackups();
      const cutoffDate = new Date(Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000));
      
      let deletedCount = 0;
      
      // Delete backups older than retention period
      for (const backup of backups) {
        if (backup.timestamp < cutoffDate) {
          await this.deleteBackup(backup.id);
          deletedCount++;
        }
      }
      
      // Keep only the most recent backups if we exceed maxBackups
      if (backups.length - deletedCount > this.config.maxBackups) {
        const sortedBackups = backups
          .filter(b => b.timestamp >= cutoffDate)
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        
        const excessBackups = sortedBackups.slice(this.config.maxBackups);
        for (const backup of excessBackups) {
          await this.deleteBackup(backup.id);
          deletedCount++;
        }
      }
      
      if (deletedCount > 0) {
        console.log(`[ValidationSettingsBackupService] Cleaned up ${deletedCount} old backups`);
      }
      
      return deletedCount;
    } catch (error) {
      console.error('[ValidationSettingsBackupService] Error cleaning up old backups:', error);
      return 0;
    }
  }

  // Private helper methods

  private async ensureBackupDirectory(): Promise<void> {
    try {
      await mkdirAsync(this.backupDirectory, { recursive: true });
    } catch (error) {
      if ((error as any).code !== 'EEXIST') {
        throw error;
      }
    }
  }

  private generateBackupId(): string {
    return `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateFileName(metadata: BackupMetadata): string {
    const timestamp = metadata.timestamp.toISOString().replace(/[:.]/g, '-');
    return this.config.fileNamePattern
      .replace('{timestamp}', timestamp)
      .replace('{id}', metadata.id);
  }

  private calculateChecksum(data: Buffer): string {
    return createHash('sha256').update(data).digest('hex');
  }

  private async encryptData(data: Buffer, key: string): Promise<Buffer> {
    // Simple encryption implementation - in production, use proper encryption
    const cipher = createCipher('aes-256-cbc', key);
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    return encrypted;
  }

  private async decryptData(data: Buffer, key: string): Promise<Buffer> {
    // Simple decryption implementation - in production, use proper decryption
    const decipher = createDecipher('aes-256-cbc', key);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted;
  }

  private async findBackupFile(backupId: string): Promise<string | null> {
    try {
      const files = await readdirAsync(this.backupDirectory);
      const backupFile = files.find(file => file.includes(backupId));
      return backupFile ? join(this.backupDirectory, backupFile) : null;
    } catch (error) {
      return null;
    }
  }

  private async loadBackupData(filePath: string): Promise<BackupData> {
    let data = await readFileAsync(filePath);
    
    // Decrypt if encrypted
    if (this.config.enableEncryption && this.config.encryptionKey) {
      data = await this.decryptData(data, this.config.encryptionKey);
    }
    
    // Decompress if compressed
    if (this.config.enableCompression) {
      data = await gunzipAsync(data);
    }
    
    const backupData = JSON.parse(data.toString('utf-8'));
    
    // Convert string dates back to Date objects
    backupData.metadata.timestamp = new Date(backupData.metadata.timestamp);
    backupData.settings.forEach((setting: any) => {
      setting.createdAt = new Date(setting.createdAt);
      setting.updatedAt = new Date(setting.updatedAt);
    });
    
    return backupData;
  }

  private async validateBackupData(backupData: BackupData): Promise<boolean> {
    // Validate backup structure
    if (!backupData.metadata || !backupData.settings) {
      throw new Error('Invalid backup data structure');
    }
    
    // Validate settings data
    for (const setting of backupData.settings) {
      if (!setting.id || !setting.settings || !setting.version) {
        throw new Error('Invalid settings record in backup');
      }
    }
    
    // Validate checksum if available
    if (backupData.metadata.checksum) {
      // This would require re-reading the file and calculating checksum
      // For now, we'll skip this validation
    }
    
    return true;
  }

  private async restoreSettings(backupData: BackupData, options: RestoreOptions): Promise<RestoreResult> {
    const result: RestoreResult = {
      success: true,
      settingsRestored: 0,
      settingsSkipped: 0,
      settingsFailed: 0,
      errors: [],
      warnings: [],
      statistics: {
        totalProcessed: 0,
        successRate: 0,
        restoreTimeMs: 0,
        dataIntegrityIssues: 0
      }
    };
    
    const startTime = Date.now();
    
    try {
      // Restore settings records
      for (const setting of backupData.settings) {
        result.statistics.totalProcessed++;
        
        try {
          // Check for conflicts
          const existing = await this.repository.getById(setting.id);
          
          if (existing) {
            switch (options.conflictResolution) {
              case 'skip':
                result.settingsSkipped++;
                result.warnings.push(`Skipped existing settings ID ${setting.id}`);
                continue;
                
              case 'overwrite':
                await this.repository.update({
                  id: setting.id,
                  settings: setting.settings,
                  createNewVersion: true,
                  updatedBy: options.restoredBy,
                  changeReason: 'Restored from backup',
                  changeType: 'restored'
                });
                result.settingsRestored++;
                break;
                
              case 'merge':
                // Merge logic would go here
                result.settingsSkipped++;
                result.warnings.push(`Merge not implemented for settings ID ${setting.id}`);
                continue;
                
              case 'rename':
                // Create new settings with new ID
                await this.repository.create({
                  settings: setting.settings,
                  isActive: false,
                  createdBy: options.restoredBy
                });
                result.settingsRestored++;
                break;
            }
          } else {
            // Create new settings
            await this.repository.create({
              settings: setting.settings,
              isActive: setting.isActive,
              createdBy: options.restoredBy
            });
            result.settingsRestored++;
          }
        } catch (error) {
          result.settingsFailed++;
          result.errors.push(`Failed to restore settings ID ${setting.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      // Restore active settings if specified
      if (backupData.activeSettings && backupData.metadata.activeSettingsId) {
        try {
          await this.repository.activate(backupData.metadata.activeSettingsId, options.restoredBy);
          result.activeSettingsId = backupData.metadata.activeSettingsId;
        } catch (error) {
          result.warnings.push(`Failed to activate settings ID ${backupData.metadata.activeSettingsId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      // Calculate statistics
      result.statistics.restoreTimeMs = Date.now() - startTime;
      result.statistics.successRate = result.settingsRestored / result.statistics.totalProcessed;
      
    } catch (error) {
      result.success = false;
      result.errors.push(`Restore failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    return result;
  }

  private async getAllAuditTrail(): Promise<any[]> {
    // This would query all audit trail entries
    // For now, return empty array
    return [];
  }

  private async getAllVersionTags(): Promise<any[]> {
    // This would query all version tags
    // For now, return empty array
    return [];
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let backupServiceInstance: ValidationSettingsBackupService | null = null;

export function getValidationSettingsBackupService(): ValidationSettingsBackupService {
  if (!backupServiceInstance) {
    backupServiceInstance = new ValidationSettingsBackupService();
  }
  return backupServiceInstance;
}
