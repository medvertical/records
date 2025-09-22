import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import { createServer } from 'http'

// Mock dependencies
vi.mock('./services/fhir/fhir-client', () => ({
  FhirClient: vi.fn().mockImplementation(() => ({
    testConnection: vi.fn(),
    getResourceCount: vi.fn(),
    searchResources: vi.fn()
  }))
}))

vi.mock('./services/validation/rock-solid-validation-engine', () => ({
  getRockSolidValidationEngine: vi.fn().mockImplementation(() => ({
    validateResource: vi.fn(),
    validateResources: vi.fn(),
    startValidation: vi.fn(),
    stopValidation: vi.fn(),
    pauseValidation: vi.fn(),
    resumeValidation: vi.fn(),
    getStatus: vi.fn()
  }))
}))

vi.mock('./services/dashboard/dashboard-service', () => ({
  DashboardService: vi.fn().mockImplementation(() => ({
    getServerStats: vi.fn(),
    getResourceStats: vi.fn(),
    getValidationStats: vi.fn(),
    getCombinedDashboard: vi.fn()
  }))
}))

vi.mock('./storage', () => ({
  Storage: vi.fn().mockImplementation(() => ({
    getFhirServers: vi.fn(),
    getActiveFhirServer: vi.fn(),
    addFhirServer: vi.fn(),
    updateFhirServer: vi.fn(),
    deleteFhirServer: vi.fn()
  }))
}))

// Mock the logger
vi.mock('./server/utils/logger.js', () => ({
  logger: {
    sse: vi.fn(),
    getLogLevel: vi.fn(() => 2)
  }
}))

// Mock the error handler
vi.mock('./server/utils/error-handler.js', () => ({
  errorHandler: {
    handleError: vi.fn((error) => ({
      success: false,
      error: {
        code: 'API_ERROR',
        message: error.message,
        category: 'api',
        severity: 'high',
        recoverable: true,
        recoveryAction: 'retry'
      }
    }))
  }
}))

// Import the server after mocking
import { app } from './server'

