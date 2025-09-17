import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Storage } from './storage'
import { queryOptimizer } from './services/cache/query-optimizer'

// Mock dependencies
vi.mock('./services/cache/query-optimizer', () => ({
  queryOptimizer: {
    getFhirServers: vi.fn(),
    getActiveFhirServer: vi.fn(),
    getResourceStats: vi.fn(),
    getResourceStatsWithSettings: vi.fn(),
    getValidationProfiles: vi.fn(),
    getValidationResultsByResourceId: vi.fn(),
    getRecentValidationErrors: vi.fn(),
    getDashboardCards: vi.fn(),
    getValidationSettings: vi.fn()
  }
}))

// Mock the logger
vi.mock('./server/utils/logger.js', () => ({
  logger: {
    storage: vi.fn(),
    getLogLevel: vi.fn(() => 2)
  }
}))

// Mock the error handler
vi.mock('./server/utils/error-handler.js', () => ({
  errorHandler: {
    handleError: vi.fn((error) => ({
      success: false,
      error: {
        code: 'STORAGE_ERROR',
        message: error.message,
        category: 'database',
        severity: 'high',
        recoverable: true,
        recoveryAction: 'retry'
      }
    }))
  }
}))

describe('Storage', () => {
  let storage: Storage

  beforeEach(() => {
    vi.clearAllMocks()
    storage = new Storage()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getFhirServers', () => {
    it('should return FHIR servers successfully', async () => {
      const mockServers = [
        {
          id: '1',
          name: 'Test Server 1',
          baseUrl: 'https://hapi.fhir.org/baseR4',
          isActive: true,
          authConfig: null
        },
        {
          id: '2',
          name: 'Test Server 2',
          baseUrl: 'https://fhir.example.com',
          isActive: false,
          authConfig: { type: 'basic', username: 'user', password: 'pass' }
        }
      ]

      vi.mocked(queryOptimizer.getFhirServers).mockResolvedValue(mockServers)

      const result = await storage.getFhirServers()

      expect(result).toEqual(mockServers)
      expect(queryOptimizer.getFhirServers).toHaveBeenCalled()
    })

    it('should handle errors', async () => {
      const error = new Error('Database connection failed')
      vi.mocked(queryOptimizer.getFhirServers).mockRejectedValue(error)

      await expect(storage.getFhirServers()).rejects.toThrow('Database connection failed')
    })
  })

  describe('getActiveFhirServer', () => {
    it('should return active FHIR server', async () => {
      const mockServer = {
        id: '1',
        name: 'Active Server',
        baseUrl: 'https://hapi.fhir.org/baseR4',
        isActive: true,
        authConfig: null
      }

      vi.mocked(queryOptimizer.getActiveFhirServer).mockResolvedValue(mockServer)

      const result = await storage.getActiveFhirServer()

      expect(result).toEqual(mockServer)
      expect(queryOptimizer.getActiveFhirServer).toHaveBeenCalled()
    })

    it('should return null when no active server', async () => {
      vi.mocked(queryOptimizer.getActiveFhirServer).mockResolvedValue(null)

      const result = await storage.getActiveFhirServer()

      expect(result).toBeNull()
    })
  })

  describe('getResourceStats', () => {
    it('should return resource statistics', async () => {
      const mockStats = [
        { resourceType: 'Patient', count: 100 },
        { resourceType: 'Observation', count: 250 }
      ]

      vi.mocked(queryOptimizer.getResourceStats).mockResolvedValue(mockStats)

      const result = await storage.getResourceStats()

      expect(result).toEqual(mockStats)
      expect(queryOptimizer.getResourceStats).toHaveBeenCalled()
    })
  })

  describe('getResourceStatsWithSettings', () => {
    it('should return resource statistics with settings', async () => {
      const mockStats = [
        { resourceType: 'Patient', count: 100, percentage: 28.57 },
        { resourceType: 'Observation', count: 250, percentage: 71.43 }
      ]

      vi.mocked(queryOptimizer.getResourceStatsWithSettings).mockResolvedValue(mockStats)

      const result = await storage.getResourceStatsWithSettings()

      expect(result).toEqual(mockStats)
      expect(queryOptimizer.getResourceStatsWithSettings).toHaveBeenCalled()
    })
  })

  describe('getValidationProfiles', () => {
    it('should return validation profiles', async () => {
      const mockProfiles = [
        {
          id: '1',
          name: 'Patient Profile',
          resourceType: 'Patient',
          profileUrl: 'http://example.com/patient-profile',
          isActive: true
        }
      ]

      vi.mocked(queryOptimizer.getValidationProfiles).mockResolvedValue(mockProfiles)

      const result = await storage.getValidationProfiles()

      expect(result).toEqual(mockProfiles)
      expect(queryOptimizer.getValidationProfiles).toHaveBeenCalled()
    })
  })

  describe('getValidationResultsByResourceId', () => {
    it('should return validation results for resource', async () => {
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

      vi.mocked(queryOptimizer.getValidationResultsByResourceId).mockResolvedValue(mockResults)

      const result = await storage.getValidationResultsByResourceId('Patient/123')

      expect(result).toEqual(mockResults)
      expect(queryOptimizer.getValidationResultsByResourceId).toHaveBeenCalledWith('Patient/123')
    })
  })

  describe('getRecentValidationErrors', () => {
    it('should return recent validation errors', async () => {
      const mockErrors = [
        {
          id: '1',
          resourceId: 'Patient/123',
          message: 'Missing required field: name',
          severity: 'error',
          timestamp: new Date()
        }
      ]

      vi.mocked(queryOptimizer.getRecentValidationErrors).mockResolvedValue(mockErrors)

      const result = await storage.getRecentValidationErrors()

      expect(result).toEqual(mockErrors)
      expect(queryOptimizer.getRecentValidationErrors).toHaveBeenCalled()
    })
  })

  describe('getDashboardCards', () => {
    it('should return dashboard cards', async () => {
      const mockCards = [
        {
          id: '1',
          title: 'Server Status',
          type: 'server-status',
          data: { isConnected: true },
          position: { x: 0, y: 0 }
        }
      ]

      vi.mocked(queryOptimizer.getDashboardCards).mockResolvedValue(mockCards)

      const result = await storage.getDashboardCards()

      expect(result).toEqual(mockCards)
      expect(queryOptimizer.getDashboardCards).toHaveBeenCalled()
    })
  })

  describe('getValidationSettings', () => {
    it('should return validation settings', async () => {
      const mockSettings = {
        batchSize: 100,
        timeout: 30000,
        retryAttempts: 3,
        enableParallelProcessing: true
      }

      vi.mocked(queryOptimizer.getValidationSettings).mockResolvedValue(mockSettings)

      const result = await storage.getValidationSettings()

      expect(result).toEqual(mockSettings)
      expect(queryOptimizer.getValidationSettings).toHaveBeenCalled()
    })
  })

  describe('addFhirServer', () => {
    it('should add new FHIR server', async () => {
      const serverData = {
        name: 'New Server',
        baseUrl: 'https://new-server.com',
        isActive: false,
        authConfig: null
      }

      const mockResult = {
        id: '2',
        ...serverData
      }

      // Mock the database insert
      const mockDb = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockResult])
          })
        })
      }

      // Mock the database instance
      storage['db'] = mockDb as any

      const result = await storage.addFhirServer(serverData)

      expect(result).toEqual(mockResult)
      expect(mockDb.insert).toHaveBeenCalled()
    })

    it('should handle database errors when adding server', async () => {
      const serverData = {
        name: 'New Server',
        baseUrl: 'https://new-server.com',
        isActive: false,
        authConfig: null
      }

      const mockDb = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockRejectedValue(new Error('Database error'))
          })
        })
      }

      storage['db'] = mockDb as any

      await expect(storage.addFhirServer(serverData)).rejects.toThrow('Database error')
    })
  })

  describe('updateFhirServer', () => {
    it('should update existing FHIR server', async () => {
      const serverId = '1'
      const updateData = {
        name: 'Updated Server',
        baseUrl: 'https://updated-server.com',
        isActive: true,
        authConfig: { type: 'basic', username: 'user', password: 'pass' }
      }

      const mockResult = {
        id: serverId,
        ...updateData
      }

      const mockDb = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([mockResult])
            })
          })
        })
      }

      storage['db'] = mockDb as any

      const result = await storage.updateFhirServer(serverId, updateData)

      expect(result).toEqual(mockResult)
      expect(mockDb.update).toHaveBeenCalled()
    })

    it('should handle database errors when updating server', async () => {
      const serverId = '1'
      const updateData = {
        name: 'Updated Server',
        baseUrl: 'https://updated-server.com',
        isActive: true,
        authConfig: null
      }

      const mockDb = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockRejectedValue(new Error('Database error'))
            })
          })
        })
      }

      storage['db'] = mockDb as any

      await expect(storage.updateFhirServer(serverId, updateData)).rejects.toThrow('Database error')
    })
  })

  describe('deleteFhirServer', () => {
    it('should delete FHIR server', async () => {
      const serverId = '1'

      const mockDb = {
        delete: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: serverId }])
          })
        })
      }

      storage['db'] = mockDb as any

      const result = await storage.deleteFhirServer(serverId)

      expect(result).toBe(true)
      expect(mockDb.delete).toHaveBeenCalled()
    })

    it('should handle database errors when deleting server', async () => {
      const serverId = '1'

      const mockDb = {
        delete: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockRejectedValue(new Error('Database error'))
          })
        })
      }

      storage['db'] = mockDb as any

      await expect(storage.deleteFhirServer(serverId)).rejects.toThrow('Database error')
    })
  })
})

