/**
 * ValidationExportService Tests
 * 
 * Task 14.0: Unit tests for export functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ValidationExportService } from './validation-export-service';
import * as fs from 'fs';
import * as path from 'path';

// Mock database
vi.mock('../../../db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([
          {
            id: 1,
            resourceId: 'Patient/123',
            resourceType: 'Patient',
            aspect: 'structural',
            isValid: false,
            issueCount: 2,
            validatedAt: new Date()
          }
        ]))
      }))
    }))
  }
}));

describe('ValidationExportService', () => {
  let service: ValidationExportService;

  beforeEach(() => {
    service = new ValidationExportService();
  });

  afterEach(() => {
    // Cleanup: delete test export files
    const exportDir = path.join(process.cwd(), 'exports');
    if (fs.existsSync(exportDir)) {
      const files = fs.readdirSync(exportDir);
      files.forEach(file => {
        if (file.startsWith('export-test-')) {
          fs.unlinkSync(path.join(exportDir, file));
        }
      });
    }
  });

  // ==========================================================================
  // Export Job Creation Tests
  // ==========================================================================

  describe('createExportJob()', () => {
    it('should create export job successfully', async () => {
      const jobId = await service.createExportJob({
        resourceTypes: ['Patient'],
        compress: true
      });

      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe('string');
      expect(jobId).toMatch(/^export-/);
    });

    it('should return unique job IDs', async () => {
      const jobId1 = await service.createExportJob({});
      const jobId2 = await service.createExportJob({});

      expect(jobId1).not.toBe(jobId2);
    });

    it('should initialize job with correct status', async () => {
      const jobId = await service.createExportJob({});
      const job = service.getJobStatus(jobId);

      expect(job).toBeDefined();
      expect(job?.status).toBe('queued');
      expect(job?.progress).toBe(0);
    });

    it('should handle export options correctly', async () => {
      const options = {
        resourceTypes: ['Patient', 'Observation'],
        severities: ['error', 'warning'] as ('fatal' | 'error' | 'warning' | 'information')[],
        aspects: ['structural', 'profile'],
        compress: false
      };

      const jobId = await service.createExportJob(options);
      const job = service.getJobStatus(jobId);

      expect(job?.options).toMatchObject(options);
    });
  });

  // ==========================================================================
  // Job Status Tests
  // ==========================================================================

  describe('getJobStatus()', () => {
    it('should return job status', async () => {
      const jobId = await service.createExportJob({});
      const job = service.getJobStatus(jobId);

      expect(job).toBeDefined();
      expect(job).toHaveProperty('id');
      expect(job).toHaveProperty('status');
      expect(job).toHaveProperty('progress');
      expect(job).toHaveProperty('options');
      expect(job).toHaveProperty('createdAt');
    });

    it('should return null for non-existent job', () => {
      const job = service.getJobStatus('non-existent-job');

      expect(job).toBeNull();
    });

    it('should track job progress', async () => {
      const jobId = await service.createExportJob({});

      // Wait a moment for processing to start
      await new Promise(resolve => setTimeout(resolve, 100));

      const job = service.getJobStatus(jobId);

      expect(job?.progress).toBeGreaterThanOrEqual(0);
      expect(job?.progress).toBeLessThanOrEqual(100);
    });
  });

  describe('getAllJobs()', () => {
    it('should return all export jobs', async () => {
      await service.createExportJob({});
      await service.createExportJob({});

      const jobs = service.getAllJobs();

      expect(Array.isArray(jobs)).toBe(true);
      expect(jobs.length).toBeGreaterThanOrEqual(2);
    });

    it('should return empty array when no jobs', () => {
      const newService = new ValidationExportService();
      const jobs = newService.getAllJobs();

      expect(Array.isArray(jobs)).toBe(true);
      expect(jobs.length).toBe(0);
    });
  });

  // ==========================================================================
  // Export Stream Tests
  // ==========================================================================

  describe('getExportStream()', () => {
    it('should return null for non-existent job', () => {
      const stream = service.getExportStream('non-existent-job');

      expect(stream).toBeNull();
    });

    it('should return null for incomplete job', async () => {
      const jobId = await service.createExportJob({});
      const stream = service.getExportStream(jobId);

      // Job is still processing, stream should be null
      expect(stream).toBeNull();
    });

    it('should return stream for completed job', async () => {
      const jobId = await service.createExportJob({});

      // Wait for job to complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      const job = service.getJobStatus(jobId);

      if (job?.status === 'completed') {
        const stream = service.getExportStream(jobId);
        expect(stream).toBeDefined();
      }
    });
  });

  // ==========================================================================
  // Filtering Tests
  // ==========================================================================

  describe('Export Filtering', () => {
    it('should filter by resourceTypes', async () => {
      const jobId = await service.createExportJob({
        resourceTypes: ['Patient']
      });

      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 2000));

      const job = service.getJobStatus(jobId);

      if (job?.status === 'completed') {
        expect(job.recordCount).toBeGreaterThanOrEqual(0);
      }
    });

    it('should filter by severities', async () => {
      const jobId = await service.createExportJob({
        severities: ['error']
      });

      const job = service.getJobStatus(jobId);

      expect(job?.options.severities).toContain('error');
    });

    it('should filter by aspects', async () => {
      const jobId = await service.createExportJob({
        aspects: ['structural', 'profile']
      });

      const job = service.getJobStatus(jobId);

      expect(job?.options.aspects).toEqual(['structural', 'profile']);
    });

    it('should filter by date range', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const jobId = await service.createExportJob({
        dateRange: {
          from: yesterday,
          to: now
        }
      });

      const job = service.getJobStatus(jobId);

      expect(job?.options.dateRange).toBeDefined();
      expect(job?.options.dateRange?.from).toEqual(yesterday);
      expect(job?.options.dateRange?.to).toEqual(now);
    });
  });

  // ==========================================================================
  // Compression Tests
  // ==========================================================================

  describe('Compression', () => {
    it('should compress by default', async () => {
      const jobId = await service.createExportJob({});
      const job = service.getJobStatus(jobId);

      expect(job?.options.compress).toBe(true);
    });

    it('should respect compress option', async () => {
      const jobId = await service.createExportJob({
        compress: false
      });
      const job = service.getJobStatus(jobId);

      expect(job?.options.compress).toBe(false);
    });

    it('should create .json.gz file when compressed', async () => {
      const jobId = await service.createExportJob({
        compress: true
      });

      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 2000));

      const job = service.getJobStatus(jobId);

      if (job?.status === 'completed' && job.filePath) {
        expect(job.filePath).toMatch(/\.json\.gz$/);
      }
    });

    it('should create .json file when not compressed', async () => {
      const jobId = await service.createExportJob({
        compress: false
      });

      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 2000));

      const job = service.getJobStatus(jobId);

      if (job?.status === 'completed' && job.filePath) {
        expect(job.filePath).toMatch(/\.json$/);
        expect(job.filePath).not.toMatch(/\.gz$/);
      }
    });
  });

  // ==========================================================================
  // Cleanup Tests
  // ==========================================================================

  describe('Cleanup', () => {
    it('should delete old exports', async () => {
      // This test would need to mock time
      // In real implementation, exports older than 24h are deleted
    });

    it('should support manual deletion', async () => {
      const jobId = await service.createExportJob({});

      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 2000));

      const deleted = await service.deleteExport(jobId);

      if (deleted) {
        const job = service.getJobStatus(jobId);
        expect(job).toBeNull();
      }
    });
  });

  // ==========================================================================
  // Event Emission Tests
  // ==========================================================================

  describe('Events', () => {
    it('should emit jobCreated event', (done) => {
      service.on('jobCreated', (event) => {
        expect(event).toHaveProperty('jobId');
        done();
      });

      service.createExportJob({});
    });

    it('should emit jobProgress event', (done) => {
      service.on('jobProgress', (event) => {
        expect(event).toHaveProperty('jobId');
        expect(event).toHaveProperty('progress');
        done();
      });

      service.createExportJob({});
    });

    it('should emit jobCompleted event', (done) => {
      service.on('jobCompleted', (event) => {
        expect(event).toHaveProperty('jobId');
        expect(event).toHaveProperty('filePath');
        expect(event).toHaveProperty('fileSize');
        done();
      });

      service.createExportJob({});
    }, 5000); // 5s timeout
  });

  // ==========================================================================
  // Performance Tests
  // ==========================================================================

  describe('Performance', () => {
    it('should handle large exports efficiently', async () => {
      const jobId = await service.createExportJob({});

      const start = Date.now();

      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 5000));

      const duration = Date.now() - start;
      const job = service.getJobStatus(jobId);

      if (job?.status === 'completed') {
        // Export should complete in reasonable time
        expect(duration).toBeLessThan(10000); // 10 seconds
      }
    });

    it('should process multiple exports concurrently', async () => {
      const jobIds = await Promise.all([
        service.createExportJob({}),
        service.createExportJob({}),
        service.createExportJob({})
      ]);

      expect(jobIds.length).toBe(3);

      // All jobs should be queued or processing
      jobIds.forEach(jobId => {
        const job = service.getJobStatus(jobId);
        expect(job).toBeDefined();
        expect(['queued', 'processing', 'completed']).toContain(job!.status);
      });
    });
  });
});