describe('API Endpoints', () => {
  let server: any

  beforeEach(() => {
    vi.clearAllMocks()
    server = createServer(app)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    server.close()
  })

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(server)
        .get('/api/health')
        .expect(200)

      expect(response.body).toEqual({
        status: 'healthy',
        timestamp: expect.any(String),
        uptime: expect.any(Number)
      })
    })
  })

  describe('FHIR Server Management', () => {
    it('should get FHIR servers', async () => {
      const mockServers = [
        {
          id: '1',
          name: 'Test Server',
          baseUrl: 'https://hapi.fhir.org/baseR4',
          isActive: true,
          authConfig: null
        }
      ]

      const { Storage } = await import('./storage')
      const mockStorage = new Storage()
      vi.mocked(mockStorage.getFhirServers).mockResolvedValue(mockServers)

      const response = await request(server)
        .get('/api/fhir/servers')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toEqual(mockServers)
    })

    it('should add new FHIR server', async () => {
      const serverData = {
        name: 'New Server',
        baseUrl: 'https://new-server.com',
        isActive: false,
        authConfig: null
      }

      const mockServer = {
        id: '2',
        ...serverData
      }

      const { Storage } = await import('./storage')
      const mockStorage = new Storage()
      vi.mocked(mockStorage.addFhirServer).mockResolvedValue(mockServer)

      const response = await request(server)
        .post('/api/fhir/servers')
        .send(serverData)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toEqual(mockServer)
    })

    it('should update FHIR server', async () => {
      const serverId = '1'
      const updateData = {
        name: 'Updated Server',
        baseUrl: 'https://updated-server.com',
        isActive: true,
        authConfig: { type: 'basic', username: 'user', password: 'pass' }
      }

      const mockServer = {
        id: serverId,
        ...updateData
      }

      const { Storage } = await import('./storage')
      const mockStorage = new Storage()
      vi.mocked(mockStorage.updateFhirServer).mockResolvedValue(mockServer)

      const response = await request(server)
        .put(`/api/fhir/servers/${serverId}`)
        .send(updateData)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toEqual(mockServer)
    })

    it('should delete FHIR server', async () => {
      const serverId = '1'

      const { Storage } = await import('./storage')
      const mockStorage = new Storage()
      vi.mocked(mockStorage.deleteFhirServer).mockResolvedValue(true)

      const response = await request(server)
        .delete(`/api/fhir/servers/${serverId}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toBe(true)
    })

    it('should test FHIR server connection', async () => {
      const serverId = '1'
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

      const { FhirClient } = await import('./services/fhir/fhir-client')
      const mockFhirClient = new FhirClient()
      vi.mocked(mockFhirClient.testConnection).mockResolvedValue(mockConnectionResult)

      const response = await request(server)
        .post(`/api/fhir/servers/${serverId}/test`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toEqual(mockConnectionResult.data)
    })
  })

  describe('Validation Engine', () => {
    it('should start validation', async () => {
      const mockResult = {
        success: true,
        data: {
          isValidating: true,
          status: 'running',
          progress: 0
        }
      }

      const { getRockSolidValidationEngine } = await import('./services/validation/rock-solid-validation-engine')
      const mockValidationEngine = getRockSolidValidationEngine()
      vi.mocked(mockValidationEngine.startValidation).mockResolvedValue(mockResult)

      const response = await request(server)
        .post('/api/validation/start')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toEqual(mockResult.data)
    })

    it('should stop validation', async () => {
      const mockResult = {
        success: true,
        data: {
          isValidating: false,
          status: 'idle',
          progress: 50
        }
      }

      const { getRockSolidValidationEngine } = await import('./services/validation/rock-solid-validation-engine')
      const mockValidationEngine = getRockSolidValidationEngine()
      vi.mocked(mockValidationEngine.stopValidation).mockResolvedValue(mockResult)

      const response = await request(server)
        .post('/api/validation/stop')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toEqual(mockResult.data)
    })

    it('should pause validation', async () => {
      const mockResult = {
        success: true,
        data: {
          isValidating: false,
          status: 'paused',
          progress: 30
        }
      }

      const { getRockSolidValidationEngine } = await import('./services/validation/rock-solid-validation-engine')
      const mockValidationEngine = getRockSolidValidationEngine()
      vi.mocked(mockValidationEngine.pauseValidation).mockResolvedValue(mockResult)

      const response = await request(server)
        .post('/api/validation/pause')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toEqual(mockResult.data)
    })

    it('should resume validation', async () => {
      const mockResult = {
        success: true,
        data: {
          isValidating: true,
          status: 'running',
          progress: 30
        }
      }

      const { getRockSolidValidationEngine } = await import('./services/validation/rock-solid-validation-engine')
      const mockValidationEngine = getRockSolidValidationEngine()
      vi.mocked(mockValidationEngine.resumeValidation).mockResolvedValue(mockResult)

      const response = await request(server)
        .post('/api/validation/resume')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toEqual(mockResult.data)
    })

    it('should get validation status', async () => {
      const mockStatus = {
        isValidating: true,
        status: 'running',
        progress: 45,
        currentResource: 'Patient/123',
        totalResources: 100,
        processedResources: 45,
        successRate: 0.95,
        errors: []
      }

      const { getRockSolidValidationEngine } = await import('./services/validation/rock-solid-validation-engine')
      const mockValidationEngine = getRockSolidValidationEngine()
      vi.mocked(mockValidationEngine.getStatus).mockReturnValue(mockStatus)

      const response = await request(server)
        .get('/api/validation/status')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toEqual(mockStatus)
    })

    it('should get validation progress', async () => {
      const mockProgress = {
        isValidating: true,
        status: 'running',
        progress: 45,
        currentResource: 'Patient/123',
        totalResources: 100,
        processedResources: 45,
        successRate: 0.95,
        errors: []
      }

      const { getRockSolidValidationEngine } = await import('./services/validation/rock-solid-validation-engine')
      const mockValidationEngine = getRockSolidValidationEngine()
      vi.mocked(mockValidationEngine.getStatus).mockReturnValue(mockProgress)

      const response = await request(server)
        .get('/api/validation/progress')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toEqual(mockProgress)
    })
  })

  describe('Dashboard', () => {
    it('should get server stats', async () => {
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

      const { DashboardService } = await import('./services/dashboard/dashboard-service')
      const mockDashboardService = new DashboardService()
      vi.mocked(mockDashboardService.getServerStats).mockResolvedValue(mockServerStats)

      const response = await request(server)
        .get('/api/dashboard/server-stats')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toEqual(mockServerStats.data)
    })

    it('should get resource stats', async () => {
      const mockResourceStats = {
        success: true,
        data: {
          totalResources: 425,
          resourceTypes: [
            { resourceType: 'Patient', count: 100, percentage: 23.53 },
            { resourceType: 'Observation', count: 250, percentage: 58.82 }
          ],
          lastUpdated: new Date().toISOString()
        }
      }

      const { DashboardService } = await import('./services/dashboard/dashboard-service')
      const mockDashboardService = new DashboardService()
      vi.mocked(mockDashboardService.getResourceStats).mockResolvedValue(mockResourceStats)

      const response = await request(server)
        .get('/api/dashboard/resource-stats')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toEqual(mockResourceStats.data)
    })

    it('should get validation stats', async () => {
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

      const { DashboardService } = await import('./services/dashboard/dashboard-service')
      const mockDashboardService = new DashboardService()
      vi.mocked(mockDashboardService.getValidationStats).mockResolvedValue(mockValidationStats)

      const response = await request(server)
        .get('/api/dashboard/validation-stats')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toEqual(mockValidationStats.data)
    })

    it('should get combined dashboard data', async () => {
      const mockCombinedData = {
        success: true,
        data: {
          serverStats: {
            serverName: 'Test Server',
            serverUrl: 'https://hapi.fhir.org/baseR4',
            isConnected: true,
            fhirVersion: '4.0.1',
            responseTime: 150,
            lastChecked: new Date().toISOString()
          },
          resourceStats: {
            totalResources: 425,
            resourceTypes: [],
            lastUpdated: new Date().toISOString()
          },
          validationStats: {
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
          },
          lastUpdated: new Date().toISOString()
        }
      }

      const { DashboardService } = await import('./services/dashboard/dashboard-service')
      const mockDashboardService = new DashboardService()
      vi.mocked(mockDashboardService.getCombinedDashboard).mockResolvedValue(mockCombinedData)

      const response = await request(server)
        .get('/api/dashboard/combined')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toEqual(mockCombinedData.data)
    })
  })

  describe('SSE Endpoint', () => {
    it('should establish SSE connection', async () => {
      const response = await request(server)
        .get('/api/validation/stream')
        .expect(200)

      expect(response.headers['content-type']).toContain('text/event-stream')
      expect(response.headers['cache-control']).toBe('no-cache')
      expect(response.headers['connection']).toBe('keep-alive')
    })

    it('should send heartbeat messages', async () => {
      const response = await request(server)
        .get('/api/validation/stream')
        .expect(200)

      // Wait for heartbeat
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(response.headers['content-type']).toContain('text/event-stream')
    })
  })

  describe('Error Handling', () => {
    it('should handle 404 errors', async () => {
      const response = await request(server)
        .get('/api/non-existent-endpoint')
        .expect(404)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBeDefined()
    })

    it('should handle validation errors', async () => {
      const response = await request(server)
        .post('/api/fhir/servers')
        .send({}) // Missing required fields
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBeDefined()
    })

    it('should handle server errors', async () => {
      const { Storage } = await import('./storage')
      const mockStorage = new Storage()
      vi.mocked(mockStorage.getFhirServers).mockRejectedValue(new Error('Database error'))

      const response = await request(server)
        .get('/api/fhir/servers')
        .expect(500)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBeDefined()
    })
  })

  describe('CORS', () => {
    it('should handle CORS preflight requests', async () => {
      const response = await request(server)
        .options('/api/fhir/servers')
        .expect(200)

      expect(response.headers['access-control-allow-origin']).toBe('*')
      expect(response.headers['access-control-allow-methods']).toContain('GET')
      expect(response.headers['access-control-allow-methods']).toContain('POST')
      expect(response.headers['access-control-allow-methods']).toContain('PUT')
      expect(response.headers['access-control-allow-methods']).toContain('DELETE')
    })

    it('should include CORS headers in responses', async () => {
      const response = await request(server)
        .get('/api/health')
        .expect(200)

      expect(response.headers['access-control-allow-origin']).toBe('*')
    })
  })
})

