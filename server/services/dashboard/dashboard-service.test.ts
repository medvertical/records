import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DashboardService } from './dashboard-service'
import { Storage } from '../../storage'
import { FhirClient } from '../fhir/fhir-client'

// Mock dependencies
vi.mock('../../storage')
vi.mock('../fhir/fhir-client')
vi.mock('../../utils/logger.js', () => ({
  logger: {
    dashboard: vi.fn(),
    getLogLevel: vi.fn(() => 2)
  }
}))

// Mock the error handler
vi.mock('../../utils/error-handler.js', () => ({
  errorHandler: {
    handleError: vi.fn((error) => ({
      success: false,
      error: {
        code: 'DASHBOARD_ERROR',
        message: error.message,
        category: 'dashboard',
        severity: 'high',
        recoverable: true,
        recoveryAction: 'retry'
      }
    }))
  }
}))

describe('DashboardService', () => {
  let dashboardService: DashboardService
  let mockStorage: any
  let mockFhirClient: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Create mock instances
    mockStorage = {
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
    
    mockFhirClient = {
      testConnection: vi.fn(),
      getResourceCount: vi.fn()
    }

    // Mock constructors
    vi.mocked(Storage).mockImplementation(() => mockStorage)
    vi.mocked(FhirClient).mockImplementation(() => mockFhirClient)

    dashboardService = new DashboardService()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getServerStats', () => {
    it('should return server statistics successfully', async () => {
      const mockServer = {
        id: '1',
        name: 'Test Server',
        baseUrl: 'https://hapi.fhir.org/baseR4',
        isActive: true
      }

      const mockConnectionResult = {
        success: true,
        data: {
          connected: true,
          serverInfo: {
            resourceType: 'CapabilityStatement',
            fhirVersion: '4.0.1'
          },
          responseTime: 150
        }
      }

      mockStorage.getActiveFhirServer.mockResolvedValue(mockServer)
      mockFhirClient.testConnection.mockResolvedValue(mockConnectionResult)

      const result = await dashboardService.getServerStats()

      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        serverName: 'Test Server',
        serverUrl: 'https://hapi.fhir.org/baseR4',
        isConnected: true,
        fhirVersion: '4.0.1',
        responseTime: 150,
        lastChecked: expect.any(String)
      })
    })

    it('should handle server connection failure', async () => {
      const mockServer = {
        id: '1',
        name: 'Test Server',
        baseUrl: 'https://invalid-server.com',
        isActive: true
      }

      const mockConnectionResult = {
        success: false,
        error: {
          message: 'Connection failed'
        }
      }

      mockStorage.getActiveFhirServer.mockResolvedValue(mockServer)
      mockFhirClient.testConnection.mockResolvedValue(mockConnectionResult)

      const result = await dashboardService.getServerStats()

      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        serverName: 'Test Server',
        serverUrl: 'https://invalid-server.com',
        isConnected: false,
        fhirVersion: null,
        responseTime: null,
        lastChecked: expect.any(String),
        error: 'Connection failed'
      })
    })

    it('should handle no active server', async () => {
      mockStorage.getActiveFhirServer.mockResolvedValue(null)

      const result = await dashboardService.getServerStats()

      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        serverName: 'No server configured',
        serverUrl: null,
        isConnected: false,
        fhirVersion: null,
        responseTime: null,
        lastChecked: expect.any(String)
      })
    })

    it('should handle storage errors', async () => {
      mockStorage.getActiveFhirServer.mockRejectedValue(new Error('Database error'))

      const result = await dashboardService.getServerStats()

      expect(result.success).toBe(false)
      expect(result.error?.message).toBe('Database error')
    })
  })

  describe('getResourceStats', () => {
    it('should return resource statistics successfully', async () => {
      const mockServer = {
        id: '1',
        name: 'Test Server',
        baseUrl: 'https://hapi.fhir.org/baseR4',
        isActive: true
      }

      const mockResourceStats = [
        { resourceType: 'Patient', count: 100 },
        { resourceType: 'Observation', count: 250 },
        { resourceType: 'Encounter', count: 75 }
      ]

      mockStorage.getActiveFhirServer.mockResolvedValue(mockServer)
      mockStorage.getResourceStatsWithSettings.mockResolvedValue(mockResourceStats)

      const result = await dashboardService.getResourceStats()

      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        totalResources: 425,
        resourceTypes: [
          { resourceType: 'Patient', count: 100, percentage: 23.53 },
          { resourceType: 'Observation', count: 250, percentage: 58.82 },
          { resourceType: 'Encounter', count: 75, percentage: 17.65 }
        ],
        lastUpdated: expect.any(String)
      })
    })

    it('should handle empty resource stats', async () => {
      const mockServer = {
        id: '1',
        name: 'Test Server',
        baseUrl: 'https://hapi.fhir.org/baseR4',
        isActive: true
      }

      mockStorage.getActiveFhirServer.mockResolvedValue(mockServer)
      mockStorage.getResourceStatsWithSettings.mockResolvedValue([])

      const result = await dashboardService.getResourceStats()

      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        totalResources: 0,
        resourceTypes: [],
        lastUpdated: expect.any(String)
      })
    })

    it('should handle no active server for resource stats', async () => {
      mockStorage.getActiveFhirServer.mockResolvedValue(null)

      const result = await dashboardService.getResourceStats()

      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        totalResources: 0,
        resourceTypes: [],
        lastUpdated: expect.any(String)
      })
    })
  })

  describe('getValidationStats', () => {
    it('should return validation statistics successfully', async () => {
      const mockValidationProfiles = [
        { id: '1', name: 'Patient Profile', resourceType: 'Patient' },
        { id: '2', name: 'Observation Profile', resourceType: 'Observation' }
      ]

      const mockValidationResults = [
        { id: '1', resourceId: 'Patient/1', isValid: true, errors: [] },
        { id: '2', resourceId: 'Patient/2', isValid: false, errors: [{ message: 'Error 1' }] },
        { id: '3', resourceId: 'Observation/1', isValid: true, errors: [] }
      ]

      const mockRecentErrors = [
        { id: '1', resourceId: 'Patient/2', message: 'Error 1', timestamp: new Date() }
      ]

      mockStorage.getValidationProfiles.mockResolvedValue(mockValidationProfiles)
      mockStorage.getValidationResultsByResourceId.mockResolvedValue(mockValidationResults)
      mockStorage.getRecentValidationErrors.mockResolvedValue(mockRecentErrors)

      const result = await dashboardService.getValidationStats()

      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        totalProfiles: 2,
        totalValidated: 3,
        validationCoverage: 100,
        validationProgress: 100,
        successRate: 66.67,
        errorRate: 33.33,
        recentErrors: 1,
        breakdown: {
          byProfile: [
            { profileName: 'Patient Profile', total: 2, valid: 1, invalid: 1, successRate: 50 },
            { profileName: 'Observation Profile', total: 1, valid: 1, invalid: 0, successRate: 100 }
          ],
          byResourceType: [
            { resourceType: 'Patient', total: 2, valid: 1, invalid: 1, successRate: 50 },
            { resourceType: 'Observation', total: 1, valid: 1, invalid: 0, successRate: 100 }
          ]
        }
      })
    })

    it('should handle empty validation data', async () => {
      mockStorage.getValidationProfiles.mockResolvedValue([])
      mockStorage.getValidationResultsByResourceId.mockResolvedValue([])
      mockStorage.getRecentValidationErrors.mockResolvedValue([])

      const result = await dashboardService.getValidationStats()

      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        totalProfiles: 0,
        totalValidated: 0,
        validationCoverage: 0,
        validationProgress: 0,
        successRate: 0,
        errorRate: 0,
        recentErrors: 0,
        breakdown: {
          byProfile: [],
          byResourceType: []
        }
      })
    })

    it('should handle storage errors', async () => {
      mockStorage.getValidationProfiles.mockRejectedValue(new Error('Database error'))

      const result = await dashboardService.getValidationStats()

      expect(result.success).toBe(false)
      expect(result.error?.message).toBe('Database error')
    })
  })

  describe('getCombinedDashboard', () => {
    it('should return combined dashboard data successfully', async () => {
      const mockServer = {
        id: '1',
        name: 'Test Server',
        baseUrl: 'https://hapi.fhir.org/baseR4',
        isActive: true
      }

      const mockServerStats = {
        success: true,
        data: {
          serverName: 'Test Server',
          serverUrl: 'https://hapi.fhir.org/baseR4',
          isConnected: true,
          fhirVersion: '4.0.1',
          responseTime: 150,
          lastChecked: new Date().toISOString()
        }
      }

      const mockResourceStats = {
        success: true,
        data: {
          totalResources: 425,
          resourceTypes: [
            { resourceType: 'Patient', count: 100, percentage: 23.53 }
          ],
          lastUpdated: new Date().toISOString()
        }
      }

      const mockValidationStats = {
        success: true,
        data: {
          totalProfiles: 2,
          totalValidated: 3,
          validationCoverage: 100,
          validationProgress: 100,
          successRate: 66.67,
          errorRate: 33.33,
          recentErrors: 1,
          breakdown: {
            byProfile: [],
            byResourceType: []
          }
        }
      }

      // Mock the individual methods
      vi.spyOn(dashboardService, 'getServerStats').mockResolvedValue(mockServerStats)
      vi.spyOn(dashboardService, 'getResourceStats').mockResolvedValue(mockResourceStats)
      vi.spyOn(dashboardService, 'getValidationStats').mockResolvedValue(mockValidationStats)

      const result = await dashboardService.getCombinedDashboard()

      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        serverStats: mockServerStats.data,
        resourceStats: mockResourceStats.data,
        validationStats: mockValidationStats.data,
        lastUpdated: expect.any(String)
      })
    })

    it('should handle partial failures in combined dashboard', async () => {
      const mockServerStats = {
        success: true,
        data: {
          serverName: 'Test Server',
          serverUrl: 'https://hapi.fhir.org/baseR4',
          isConnected: true,
          fhirVersion: '4.0.1',
          responseTime: 150,
          lastChecked: new Date().toISOString()
        }
      }

      const mockResourceStats = {
        success: false,
        error: {
          message: 'Resource stats error'
        }
      }

      const mockValidationStats = {
        success: true,
        data: {
          totalProfiles: 2,
          totalValidated: 3,
          validationCoverage: 100,
          validationProgress: 100,
          successRate: 66.67,
          errorRate: 33.33,
          recentErrors: 1,
          breakdown: {
            byProfile: [],
            byResourceType: []
          }
        }
      }

      // Mock the individual methods
      vi.spyOn(dashboardService, 'getServerStats').mockResolvedValue(mockServerStats)
      vi.spyOn(dashboardService, 'getResourceStats').mockResolvedValue(mockResourceStats)
      vi.spyOn(dashboardService, 'getValidationStats').mockResolvedValue(mockValidationStats)

      const result = await dashboardService.getCombinedDashboard()

      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        serverStats: mockServerStats.data,
        resourceStats: null,
        validationStats: mockValidationStats.data,
        lastUpdated: expect.any(String),
        errors: ['Resource stats error']
      })
    })
  })

  describe('getDashboardCards', () => {
    it('should return dashboard cards successfully', async () => {
      const mockCards = [
        {
          id: '1',
          title: 'Server Status',
          type: 'server-status',
          data: { isConnected: true }
        },
        {
          id: '2',
          title: 'Resource Count',
          type: 'resource-count',
          data: { total: 425 }
        }
      ]

      mockStorage.getDashboardCards.mockResolvedValue(mockCards)

      const result = await dashboardService.getDashboardCards()

      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockCards)
    })

    it('should handle storage errors for dashboard cards', async () => {
      mockStorage.getDashboardCards.mockRejectedValue(new Error('Database error'))

      const result = await dashboardService.getDashboardCards()

      expect(result.success).toBe(false)
      expect(result.error?.message).toBe('Database error')
    })
  })
})