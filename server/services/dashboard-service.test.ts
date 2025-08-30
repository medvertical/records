// ============================================================================
// Dashboard Service Tests
// ============================================================================

import { DashboardService } from './dashboard-service';
import { FhirClient } from './fhir-client';
import { DatabaseStorage } from '../storage';
import { FhirServerStats, ValidationStats } from '@shared/types/dashboard';

// Mock dependencies
jest.mock('./fhir-client');
jest.mock('../storage');

describe('DashboardService', () => {
  let dashboardService: DashboardService;
  let mockFhirClient: jest.Mocked<FhirClient>;
  let mockStorage: jest.Mocked<DatabaseStorage>;

  beforeEach(() => {
    mockFhirClient = new FhirClient('http://test-server') as jest.Mocked<FhirClient>;
    mockStorage = new DatabaseStorage() as jest.Mocked<DatabaseStorage>;
    dashboardService = new DashboardService(mockFhirClient, mockStorage);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getFhirServerStats', () => {
    it('should return FHIR server statistics', async () => {
      // Mock FHIR client responses
      mockFhirClient.testConnection.mockResolvedValue({
        connected: true,
        version: 'R4',
        error: undefined
      });

      mockFhirClient.getAllResourceTypes.mockResolvedValue(['Patient', 'Observation']);
      mockFhirClient.getResourceCount.mockResolvedValue(1000);

      const result = await dashboardService.getFhirServerStats();

      expect(result).toMatchObject({
        totalResources: 2000,
        serverInfo: {
          connected: true,
          version: 'R4'
        }
      });
      expect(result.resourceBreakdown).toHaveLength(2);
    });

    it('should handle FHIR client errors gracefully', async () => {
      mockFhirClient.testConnection.mockRejectedValue(new Error('Connection failed'));

      await expect(dashboardService.getFhirServerStats()).rejects.toThrow('Failed to fetch FHIR server statistics');
    });
  });

  describe('getValidationStats', () => {
    it('should return validation statistics', async () => {
      // Mock storage responses
      mockStorage.getResourceStatsWithSettings.mockResolvedValue({
        totalResources: 100,
        validResources: 80,
        errorResources: 15,
        warningResources: 5,
        unvalidatedResources: 0,
        activeProfiles: 1,
        resourceBreakdown: {
          'Patient': { total: 50, valid: 40, validPercent: 80 }
        }
      });

      // Mock FHIR client for resource counts
      mockFhirClient.getAllResourceTypes.mockResolvedValue(['Patient']);
      mockFhirClient.getResourceCount.mockResolvedValue(100);

      const result = await dashboardService.getValidationStats();

      expect(result).toMatchObject({
        totalValidated: 100,
        validResources: 80,
        errorResources: 15,
        warningResources: 5,
        validationCoverage: 80, // 80/100 * 100
        validationProgress: 100 // 100/100 * 100
      });
    });

    it('should calculate validation coverage correctly', async () => {
      mockStorage.getResourceStatsWithSettings.mockResolvedValue({
        totalResources: 50,
        validResources: 40,
        errorResources: 10,
        warningResources: 0,
        unvalidatedResources: 0,
        activeProfiles: 1,
        resourceBreakdown: {}
      });

      mockFhirClient.getAllResourceTypes.mockResolvedValue(['Patient']);
      mockFhirClient.getResourceCount.mockResolvedValue(100);

      const result = await dashboardService.getValidationStats();

      expect(result.validationCoverage).toBe(80); // 40/50 * 100
      expect(result.validationProgress).toBe(50); // 50/100 * 100
    });
  });

  describe('getCombinedDashboardData', () => {
    it('should return combined dashboard data', async () => {
      // Mock both services
      mockFhirClient.testConnection.mockResolvedValue({
        connected: true,
        version: 'R4'
      });
      mockFhirClient.getAllResourceTypes.mockResolvedValue(['Patient']);
      mockFhirClient.getResourceCount.mockResolvedValue(100);

      mockStorage.getResourceStatsWithSettings.mockResolvedValue({
        totalResources: 50,
        validResources: 40,
        errorResources: 10,
        warningResources: 0,
        unvalidatedResources: 0,
        activeProfiles: 1,
        resourceBreakdown: {}
      });

      const result = await dashboardService.getCombinedDashboardData();

      expect(result).toHaveProperty('fhirServer');
      expect(result).toHaveProperty('validation');
      expect(result).toHaveProperty('lastUpdated');
      expect(result).toHaveProperty('dataFreshness');
    });
  });

  describe('cache management', () => {
    it('should cache data and return cached results', async () => {
      mockFhirClient.testConnection.mockResolvedValue({
        connected: true,
        version: 'R4'
      });
      mockFhirClient.getAllResourceTypes.mockResolvedValue(['Patient']);
      mockFhirClient.getResourceCount.mockResolvedValue(100);

      // First call
      const result1 = await dashboardService.getFhirServerStats();
      
      // Second call should use cache
      const result2 = await dashboardService.getFhirServerStats();

      expect(result1).toEqual(result2);
      expect(mockFhirClient.testConnection).toHaveBeenCalledTimes(1);
    });

    it('should clear cache', () => {
      dashboardService.clearCache();
      const status = dashboardService.getCacheStatus();
      expect(Object.keys(status)).toHaveLength(0);
    });
  });
});
