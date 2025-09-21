import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DatabaseStorage } from '../storage';
import { db } from '../db';
import { validationResults, fhirResources, validationSettings } from '@shared/schema';
import { eq, and, desc, lt } from 'drizzle-orm';

// Mock the database
vi.mock('../db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn()
  }
}));

// Mock the query optimizer
vi.mock('../utils/query-optimizer', () => ({
  queryOptimizer: {
    getValidationResults: vi.fn(),
    getRecentValidationErrors: vi.fn(),
    getResourceStats: vi.fn()
  }
}));

// Mock the cache manager
vi.mock('../utils/cache-manager', () => ({
  cacheManager: {
    clearByTag: vi.fn()
  },
  CACHE_TAGS: {
    VALIDATION_RESULTS: 'validation-results'
  }
}));

// Mock the validation settings service
vi.mock('../services/validation/validation-settings-service', () => ({
  getValidationSettingsService: () => ({
    getActiveSettings: vi.fn().mockResolvedValue({
      settings: {
        structural: { enabled: true, severity: 'error' },
        profile: { enabled: true, severity: 'error' },
        terminology: { enabled: true, severity: 'warning' },
        reference: { enabled: true, severity: 'error' },
        businessRule: { enabled: true, severity: 'warning' },
        metadata: { enabled: true, severity: 'info' }
      }
    })
  })
}));

