import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import { createServer } from 'http'

// Mock dependencies with minimal setup
vi.mock('../db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        limit: vi.fn(() => Promise.resolve([]))
      }))
    }))
  }
}))

vi.mock('../services/fhir/fhir-client', () => ({
  FhirClient: vi.fn().mockImplementation(() => ({
    testConnection: vi.fn().mockResolvedValue({ connected: true, version: '4.0.1' }),
    getResourceCount: vi.fn().mockResolvedValue(100),
    searchResources: vi.fn().mockResolvedValue([]),
    getResourceCounts: vi.fn().mockResolvedValue({ Patient: 100, Observation: 200 })
  }))
}))

vi.mock('../services/validation/core/validation-engine', () => ({
  ValidationEngine: vi.fn().mockImplementation(() => ({
    validateResource: vi.fn().mockResolvedValue({ isValid: true, issues: [] }),
    validateResources: vi.fn().mockResolvedValue([]),
    startValidation: vi.fn().mockResolvedValue({ success: true }),
    stopValidation: vi.fn().mockResolvedValue({ success: true }),
    pauseValidation: vi.fn().mockResolvedValue({ success: true }),
    resumeValidation: vi.fn().mockResolvedValue({ success: true }),
    getStatus: vi.fn().mockReturnValue({ status: 'idle', progress: 0 }),
    getProgress: vi.fn().mockReturnValue({ progress: 0, total: 0 })
  })),
  getValidationEngine: vi.fn().mockImplementation(() => ({
    validateResource: vi.fn().mockResolvedValue({ isValid: true, issues: [] }),
    validateResources: vi.fn().mockResolvedValue([]),
    startValidation: vi.fn().mockResolvedValue({ success: true }),
    stopValidation: vi.fn().mockResolvedValue({ success: true }),
    pauseValidation: vi.fn().mockResolvedValue({ success: true }),
    resumeValidation: vi.fn().mockResolvedValue({ success: true }),
    getStatus: vi.fn().mockReturnValue({ status: 'idle', progress: 0 }),
    getProgress: vi.fn().mockReturnValue({ progress: 0, total: 0 })
  }))
}))

vi.mock('../services/dashboard/dashboard-service', () => ({
  DashboardService: vi.fn().mockImplementation(() => ({
    getServerStats: vi.fn().mockResolvedValue({ totalResources: 1000 }),
    getResourceStats: vi.fn().mockResolvedValue({ totalValidated: 500 }),
    getValidationStats: vi.fn().mockResolvedValue({ validResources: 400, errorResources: 100 }),
    getCombinedDashboard: vi.fn().mockResolvedValue({ combined: true }),
    getFhirServerStats: vi.fn().mockResolvedValue({ totalResources: 1000 }),
    getCombinedDashboardData: vi.fn().mockResolvedValue({ combined: true })
  }))
}))

vi.mock('../storage', () => ({
  Storage: vi.fn().mockImplementation(() => ({
    getFhirServers: vi.fn().mockResolvedValue([{ id: 1, name: 'Test Server', url: 'http://test.com' }]),
    getActiveFhirServer: vi.fn().mockResolvedValue({ id: 1, name: 'Test Server', url: 'http://test.com' }),
    addFhirServer: vi.fn().mockResolvedValue({ id: 2, name: 'New Server', url: 'http://new.com' }),
    updateFhirServer: vi.fn().mockResolvedValue({ id: 1, name: 'Updated Server', url: 'http://updated.com' }),
    deleteFhirServer: vi.fn().mockResolvedValue(true)
  })),
  storage: {
    getFhirServers: vi.fn().mockResolvedValue([{ id: 1, name: 'Test Server', url: 'http://test.com' }]),
    getActiveFhirServer: vi.fn().mockResolvedValue({ id: 1, name: 'Test Server', url: 'http://test.com' }),
    addFhirServer: vi.fn().mockResolvedValue({ id: 2, name: 'New Server', url: 'http://new.com' }),
    updateFhirServer: vi.fn().mockResolvedValue({ id: 1, name: 'Updated Server', url: 'http://updated.com' }),
    deleteFhirServer: vi.fn().mockResolvedValue(true)
  }
}))

vi.mock('../services/validation/settings/validation-settings-service', () => ({
  getValidationSettingsService: vi.fn().mockImplementation(() => ({
    getCurrentSettings: vi.fn().mockResolvedValue({
      structural: { enabled: true, severity: 'error' },
      profile: { enabled: true, severity: 'warning' }
    }),
    getActiveSettings: vi.fn().mockResolvedValue({
      structural: { enabled: true, severity: 'error' },
      profile: { enabled: true, severity: 'warning' }
    }),
    getSettings: vi.fn().mockResolvedValue({
      structural: { enabled: true, severity: 'error' },
      profile: { enabled: true, severity: 'warning' }
    }),
    updateSettings: vi.fn().mockResolvedValue({
      structural: { enabled: true, severity: 'error' },
      profile: { enabled: true, severity: 'warning' }
    }),
    getPresets: vi.fn().mockResolvedValue([{ id: 'default', name: 'Default' }]),
    getStatistics: vi.fn().mockResolvedValue({ totalSettings: 1 }),
    on: vi.fn(),
    emit: vi.fn(),
    off: vi.fn()
  }))
}))

// Mock the logger
vi.mock('../server/utils/logger.js', () => ({
  logger: {
    sse: vi.fn(),
    getLogLevel: vi.fn(() => 2)
  }
}))

// Import the server after mocking
import { app } from './server'

describe('API Endpoints - Simple Tests', () => {
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

  describe('Basic API Endpoints', () => {
    it('should handle validation settings endpoint', async () => {
      const response = await request(server)
        .get('/api/validation/settings')

      if (response.status !== 200) {
        console.log('Validation settings error:', response.status, response.body)
      }

      expect(response.status).toBe(200)
      expect(response.body).toBeDefined()
      expect(response.body.structural).toBeDefined()
    })

    it('should handle dashboard stats endpoint', async () => {
      const response = await request(server)
        .get('/api/dashboard/stats')
        .expect(200)

      expect(response.body).toBeDefined()
    })

    it('should handle FHIR resource counts endpoint', async () => {
      const response = await request(server)
        .get('/api/fhir/resource-counts')
        .expect(200)

      expect(response.body).toBeDefined()
    })
  })

  describe('Error Handling', () => {
    it('should handle 404 errors gracefully', async () => {
      const response = await request(server)
        .get('/api/nonexistent')
        .expect(404)

      expect(response.body).toBeDefined()
    })
  })
})
