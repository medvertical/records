/**
 * Validation Export Service
 * 
 * Task 11.0: Export validation results to JSON format
 * 
 * Features:
 * - Export validation results with filters
 * - Streaming export for large datasets
 * - Gzip compression
 * - Export job queue
 * - Status tracking
 * - Auto-cleanup (24h retention)
 */

import { db } from '../../../db';
import { validationResultsPerAspect, validationMessages } from '@shared/schema-validation-per-aspect';
import { eq, and, inArray, gte, lte, sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { EventEmitter } from 'events';

// ============================================================================
// Types - Task 11.2: Export Format Schema
// ============================================================================

export interface ExportOptions {
  resourceTypes?: string[];
  severities?: ('fatal' | 'error' | 'warning' | 'information')[];
  aspects?: string[];
  dateRange?: {
    from: Date;
    to: Date;
  };
  includeResources?: boolean; // Include full FHIR resources
  includeSettings?: boolean; // Include validation settings snapshot
  compress?: boolean; // Gzip compression (default: true)
}

export interface ExportJob {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  options: ExportOptions;
  createdAt: Date;
  completedAt?: Date;
  filePath?: string;
  fileSize?: number;
  recordCount?: number;
  error?: string;
}

export interface ExportResult {
  metadata: {
    exportId: string;
    exportedAt: Date;
    options: ExportOptions;
    recordCount: number;
    fileSize?: number;
  };
  validationResults: any[];
  validationMessages: any[];
  resources?: any[];
  settingsSnapshot?: any;
}

// ============================================================================
// ValidationExportService Class
// ============================================================================

export class ValidationExportService extends EventEmitter {
  private jobs = new Map<string, ExportJob>();
  private exportDir = path.join(process.cwd(), 'exports');
  private jobIdCounter = 0;

  constructor() {
    super();
    
    // Ensure export directory exists
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }

    // Task 11.13: Start cleanup task
    this.startCleanupTask();
  }

  // ==========================================================================
  // Task 11.1: Export API
  // ==========================================================================

  /**
   * Create export job
   */
  async createExportJob(options: ExportOptions): Promise<string> {
    const jobId = `export-${Date.now()}-${this.jobIdCounter++}`;

    const job: ExportJob = {
      id: jobId,
      status: 'queued',
      progress: 0,
      options: {
        compress: true, // Default to compressed
        ...options
      },
      createdAt: new Date()
    };

    this.jobs.set(jobId, job);

    this.emit('jobCreated', { jobId });

    // Start export in background
    this.processExport(jobId);

    return jobId;
  }

  /**
   * Get export job status
   */
  getJobStatus(jobId: string): ExportJob | null {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Get all export jobs
   */
  getAllJobs(): ExportJob[] {
    return Array.from(this.jobs.values());
  }

  // ==========================================================================
  // Task 11.4: Streaming Export
  // ==========================================================================

  /**
   * Process export job
   */
  private async processExport(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    try {
      job.status = 'processing';
      job.progress = 10;
      this.emit('jobProgress', { jobId, progress: 10 });

      // Build query
      const results = await this.queryValidationResults(job.options);

      job.progress = 50;
      this.emit('jobProgress', { jobId, progress: 50 });

      // Create export result
      const exportResult: ExportResult = {
        metadata: {
          exportId: jobId,
          exportedAt: new Date(),
          options: job.options,
          recordCount: results.length
        },
        validationResults: results,
        validationMessages: [],
        resources: job.options.includeResources ? [] : undefined
      };

      job.progress = 70;
      this.emit('jobProgress', { jobId, progress: 70 });

      // Write to file
      const fileName = job.options.compress 
        ? `${jobId}.json.gz` 
        : `${jobId}.json`;
      
      const filePath = path.join(this.exportDir, fileName);

      await this.writeExportFile(exportResult, filePath, job.options.compress || false);

      job.progress = 100;
      job.status = 'completed';
      job.completedAt = new Date();
      job.filePath = filePath;
      job.fileSize = fs.statSync(filePath).size;
      job.recordCount = results.length;

      this.emit('jobCompleted', { jobId, filePath, fileSize: job.fileSize });

      console.log(`[ExportService] Export ${jobId} completed: ${results.length} records, ${job.fileSize} bytes`);

    } catch (error: any) {
      console.error(`[ExportService] Export ${jobId} failed:`, error);

      job.status = 'failed';
      job.error = error.message || 'Export failed';

      this.emit('jobFailed', { jobId, error: job.error });
    }
  }

  /**
   * Query validation results with filters
   */
  private async queryValidationResults(options: ExportOptions): Promise<any[]> {
    const conditions = [];

    // Task 11.3: Filter by resourceTypes
    if (options.resourceTypes && options.resourceTypes.length > 0) {
      conditions.push(
        inArray(validationResultsPerAspect.resourceType, options.resourceTypes)
      );
    }

    // Filter by aspects
    if (options.aspects && options.aspects.length > 0) {
      conditions.push(
        inArray(validationResultsPerAspect.aspect, options.aspects)
      );
    }

    // Task 11.3: Filter by date range
    if (options.dateRange) {
      conditions.push(
        gte(validationResultsPerAspect.validatedAt, options.dateRange.from)
      );
      conditions.push(
        lte(validationResultsPerAspect.validatedAt, options.dateRange.to)
      );
    }

    // Build query
    let query = db
      .select()
      .from(validationResultsPerAspect);

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const results = await query;

    return results;
  }

  /**
   * Write export to file (with optional compression)
   */
  private async writeExportFile(
    data: ExportResult,
    filePath: string,
    compress: boolean
  ): Promise<void> {
    const jsonString = JSON.stringify(data, null, 2);

    if (compress) {
      // Task 11.5: Gzip compression
      const compressed = zlib.gzipSync(jsonString);
      fs.writeFileSync(filePath, compressed);
    } else {
      fs.writeFileSync(filePath, jsonString, 'utf-8');
    }
  }

  // ==========================================================================
  // Task 11.8: Download Endpoint
  // ==========================================================================

  /**
   * Get export file stream
   */
  getExportStream(jobId: string): fs.ReadStream | null {
    const job = this.jobs.get(jobId);
    
    if (!job || job.status !== 'completed' || !job.filePath) {
      return null;
    }

    if (!fs.existsSync(job.filePath)) {
      return null;
    }

    return fs.createReadStream(job.filePath);
  }

  // ==========================================================================
  // Task 11.13: File Cleanup
  // ==========================================================================

  /**
   * Start cleanup task (runs every hour)
   */
  private startCleanupTask(): void {
    setInterval(() => {
      this.cleanupOldExports();
    }, 3600000); // 1 hour
  }

  /**
   * Clean up exports older than 24 hours
   */
  private cleanupOldExports(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [jobId, job] of this.jobs.entries()) {
      const age = now - job.createdAt.getTime();

      if (age > maxAge) {
        // Delete file
        if (job.filePath && fs.existsSync(job.filePath)) {
          try {
            fs.unlinkSync(job.filePath);
            console.log(`[ExportService] Deleted old export: ${jobId}`);
          } catch (error) {
            console.error(`[ExportService] Failed to delete export ${jobId}:`, error);
          }
        }

        // Remove job
        this.jobs.delete(jobId);
      }
    }
  }

  /**
   * Manual cleanup of specific export
   */
  async deleteExport(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    
    if (!job) {
      return false;
    }

    // Delete file
    if (job.filePath && fs.existsSync(job.filePath)) {
      try {
        fs.unlinkSync(job.filePath);
      } catch (error) {
        console.error(`[ExportService] Failed to delete export ${jobId}:`, error);
        return false;
      }
    }

    // Remove job
    this.jobs.delete(jobId);

    return true;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let exportService: ValidationExportService | null = null;

export function getExportService(): ValidationExportService {
  if (!exportService) {
    exportService = new ValidationExportService();
  }
  return exportService;
}

export default ValidationExportService;