describe('Validation Result Caching and Persistence', () => {
  let storage: DatabaseStorage;
  let mockDb: any;

  const mockValidationResult = {
    id: 1,
    resourceId: 123,
    settingsHash: 'hash123',
    resourceHash: 'resourceHash123',
    validationEngineVersion: '1.0.0',
    isValid: false,
    hasErrors: true,
    hasWarnings: true,
    errorCount: 2,
    warningCount: 1,
    informationCount: 0,
    validationScore: 75,
    lastValidated: new Date('2024-01-15T10:00:00Z'),
    validatedAt: new Date('2024-01-15T10:00:00Z'),
    performanceMetrics: {
      totalDurationMs: 150,
      aspectBreakdown: {
        structural: { durationMs: 50, issueCount: 1 },
        profile: { durationMs: 40, issueCount: 1 },
        terminology: { durationMs: 30, issueCount: 0 },
        reference: { durationMs: 20, issueCount: 1 },
        businessRule: { durationMs: 10, issueCount: 0 },
        metadata: { durationMs: 0, issueCount: 0 }
      }
    },
    aspectBreakdown: {
      structural: { enabled: true, issueCount: 1, errorCount: 1, warningCount: 0, informationCount: 0, validationScore: 90, passed: false },
      profile: { enabled: true, issueCount: 1, errorCount: 1, warningCount: 0, informationCount: 0, validationScore: 85, passed: false },
      terminology: { enabled: true, issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true },
      reference: { enabled: true, issueCount: 1, errorCount: 0, warningCount: 1, informationCount: 0, validationScore: 95, passed: false },
      businessRule: { enabled: true, issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true },
      metadata: { enabled: true, issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true }
    },
    issues: [
      { aspect: 'structural', severity: 'error', message: 'Structural validation error' },
      { aspect: 'profile', severity: 'error', message: 'Profile validation error' },
      { aspect: 'reference', severity: 'warning', message: 'Reference validation warning' }
    ],
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:00:00Z')
  };

  const mockFhirResource = {
    id: 123,
    serverId: 1,
    resourceType: 'Patient',
    resourceId: 'patient-123',
    data: { id: 'patient-123', resourceType: 'Patient' },
    lastUpdated: new Date('2024-01-15T09:00:00Z'),
    createdAt: new Date('2024-01-15T09:00:00Z'),
    updatedAt: new Date('2024-01-15T09:00:00Z')
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      transaction: vi.fn()
    };
    
    storage = new DatabaseStorage();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Validation Result Storage', () => {
    it('should create validation result successfully', async () => {
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockValidationResult])
        })
      });

      const result = await storage.createValidationResult({
        resourceId: 123,
        settingsHash: 'hash123',
        resourceHash: 'resourceHash123',
        validationEngineVersion: '1.0.0',
        isValid: false,
        hasErrors: true,
        hasWarnings: true,
        errorCount: 2,
        warningCount: 1,
        informationCount: 0,
        validationScore: 75,
        lastValidated: new Date('2024-01-15T10:00:00Z'),
        validatedAt: new Date('2024-01-15T10:00:00Z'),
        performanceMetrics: mockValidationResult.performanceMetrics,
        aspectBreakdown: mockValidationResult.aspectBreakdown,
        issues: mockValidationResult.issues,
        createdAt: new Date('2024-01-15T10:00:00Z'),
        updatedAt: new Date('2024-01-15T10:00:00Z')
      });

      expect(result).toEqual(mockValidationResult);
      expect(mockDb.insert).toHaveBeenCalledWith(validationResults);
    });

    it('should handle validation result creation errors gracefully', async () => {
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(new Error('Database error'))
        })
      });

      await expect(storage.createValidationResult({
        resourceId: 123,
        settingsHash: 'hash123',
        resourceHash: 'resourceHash123',
        validationEngineVersion: '1.0.0',
        isValid: false,
        hasErrors: true,
        hasWarnings: false,
        errorCount: 1,
        warningCount: 0,
        informationCount: 0,
        validationScore: 90,
        lastValidated: new Date(),
        validatedAt: new Date(),
        performanceMetrics: {},
        aspectBreakdown: {},
        issues: [],
        createdAt: new Date(),
        updatedAt: new Date()
      })).rejects.toThrow('Database error');
    });
  });

  describe('Validation Result Retrieval', () => {
    it('should get latest validation result by resource ID', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockValidationResult])
            })
          })
        })
      });

      const result = await storage.getLatestValidationResult(123);

      expect(result).toEqual(mockValidationResult);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should get latest validation result by resource ID and settings hash', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockValidationResult])
            })
          })
        })
      });

      const result = await storage.getLatestValidationResult(123, 'hash123');

      expect(result).toEqual(mockValidationResult);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should return undefined when no validation result exists', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([])
            })
          })
        })
      });

      const result = await storage.getLatestValidationResult(999);

      expect(result).toBeUndefined();
    });

    it('should get validation result by hash', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockValidationResult])
            })
          })
        })
      });

      const result = await storage.getValidationResultByHash(123, 'hash123', 'resourceHash123');

      expect(result).toEqual(mockValidationResult);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should return undefined when validation result by hash not found', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([])
            })
          })
        })
      });

      const result = await storage.getValidationResultByHash(123, 'nonexistent', 'nonexistent');

      expect(result).toBeUndefined();
    });
  });

  describe('Validation Result Cache Invalidation', () => {
    it('should invalidate validation results by resource ID', async () => {
      mockDb.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue([])
      });

      const { cacheManager } = await import('../utils/cache-manager');

      await storage.invalidateValidationResults(123);

      expect(mockDb.delete).toHaveBeenCalledWith(validationResults);
      expect(cacheManager.clearByTag).toHaveBeenCalledWith('validation-results');
    });

    it('should invalidate validation results by settings hash', async () => {
      mockDb.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue([])
      });

      const { cacheManager } = await import('../utils/cache-manager');

      await storage.invalidateValidationResults(undefined, 'hash123');

      expect(mockDb.delete).toHaveBeenCalledWith(validationResults);
      expect(cacheManager.clearByTag).toHaveBeenCalledWith('validation-results');
    });

    it('should invalidate all validation results when no parameters provided', async () => {
      mockDb.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue([])
      });

      const { cacheManager } = await import('../utils/cache-manager');

      await storage.invalidateValidationResults();

      expect(mockDb.delete).toHaveBeenCalledWith(validationResults);
      expect(cacheManager.clearByTag).toHaveBeenCalledWith('validation-results');
    });

    it('should clear all validation results', async () => {
      mockDb.delete.mockResolvedValue([]);

      await storage.clearAllValidationResults();

      expect(mockDb.delete).toHaveBeenCalledWith(validationResults);
    });
  });

  describe('Validation Result Cleanup', () => {
    it('should cleanup old validation results with default age', async () => {
      const mockDeletedResults = [{ id: 1 }, { id: 2 }];
      mockDb.delete.mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue(mockDeletedResults)
        })
      });

      const deletedCount = await storage.cleanupOldValidationResults();

      expect(deletedCount).toBe(2);
      expect(mockDb.delete).toHaveBeenCalledWith(validationResults);
    });

    it('should cleanup old validation results with custom age', async () => {
      const mockDeletedResults = [{ id: 1 }];
      mockDb.delete.mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue(mockDeletedResults)
        })
      });

      const deletedCount = await storage.cleanupOldValidationResults(24); // 1 day

      expect(deletedCount).toBe(1);
      expect(mockDb.delete).toHaveBeenCalledWith(validationResults);
    });

    it('should handle cleanup errors gracefully', async () => {
      mockDb.delete.mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(new Error('Cleanup error'))
        })
      });

      await expect(storage.cleanupOldValidationResults()).rejects.toThrow('Cleanup error');
    });
  });

  describe('Validation Result Re-evaluation', () => {
    it('should re-evaluate validation result with all aspects enabled', () => {
      const settings = {
        structural: { enabled: true, severity: 'error' },
        profile: { enabled: true, severity: 'error' },
        terminology: { enabled: true, severity: 'warning' },
        reference: { enabled: true, severity: 'error' },
        businessRule: { enabled: true, severity: 'warning' },
        metadata: { enabled: true, severity: 'info' }
      };

      // Access private method for testing
      const result = (storage as any).reEvaluateValidationResult(mockValidationResult, settings);

      expect(result.isValid).toBe(false); // Has errors
      expect(result.errorCount).toBe(2); // 2 errors from structural and profile
      expect(result.warningCount).toBe(1); // 1 warning from reference
    });

    it('should re-evaluate validation result with some aspects disabled', () => {
      const settings = {
        structural: { enabled: false, severity: 'error' },
        profile: { enabled: true, severity: 'error' },
        terminology: { enabled: true, severity: 'warning' },
        reference: { enabled: true, severity: 'error' },
        businessRule: { enabled: true, severity: 'warning' },
        metadata: { enabled: true, severity: 'info' }
      };

      const result = (storage as any).reEvaluateValidationResult(mockValidationResult, settings);

      expect(result.isValid).toBe(false); // Still has errors from profile
      expect(result.errorCount).toBe(1); // 1 error from profile (structural disabled)
      expect(result.warningCount).toBe(1); // 1 warning from reference
    });

    it('should re-evaluate validation result with all aspects disabled', () => {
      const settings = {
        structural: { enabled: false, severity: 'error' },
        profile: { enabled: false, severity: 'error' },
        terminology: { enabled: false, severity: 'warning' },
        reference: { enabled: false, severity: 'error' },
        businessRule: { enabled: false, severity: 'warning' },
        metadata: { enabled: false, severity: 'info' }
      };

      const result = (storage as any).reEvaluateValidationResult(mockValidationResult, settings);

      expect(result.isValid).toBe(true); // All aspects disabled = valid
      expect(result.errorCount).toBe(0);
      expect(result.warningCount).toBe(0);
    });

    it('should handle validation result without issues', () => {
      const resultWithoutIssues = {
        ...mockValidationResult,
        issues: []
      };

      const settings = {
        structural: { enabled: true, severity: 'error' },
        profile: { enabled: true, severity: 'error' },
        terminology: { enabled: true, severity: 'warning' },
        reference: { enabled: true, severity: 'error' },
        businessRule: { enabled: true, severity: 'warning' },
        metadata: { enabled: true, severity: 'info' }
      };

      const result = (storage as any).reEvaluateValidationResult(resultWithoutIssues, settings);

      expect(result.isValid).toBe(true);
      expect(result.errorCount).toBe(0);
      expect(result.warningCount).toBe(0);
    });

    it('should handle validation result with unknown aspects', () => {
      const resultWithUnknownAspect = {
        ...mockValidationResult,
        issues: [
          { aspect: 'unknown', severity: 'error', message: 'Unknown aspect error' }
        ]
      };

      const settings = {
        structural: { enabled: true, severity: 'error' },
        profile: { enabled: true, severity: 'error' },
        terminology: { enabled: true, severity: 'warning' },
        reference: { enabled: true, severity: 'error' },
        businessRule: { enabled: true, severity: 'warning' },
        metadata: { enabled: true, severity: 'info' }
      };

      const result = (storage as any).reEvaluateValidationResult(resultWithUnknownAspect, settings);

      expect(result.isValid).toBe(false); // Unknown aspect included by default
      expect(result.errorCount).toBe(1); // 1 error from unknown aspect
      expect(result.warningCount).toBe(0);
    });
  });

  describe('Resource Statistics with Settings', () => {
    it('should get resource stats with validation settings filtering', async () => {
      const mockResources = [mockFhirResource];
      const mockValidationResults = [mockValidationResult];

      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockResources)
          })
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(mockValidationResults)
            })
          })
        });

      const { getValidationSettingsService } = await import('../services/validation/validation-settings-service');
      const mockSettingsService = getValidationSettingsService();
      vi.mocked(mockSettingsService.getActiveSettings).mockResolvedValue({
        settings: {
          structural: { enabled: true, severity: 'error' },
          profile: { enabled: true, severity: 'error' },
          terminology: { enabled: true, severity: 'warning' },
          reference: { enabled: true, severity: 'error' },
          businessRule: { enabled: true, severity: 'warning' },
          metadata: { enabled: true, severity: 'info' }
        }
      });

      const stats = await storage.getResourceStatsWithSettings();

      expect(stats).toBeDefined();
      expect(stats.totalResources).toBe(1);
      expect(stats.validatedResources).toBe(1);
      expect(stats.validResources).toBe(0); // Has errors after filtering
      expect(stats.errorResources).toBe(1);
      expect(stats.warningResources).toBe(0);
      expect(stats.unvalidatedResources).toBe(0);
    });

    it('should handle empty validation results gracefully', async () => {
      const mockResources = [mockFhirResource];

      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockResources)
          })
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([])
            })
          })
        });

      const { getValidationSettingsService } = await import('../services/validation/validation-settings-service');
      const mockSettingsService = getValidationSettingsService();
      vi.mocked(mockSettingsService.getActiveSettings).mockResolvedValue({
        settings: {
          structural: { enabled: true, severity: 'error' },
          profile: { enabled: true, severity: 'error' },
          terminology: { enabled: true, severity: 'warning' },
          reference: { enabled: true, severity: 'error' },
          businessRule: { enabled: true, severity: 'warning' },
          metadata: { enabled: true, severity: 'info' }
        }
      });

      const stats = await storage.getResourceStatsWithSettings();

      expect(stats).toBeDefined();
      expect(stats.totalResources).toBe(1);
      expect(stats.validatedResources).toBe(0);
      expect(stats.validResources).toBe(0);
      expect(stats.errorResources).toBe(0);
      expect(stats.warningResources).toBe(0);
      expect(stats.unvalidatedResources).toBe(1);
    });

    it('should handle validation settings service errors gracefully', async () => {
      const mockResources = [mockFhirResource];

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockResources)
        })
      });

      const { getValidationSettingsService } = await import('../services/validation/validation-settings-service');
      const mockSettingsService = getValidationSettingsService();
      vi.mocked(mockSettingsService.getActiveSettings).mockRejectedValue(new Error('Settings service error'));

      await expect(storage.getResourceStatsWithSettings()).rejects.toThrow('Settings service error');
    });
  });

  describe('Cache Performance', () => {
    it('should handle high-frequency validation result creation efficiently', async () => {
      const startTime = Date.now();

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockValidationResult])
        })
      });

      // Simulate high-frequency validation result creation
      const promises = Array.from({ length: 100 }, (_, i) => 
        storage.createValidationResult({
          resourceId: 123 + i,
          settingsHash: 'hash123',
          resourceHash: `resourceHash${i}`,
          validationEngineVersion: '1.0.0',
          isValid: i % 2 === 0,
          hasErrors: i % 2 !== 0,
          hasWarnings: i % 3 === 0,
          errorCount: i % 2 !== 0 ? 1 : 0,
          warningCount: i % 3 === 0 ? 1 : 0,
          informationCount: 0,
          validationScore: i % 2 === 0 ? 100 : 75,
          lastValidated: new Date(),
          validatedAt: new Date(),
          performanceMetrics: {},
          aspectBreakdown: {},
          issues: [],
          createdAt: new Date(),
          updatedAt: new Date()
        })
      );

      await Promise.all(promises);

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Verify all results were created
      expect(mockDb.insert).toHaveBeenCalledTimes(100);
      
      // Verify performance is acceptable (adjust threshold as needed)
      expect(processingTime).toBeLessThan(5000); // 5 seconds
    });

    it('should handle concurrent cache invalidation correctly', async () => {
      mockDb.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue([])
      });

      const { cacheManager } = await import('../utils/cache-manager');

      // Simulate concurrent cache invalidation
      const promises = [
        storage.invalidateValidationResults(123),
        storage.invalidateValidationResults(124),
        storage.invalidateValidationResults(125)
      ];

      await Promise.all(promises);

      // Verify all invalidations were processed
      expect(mockDb.delete).toHaveBeenCalledTimes(3);
      expect(cacheManager.clearByTag).toHaveBeenCalledTimes(3);
    });

    it('should handle large validation result retrieval efficiently', async () => {
      const largeValidationResults = Array.from({ length: 1000 }, (_, i) => ({
        ...mockValidationResult,
        id: i + 1,
        resourceId: 123 + i
      }));

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(largeValidationResults.slice(0, 1))
            })
          })
        })
      });

      const startTime = Date.now();

      // Retrieve latest validation results for many resources
      const promises = Array.from({ length: 100 }, (_, i) => 
        storage.getLatestValidationResult(123 + i)
      );

      await Promise.all(promises);

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Verify all retrievals were processed
      expect(mockDb.select).toHaveBeenCalledTimes(100);
      
      // Verify performance is acceptable
      expect(processingTime).toBeLessThan(3000); // 3 seconds
    });
  });

  describe('Data Integrity', () => {
    it('should maintain data consistency during concurrent operations', async () => {
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockValidationResult])
        })
      });

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockValidationResult])
            })
          })
        })
      });

      // Simulate concurrent create and retrieve operations
      const createPromise = storage.createValidationResult({
        resourceId: 123,
        settingsHash: 'hash123',
        resourceHash: 'resourceHash123',
        validationEngineVersion: '1.0.0',
        isValid: false,
        hasErrors: true,
        hasWarnings: false,
        errorCount: 1,
        warningCount: 0,
        informationCount: 0,
        validationScore: 90,
        lastValidated: new Date(),
        validatedAt: new Date(),
        performanceMetrics: {},
        aspectBreakdown: {},
        issues: [],
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const retrievePromise = storage.getLatestValidationResult(123);

      const [createdResult, retrievedResult] = await Promise.all([createPromise, retrievePromise]);

      expect(createdResult).toBeDefined();
      expect(retrievedResult).toBeDefined();
      expect(createdResult.id).toBe(retrievedResult?.id);
    });

    it('should handle database transaction failures gracefully', async () => {
      mockDb.transaction.mockImplementation(async (callback) => {
        // Simulate transaction failure
        throw new Error('Transaction failed');
      });

      await expect(storage.createValidationResult({
        resourceId: 123,
        settingsHash: 'hash123',
        resourceHash: 'resourceHash123',
        validationEngineVersion: '1.0.0',
        isValid: false,
        hasErrors: true,
        hasWarnings: false,
        errorCount: 1,
        warningCount: 0,
        informationCount: 0,
        validationScore: 90,
        lastValidated: new Date(),
        validatedAt: new Date(),
        performanceMetrics: {},
        aspectBreakdown: {},
        issues: [],
        createdAt: new Date(),
        updatedAt: new Date()
      })).rejects.toThrow('Transaction failed');
    });

    it('should handle malformed validation result data gracefully', async () => {
      const malformedResult = {
        resourceId: 123,
        settingsHash: 'hash123',
        // Missing required fields
      } as any;

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(new Error('Invalid data'))
        })
      });

      await expect(storage.createValidationResult(malformedResult)).rejects.toThrow('Invalid data');
    });
  });
});
