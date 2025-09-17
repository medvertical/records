import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ValidationEngine } from './validation-engine'
import { FhirClient } from '../fhir/fhir-client'
import { ProfileManager } from '../profiles/profile-manager'

// Mock dependencies
vi.mock('../fhir/fhir-client')
vi.mock('../profiles/profile-manager')
vi.mock('../../utils/logger.js', () => ({
  logger: {
    validation: vi.fn(),
    getLogLevel: vi.fn(() => 2)
  }
}))

// Mock the error handler
vi.mock('../../utils/error-handler.js', () => ({
  errorHandler: {
    handleError: vi.fn((error) => ({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: error.message,
        category: 'validation',
        severity: 'high',
        recoverable: true,
        recoveryAction: 'retry'
      }
    }))
  }
}))

describe('ValidationEngine', () => {
  let validationEngine: ValidationEngine
  let mockFhirClient: any
  let mockProfileManager: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Create mock instances
    mockFhirClient = {
      searchResources: vi.fn(),
      getResourceCount: vi.fn()
    }
    
    mockProfileManager = {
      getValidationProfiles: vi.fn(),
      validateResource: vi.fn()
    }

    // Mock constructors
    vi.mocked(FhirClient).mockImplementation(() => mockFhirClient)
    vi.mocked(ProfileManager).mockImplementation(() => mockProfileManager)

    validationEngine = new ValidationEngine()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initialization', () => {
    it('should initialize with default state', () => {
      expect(validationEngine.getStatus()).toEqual({
        isValidating: false,
        status: 'idle',
        progress: 0,
        currentResource: null,
        totalResources: 0,
        processedResources: 0,
        successRate: 0,
        errors: []
      })
    })
  })

  describe('startValidation', () => {
    it('should start validation successfully', async () => {
      const mockProfiles = [
        { id: '1', name: 'Patient Profile', resourceType: 'Patient' },
        { id: '2', name: 'Observation Profile', resourceType: 'Observation' }
      ]

      const mockResources = {
        resourceType: 'Bundle',
        type: 'searchset',
        entry: [
          { resource: { id: '1', resourceType: 'Patient' } },
          { resource: { id: '2', resourceType: 'Patient' } }
        ]
      }

      mockProfileManager.getValidationProfiles.mockResolvedValue(mockProfiles)
      mockFhirClient.searchResources.mockResolvedValue(mockResources)
      mockProfileManager.validateResource.mockResolvedValue({
        isValid: true,
        errors: []
      })

      const result = await validationEngine.startValidation()

      expect(result.success).toBe(true)
      expect(validationEngine.getStatus().isValidating).toBe(true)
      expect(validationEngine.getStatus().status).toBe('running')
    })

    it('should handle validation start error', async () => {
      mockProfileManager.getValidationProfiles.mockRejectedValue(new Error('Profile error'))

      const result = await validationEngine.startValidation()

      expect(result.success).toBe(false)
      expect(result.error?.message).toBe('Profile error')
      expect(validationEngine.getStatus().isValidating).toBe(false)
    })

    it('should not start validation if already running', async () => {
      // Start validation first time
      mockProfileManager.getValidationProfiles.mockResolvedValue([])
      mockFhirClient.searchResources.mockResolvedValue({
        resourceType: 'Bundle',
        type: 'searchset',
        entry: []
      })

      await validationEngine.startValidation()

      // Try to start again
      const result = await validationEngine.startValidation()

      expect(result.success).toBe(false)
      expect(result.error?.message).toBe('Validation is already running')
    })
  })

  describe('stopValidation', () => {
    it('should stop validation successfully', async () => {
      // Start validation first
      mockProfileManager.getValidationProfiles.mockResolvedValue([])
      mockFhirClient.searchResources.mockResolvedValue({
        resourceType: 'Bundle',
        type: 'searchset',
        entry: []
      })

      await validationEngine.startValidation()

      const result = await validationEngine.stopValidation()

      expect(result.success).toBe(true)
      expect(validationEngine.getStatus().isValidating).toBe(false)
      expect(validationEngine.getStatus().status).toBe('idle')
    })

    it('should handle stop validation when not running', async () => {
      const result = await validationEngine.stopValidation()

      expect(result.success).toBe(false)
      expect(result.error?.message).toBe('Validation is not currently running')
    })
  })

  describe('pauseValidation', () => {
    it('should pause validation successfully', async () => {
      // Start validation first
      mockProfileManager.getValidationProfiles.mockResolvedValue([])
      mockFhirClient.searchResources.mockResolvedValue({
        resourceType: 'Bundle',
        type: 'searchset',
        entry: []
      })

      await validationEngine.startValidation()

      const result = await validationEngine.pauseValidation()

      expect(result.success).toBe(true)
      expect(validationEngine.getStatus().isValidating).toBe(false)
      expect(validationEngine.getStatus().status).toBe('paused')
    })

    it('should handle pause validation when not running', async () => {
      const result = await validationEngine.pauseValidation()

      expect(result.success).toBe(false)
      expect(result.error?.message).toBe('Validation is not currently running')
    })
  })

  describe('resumeValidation', () => {
    it('should resume validation successfully', async () => {
      // Start and pause validation first
      mockProfileManager.getValidationProfiles.mockResolvedValue([])
      mockFhirClient.searchResources.mockResolvedValue({
        resourceType: 'Bundle',
        type: 'searchset',
        entry: []
      })

      await validationEngine.startValidation()
      await validationEngine.pauseValidation()

      const result = await validationEngine.resumeValidation()

      expect(result.success).toBe(true)
      expect(validationEngine.getStatus().isValidating).toBe(true)
      expect(validationEngine.getStatus().status).toBe('running')
    })

    it('should handle resume validation when not paused', async () => {
      const result = await validationEngine.resumeValidation()

      expect(result.success).toBe(false)
      expect(result.error?.message).toBe('Validation is not currently paused')
    })
  })

  describe('getStatus', () => {
    it('should return current validation status', () => {
      const status = validationEngine.getStatus()

      expect(status).toEqual({
        isValidating: false,
        status: 'idle',
        progress: 0,
        currentResource: null,
        totalResources: 0,
        processedResources: 0,
        successRate: 0,
        errors: []
      })
    })

    it('should return updated status after starting validation', async () => {
      mockProfileManager.getValidationProfiles.mockResolvedValue([])
      mockFhirClient.searchResources.mockResolvedValue({
        resourceType: 'Bundle',
        type: 'searchset',
        entry: []
      })

      await validationEngine.startValidation()

      const status = validationEngine.getStatus()
      expect(status.isValidating).toBe(true)
      expect(status.status).toBe('running')
    })
  })

  describe('validation process', () => {
    it('should validate resources and update progress', async () => {
      const mockProfiles = [
        { id: '1', name: 'Patient Profile', resourceType: 'Patient' }
      ]

      const mockResources = {
        resourceType: 'Bundle',
        type: 'searchset',
        entry: [
          { resource: { id: '1', resourceType: 'Patient', name: [{ given: ['John'] }] } },
          { resource: { id: '2', resourceType: 'Patient', name: [{ given: ['Jane'] }] } }
        ]
      }

      mockProfileManager.getValidationProfiles.mockResolvedValue(mockProfiles)
      mockFhirClient.searchResources.mockResolvedValue(mockResources)
      mockProfileManager.validateResource.mockResolvedValue({
        isValid: true,
        errors: []
      })

      await validationEngine.startValidation()

      // Wait for validation to complete
      await new Promise(resolve => setTimeout(resolve, 100))

      const status = validationEngine.getStatus()
      expect(status.processedResources).toBe(2)
      expect(status.progress).toBe(100)
      expect(status.successRate).toBe(1)
    })

    it('should handle validation errors', async () => {
      const mockProfiles = [
        { id: '1', name: 'Patient Profile', resourceType: 'Patient' }
      ]

      const mockResources = {
        resourceType: 'Bundle',
        type: 'searchset',
        entry: [
          { resource: { id: '1', resourceType: 'Patient' } }
        ]
      }

      mockProfileManager.getValidationProfiles.mockResolvedValue(mockProfiles)
      mockFhirClient.searchResources.mockResolvedValue(mockResources)
      mockProfileManager.validateResource.mockResolvedValue({
        isValid: false,
        errors: [
          {
            severity: 'error',
            message: 'Missing required field: name',
            path: 'Patient.name'
          }
        ]
      })

      await validationEngine.startValidation()

      // Wait for validation to complete
      await new Promise(resolve => setTimeout(resolve, 100))

      const status = validationEngine.getStatus()
      expect(status.processedResources).toBe(1)
      expect(status.successRate).toBe(0)
      expect(status.errors).toHaveLength(1)
      expect(status.errors[0].message).toBe('Missing required field: name')
    })

    it('should handle resource fetch errors', async () => {
      const mockProfiles = [
        { id: '1', name: 'Patient Profile', resourceType: 'Patient' }
      ]

      mockProfileManager.getValidationProfiles.mockResolvedValue(mockProfiles)
      mockFhirClient.searchResources.mockRejectedValue(new Error('Network error'))

      const result = await validationEngine.startValidation()

      expect(result.success).toBe(false)
      expect(result.error?.message).toBe('Network error')
    })
  })

  describe('progress tracking', () => {
    it('should calculate progress correctly', async () => {
      const mockProfiles = [
        { id: '1', name: 'Patient Profile', resourceType: 'Patient' }
      ]

      const mockResources = {
        resourceType: 'Bundle',
        type: 'searchset',
        entry: [
          { resource: { id: '1', resourceType: 'Patient' } },
          { resource: { id: '2', resourceType: 'Patient' } },
          { resource: { id: '3', resourceType: 'Patient' } },
          { resource: { id: '4', resourceType: 'Patient' } }
        ]
      }

      mockProfileManager.getValidationProfiles.mockResolvedValue(mockProfiles)
      mockFhirClient.searchResources.mockResolvedValue(mockResources)
      mockProfileManager.validateResource.mockResolvedValue({
        isValid: true,
        errors: []
      })

      await validationEngine.startValidation()

      // Wait for partial completion
      await new Promise(resolve => setTimeout(resolve, 50))

      const status = validationEngine.getStatus()
      expect(status.totalResources).toBe(4)
      expect(status.processedResources).toBeGreaterThan(0)
      expect(status.progress).toBeGreaterThan(0)
    })
  })

  describe('error handling', () => {
    it('should handle profile manager errors', async () => {
      mockProfileManager.getValidationProfiles.mockRejectedValue(new Error('Profile service unavailable'))

      const result = await validationEngine.startValidation()

      expect(result.success).toBe(false)
      expect(result.error?.message).toBe('Profile service unavailable')
    })

    it('should handle FHIR client errors', async () => {
      const mockProfiles = [
        { id: '1', name: 'Patient Profile', resourceType: 'Patient' }
      ]

      mockProfileManager.getValidationProfiles.mockResolvedValue(mockProfiles)
      mockFhirClient.searchResources.mockRejectedValue(new Error('FHIR server unavailable'))

      const result = await validationEngine.startValidation()

      expect(result.success).toBe(false)
      expect(result.error?.message).toBe('FHIR server unavailable')
    })

    it('should handle validation service errors', async () => {
      const mockProfiles = [
        { id: '1', name: 'Patient Profile', resourceType: 'Patient' }
      ]

      const mockResources = {
        resourceType: 'Bundle',
        type: 'searchset',
        entry: [
          { resource: { id: '1', resourceType: 'Patient' } }
        ]
      }

      mockProfileManager.getValidationProfiles.mockResolvedValue(mockProfiles)
      mockFhirClient.searchResources.mockResolvedValue(mockResources)
      mockProfileManager.validateResource.mockRejectedValue(new Error('Validation service error'))

      await validationEngine.startValidation()

      // Wait for validation to complete
      await new Promise(resolve => setTimeout(resolve, 100))

      const status = validationEngine.getStatus()
      expect(status.errors).toHaveLength(1)
      expect(status.errors[0].message).toBe('Validation service error')
    })
  })
})

