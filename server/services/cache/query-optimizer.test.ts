import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { queryOptimizer } from './query-optimizer'
import { cacheManager } from './cache-manager'

// Mock dependencies
vi.mock('./cache-manager', () => ({
  cacheManager: {
    get: vi.fn(),
    set: vi.fn(),
    invalidate: vi.fn(),
    clear: vi.fn()
  }
}))

// Mock the logger
vi.mock('../../utils/logger.js', () => ({
  logger: {
    cache: vi.fn(),
    getLogLevel: vi.fn(() => 2)
  }
}))

// Mock the error handler
vi.mock('../../utils/error-handler.js', () => ({
  errorHandler: {
    handleError: vi.fn((error) => ({
      success: false,
      error: {
        code: 'CACHE_ERROR',
        message: error.message,
        category: 'cache',
        severity: 'high',
        recoverable: true,
        recoveryAction: 'retry'
      }
    }))
  }
}))

describe('queryOptimizer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getFhirServers', () => {
    it('should return cached data when available', async () => {
      const mockServers = [
        {
          id: '1',
          name: 'Test Server',
          baseUrl: 'https://hapi.fhir.org/baseR4',
          isActive: true,
          authConfig: null
        }
      ]

      vi.mocked(cacheManager.get).mockResolvedValue(mockServers)

      const result = await queryOptimizer.getFhirServers()

      expect(result).toEqual(mockServers)
      expect(cacheManager.get).toHaveBeenCalledWith('fhir-servers')
    })

    it('should fetch and cache data when not in cache', async () => {
      const mockServers = [
        {
          id: '1',
          name: 'Test Server',
          baseUrl: 'https://hapi.fhir.org/baseR4',
          isActive: true,
          authConfig: null
        }
      ]

      vi.mocked(cacheManager.get).mockResolvedValue(null)
      vi.mocked(cacheManager.set).mockResolvedValue(undefined)

      // Mock the database query function
      const mockDbQuery = vi.fn().mockResolvedValue(mockServers)
      queryOptimizer['dbQuery'] = mockDbQuery

      const result = await queryOptimizer.getFhirServers()

      expect(result).toEqual(mockServers)
      expect(cacheManager.get).toHaveBeenCalledWith('fhir-servers')
      expect(cacheManager.set).toHaveBeenCalledWith('fhir-servers', mockServers, { ttl: 300 })
    })

    it('should handle cache errors gracefully', async () => {
      const mockServers = [
        {
          id: '1',
          name: 'Test Server',
          baseUrl: 'https://hapi.fhir.org/baseR4',
          isActive: true,
          authConfig: null
        }
      ]

      vi.mocked(cacheManager.get).mockRejectedValue(new Error('Cache error'))
      vi.mocked(cacheManager.set).mockResolvedValue(undefined)

      const mockDbQuery = vi.fn().mockResolvedValue(mockServers)
      queryOptimizer['dbQuery'] = mockDbQuery

      const result = await queryOptimizer.getFhirServers()

      expect(result).toEqual(mockServers)
      expect(cacheManager.set).toHaveBeenCalledWith('fhir-servers', mockServers, { ttl: 300 })
    })

    it('should handle database errors', async () => {
      vi.mocked(cacheManager.get).mockResolvedValue(null)

      const mockDbQuery = vi.fn().mockRejectedValue(new Error('Database error'))
      queryOptimizer['dbQuery'] = mockDbQuery

      await expect(queryOptimizer.getFhirServers()).rejects.toThrow('Database error')
    })
  })

  describe('getActiveFhirServer', () => {
    it('should return cached active server when available', async () => {
      const mockServer = {
        id: '1',
        name: 'Active Server',
        baseUrl: 'https://hapi.fhir.org/baseR4',
        isActive: true,
        authConfig: null
      }

      vi.mocked(cacheManager.get).mockResolvedValue(mockServer)

      const result = await queryOptimizer.getActiveFhirServer()

      expect(result).toEqual(mockServer)
      expect(cacheManager.get).toHaveBeenCalledWith('active-fhir-server')
    })

    it('should fetch and cache active server when not in cache', async () => {
      const mockServer = {
        id: '1',
        name: 'Active Server',
        baseUrl: 'https://hapi.fhir.org/baseR4',
        isActive: true,
        authConfig: null
      }

      vi.mocked(cacheManager.get).mockResolvedValue(null)
      vi.mocked(cacheManager.set).mockResolvedValue(undefined)

      const mockDbQuery = vi.fn().mockResolvedValue(mockServer)
      queryOptimizer['dbQuery'] = mockDbQuery

      const result = await queryOptimizer.getActiveFhirServer()

      expect(result).toEqual(mockServer)
      expect(cacheManager.set).toHaveBeenCalledWith('active-fhir-server', mockServer, { ttl: 300 })
    })

    it('should return null when no active server found', async () => {
      vi.mocked(cacheManager.get).mockResolvedValue(null)
      vi.mocked(cacheManager.set).mockResolvedValue(undefined)

      const mockDbQuery = vi.fn().mockResolvedValue(null)
      queryOptimizer['dbQuery'] = mockDbQuery

      const result = await queryOptimizer.getActiveFhirServer()

      expect(result).toBeNull()
      expect(cacheManager.set).toHaveBeenCalledWith('active-fhir-server', null, { ttl: 300 })
    })
  })

  describe('getResourceStats', () => {
    it('should return cached resource stats when available', async () => {
      const mockStats = [
        { resourceType: 'Patient', count: 100 },
        { resourceType: 'Observation', count: 250 }
      ]

      vi.mocked(cacheManager.get).mockResolvedValue(mockStats)

      const result = await queryOptimizer.getResourceStats()

      expect(result).toEqual(mockStats)
      expect(cacheManager.get).toHaveBeenCalledWith('resource-stats')
    })

    it('should fetch and cache resource stats when not in cache', async () => {
      const mockStats = [
        { resourceType: 'Patient', count: 100 },
        { resourceType: 'Observation', count: 250 }
      ]

      vi.mocked(cacheManager.get).mockResolvedValue(null)
      vi.mocked(cacheManager.set).mockResolvedValue(undefined)

      const mockDbQuery = vi.fn().mockResolvedValue(mockStats)
      queryOptimizer['dbQuery'] = mockDbQuery

      const result = await queryOptimizer.getResourceStats()

      expect(result).toEqual(mockStats)
      expect(cacheManager.set).toHaveBeenCalledWith('resource-stats', mockStats, { ttl: 600 })
    })
  })

  describe('getResourceStatsWithSettings', () => {
    it('should return cached resource stats with settings when available', async () => {
      const mockStats = [
        { resourceType: 'Patient', count: 100, percentage: 28.57 },
        { resourceType: 'Observation', count: 250, percentage: 71.43 }
      ]

      vi.mocked(cacheManager.get).mockResolvedValue(mockStats)

      const result = await queryOptimizer.getResourceStatsWithSettings()

      expect(result).toEqual(mockStats)
      expect(cacheManager.get).toHaveBeenCalledWith('resource-stats-with-settings')
    })

    it('should fetch and cache resource stats with settings when not in cache', async () => {
      const mockStats = [
        { resourceType: 'Patient', count: 100, percentage: 28.57 },
        { resourceType: 'Observation', count: 250, percentage: 71.43 }
      ]

      vi.mocked(cacheManager.get).mockResolvedValue(null)
      vi.mocked(cacheManager.set).mockResolvedValue(undefined)

      const mockDbQuery = vi.fn().mockResolvedValue(mockStats)
      queryOptimizer['dbQuery'] = mockDbQuery

      const result = await queryOptimizer.getResourceStatsWithSettings()

      expect(result).toEqual(mockStats)
      expect(cacheManager.set).toHaveBeenCalledWith('resource-stats-with-settings', mockStats, { ttl: 600 })
    })
  })

  describe('getValidationProfiles', () => {
    it('should return cached validation profiles when available', async () => {
      const mockProfiles = [
        {
          id: '1',
          name: 'Patient Profile',
          resourceType: 'Patient',
          profileUrl: 'http://example.com/patient-profile',
          isActive: true
        }
      ]

      vi.mocked(cacheManager.get).mockResolvedValue(mockProfiles)

      const result = await queryOptimizer.getValidationProfiles()

      expect(result).toEqual(mockProfiles)
      expect(cacheManager.get).toHaveBeenCalledWith('validation-profiles')
    })

    it('should fetch and cache validation profiles when not in cache', async () => {
      const mockProfiles = [
        {
          id: '1',
          name: 'Patient Profile',
          resourceType: 'Patient',
          profileUrl: 'http://example.com/patient-profile',
          isActive: true
        }
      ]

      vi.mocked(cacheManager.get).mockResolvedValue(null)
      vi.mocked(cacheManager.set).mockResolvedValue(undefined)

      const mockDbQuery = vi.fn().mockResolvedValue(mockProfiles)
      queryOptimizer['dbQuery'] = mockDbQuery

      const result = await queryOptimizer.getValidationProfiles()

      expect(result).toEqual(mockProfiles)
      expect(cacheManager.set).toHaveBeenCalledWith('validation-profiles', mockProfiles, { ttl: 900 })
    })
  })

  describe('getValidationResultsByResourceId', () => {
    it('should return cached validation results when available', async () => {
      const mockResults = [
        {
          id: '1',
          resourceId: 'Patient/123',
          profileId: 'profile-1',
          isValid: true,
          errors: [],
          timestamp: new Date()
        }
      ]

      vi.mocked(cacheManager.get).mockResolvedValue(mockResults)

      const result = await queryOptimizer.getValidationResultsByResourceId('Patient/123')

      expect(result).toEqual(mockResults)
      expect(cacheManager.get).toHaveBeenCalledWith('validation-results-Patient/123')
    })

    it('should fetch and cache validation results when not in cache', async () => {
      const mockResults = [
        {
          id: '1',
          resourceId: 'Patient/123',
          profileId: 'profile-1',
          isValid: true,
          errors: [],
          timestamp: new Date()
        }
      ]

      vi.mocked(cacheManager.get).mockResolvedValue(null)
      vi.mocked(cacheManager.set).mockResolvedValue(undefined)

      const mockDbQuery = vi.fn().mockResolvedValue(mockResults)
      queryOptimizer['dbQuery'] = mockDbQuery

      const result = await queryOptimizer.getValidationResultsByResourceId('Patient/123')

      expect(result).toEqual(mockResults)
      expect(cacheManager.set).toHaveBeenCalledWith('validation-results-Patient/123', mockResults, { ttl: 1800 })
    })
  })

  describe('getRecentValidationErrors', () => {
    it('should return cached recent validation errors when available', async () => {
      const mockErrors = [
        {
          id: '1',
          resourceId: 'Patient/123',
          message: 'Missing required field: name',
          severity: 'error',
          timestamp: new Date()
        }
      ]

      vi.mocked(cacheManager.get).mockResolvedValue(mockErrors)

      const result = await queryOptimizer.getRecentValidationErrors()

      expect(result).toEqual(mockErrors)
      expect(cacheManager.get).toHaveBeenCalledWith('recent-validation-errors')
    })

    it('should fetch and cache recent validation errors when not in cache', async () => {
      const mockErrors = [
        {
          id: '1',
          resourceId: 'Patient/123',
          message: 'Missing required field: name',
          severity: 'error',
          timestamp: new Date()
        }
      ]

      vi.mocked(cacheManager.get).mockResolvedValue(null)
      vi.mocked(cacheManager.set).mockResolvedValue(undefined)

      const mockDbQuery = vi.fn().mockResolvedValue(mockErrors)
      queryOptimizer['dbQuery'] = mockDbQuery

      const result = await queryOptimizer.getRecentValidationErrors()

      expect(result).toEqual(mockErrors)
      expect(cacheManager.set).toHaveBeenCalledWith('recent-validation-errors', mockErrors, { ttl: 300 })
    })
  })

  describe('getDashboardCards', () => {
    it('should return cached dashboard cards when available', async () => {
      const mockCards = [
        {
          id: '1',
          title: 'Server Status',
          type: 'server-status',
          data: { isConnected: true },
          position: { x: 0, y: 0 }
        }
      ]

      vi.mocked(cacheManager.get).mockResolvedValue(mockCards)

      const result = await queryOptimizer.getDashboardCards()

      expect(result).toEqual(mockCards)
      expect(cacheManager.get).toHaveBeenCalledWith('dashboard-cards')
    })

    it('should fetch and cache dashboard cards when not in cache', async () => {
      const mockCards = [
        {
          id: '1',
          title: 'Server Status',
          type: 'server-status',
          data: { isConnected: true },
          position: { x: 0, y: 0 }
        }
      ]

      vi.mocked(cacheManager.get).mockResolvedValue(null)
      vi.mocked(cacheManager.set).mockResolvedValue(undefined)

      const mockDbQuery = vi.fn().mockResolvedValue(mockCards)
      queryOptimizer['dbQuery'] = mockDbQuery

      const result = await queryOptimizer.getDashboardCards()

      expect(result).toEqual(mockCards)
      expect(cacheManager.set).toHaveBeenCalledWith('dashboard-cards', mockCards, { ttl: 1800 })
    })
  })

  describe('getValidationSettings', () => {
    it('should return cached validation settings when available', async () => {
      const mockSettings = {
        batchSize: 100,
        timeout: 30000,
        retryAttempts: 3,
        enableParallelProcessing: true
      }

      vi.mocked(cacheManager.get).mockResolvedValue(mockSettings)

      const result = await queryOptimizer.getValidationSettings()

      expect(result).toEqual(mockSettings)
      expect(cacheManager.get).toHaveBeenCalledWith('validation-settings')
    })

    it('should fetch and cache validation settings when not in cache', async () => {
      const mockSettings = {
        batchSize: 100,
        timeout: 30000,
        retryAttempts: 3,
        enableParallelProcessing: true
      }

      vi.mocked(cacheManager.get).mockResolvedValue(null)
      vi.mocked(cacheManager.set).mockResolvedValue(undefined)

      const mockDbQuery = vi.fn().mockResolvedValue(mockSettings)
      queryOptimizer['dbQuery'] = mockDbQuery

      const result = await queryOptimizer.getValidationSettings()

      expect(result).toEqual(mockSettings)
      expect(cacheManager.set).toHaveBeenCalledWith('validation-settings', mockSettings, { ttl: 3600 })
    })
  })

  describe('invalidateCache', () => {
    it('should invalidate specific cache keys', async () => {
      vi.mocked(cacheManager.invalidate).mockResolvedValue(undefined)

      await queryOptimizer.invalidateCache(['fhir-servers', 'active-fhir-server'])

      expect(cacheManager.invalidate).toHaveBeenCalledWith(['fhir-servers', 'active-fhir-server'])
    })

    it('should invalidate all cache when no keys provided', async () => {
      vi.mocked(cacheManager.clear).mockResolvedValue(undefined)

      await queryOptimizer.invalidateCache()

      expect(cacheManager.clear).toHaveBeenCalled()
    })
  })

  describe('cache performance', () => {
    it('should use appropriate TTL values for different data types', async () => {
      vi.mocked(cacheManager.get).mockResolvedValue(null)
      vi.mocked(cacheManager.set).mockResolvedValue(undefined)

      const mockDbQuery = vi.fn().mockResolvedValue([])
      queryOptimizer['dbQuery'] = mockDbQuery

      // Test different TTL values
      await queryOptimizer.getFhirServers()
      expect(cacheManager.set).toHaveBeenCalledWith('fhir-servers', [], { ttl: 300 })

      await queryOptimizer.getResourceStats()
      expect(cacheManager.set).toHaveBeenCalledWith('resource-stats', [], { ttl: 600 })

      await queryOptimizer.getValidationProfiles()
      expect(cacheManager.set).toHaveBeenCalledWith('validation-profiles', [], { ttl: 900 })

      await queryOptimizer.getValidationResultsByResourceId('test')
      expect(cacheManager.set).toHaveBeenCalledWith('validation-results-test', [], { ttl: 1800 })

      await queryOptimizer.getValidationSettings()
      expect(cacheManager.set).toHaveBeenCalledWith('validation-settings', [], { ttl: 3600 })
    })
  })
})

