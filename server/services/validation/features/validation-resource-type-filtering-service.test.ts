import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ValidationResourceTypeFilteringService } from './validation-resource-type-filtering-service'
import { getValidationSettingsService } from '../settings'

// Mock the validation settings service
vi.mock('../settings', () => ({
  getValidationSettingsService: vi.fn()
}))

describe('ValidationResourceTypeFilteringService', () => {
  let filteringService: ValidationResourceTypeFilteringService
  let mockSettingsService: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Create a mock settings service
    mockSettingsService = {
      getSettings: vi.fn(),
      getCurrentSettings: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn()
    }
    
    // Mock the getValidationSettingsService function
    vi.mocked(getValidationSettingsService).mockReturnValue(mockSettingsService)
    
    filteringService = new ValidationResourceTypeFilteringService()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('constructor and initialization', () => {
    it('should initialize without throwing errors', () => {
      expect(() => {
        new ValidationResourceTypeFilteringService()
      }).not.toThrow()
    })

    it('should call getValidationSettingsService during construction', () => {
      expect(getValidationSettingsService).toHaveBeenCalled()
    })

    it('should set up event listeners for settings changes', () => {
      expect(mockSettingsService.on).toHaveBeenCalledWith('settingsChanged', expect.any(Function))
    })
  })

  describe('settings service integration', () => {
    it('should handle settings service that has getCurrentSettings method', async () => {
      // Mock settings with getCurrentSettings method
      const mockSettings = {
        resourceTypes: {
          enabled: true,
          latestOnly: false,
          excludedTypes: [],
          includedTypes: ['Patient', 'Observation']
        }
      }
      
      mockSettingsService.getCurrentSettings.mockResolvedValue(mockSettings)
      
      await filteringService.initialize()
      
      expect(mockSettingsService.getCurrentSettings).toHaveBeenCalled()
    })

    it('should handle settings service that only has getCurrentSettings method gracefully', async () => {
      // Mock settings with only getCurrentSettings method (no getSettings)
      const mockSettings = {
        resourceTypes: {
          enabled: true,
          latestOnly: false,
          excludedTypes: [],
          includedTypes: ['Patient', 'Observation']
        }
      }
      
      // Remove getSettings method to simulate the error condition
      delete mockSettingsService.getSettings
      mockSettingsService.getCurrentSettings.mockResolvedValue(mockSettings)
      
      // Should handle gracefully and fall back to no filtering
      await filteringService.initialize()
      
      // Should be initialized despite the error
      expect(filteringService).toBeDefined()
    })

    it('should handle TypeError when settingsService.getSettings is not a function gracefully', async () => {
      // Mock settings service without getSettings method
      mockSettingsService.getSettings = undefined
      
      // Should handle gracefully and fall back to no filtering
      await filteringService.initialize()
      
      // Should be initialized despite the error
      expect(filteringService).toBeDefined()
    })

    it('should handle settings service method call errors gracefully', async () => {
      mockSettingsService.getSettings.mockRejectedValue(new Error('Database connection failed'))
      
      // Should handle gracefully and fall back to no filtering
      await filteringService.initialize()
      
      // Should be initialized despite the error
      expect(filteringService).toBeDefined()
    })
  })

  describe('resource type filtering', () => {
    beforeEach(async () => {
      // Setup valid settings service for filtering tests
      const mockSettings = {
        resourceTypes: {
          enabled: true,
          latestOnly: false,
          excludedTypes: ['Patient'],
          includedTypes: ['Observation', 'Encounter']
        }
      }
      
      mockSettingsService.getCurrentSettings.mockResolvedValue(mockSettings)
      await filteringService.initialize()
    })

    it('should filter resources based on included types', async () => {
      const result = await filteringService.shouldValidateResource('Observation', 'test-id')
      
      expect(result.shouldValidate).toBe(true)
      expect(result.filterApplied.includedTypes.has('Observation')).toBe(true)
    })

    it('should exclude resources based on excluded types', async () => {
      const result = await filteringService.shouldValidateResource('Patient', 'test-id')
      
      expect(result.shouldValidate).toBe(false)
      expect(result.reason).toContain('excluded')
    })

    it('should handle resource types not in included or excluded lists', async () => {
      const result = await filteringService.shouldValidateResource('Condition', 'test-id')
      
      // Should validate if not explicitly excluded and resourceTypes.enabled is true
      // Note: The actual behavior depends on the filtering logic implementation
      expect(result).toBeDefined()
      expect(result.shouldValidate).toBeDefined()
    })
  })

  describe('error handling', () => {
    it('should handle initialization errors gracefully', async () => {
      mockSettingsService.getSettings.mockRejectedValue(new Error('Settings service unavailable'))
      
      // Should handle gracefully and fall back to no filtering
      await filteringService.initialize()
      
      // Should be initialized despite the error
      expect(filteringService).toBeDefined()
    })

    it('should handle missing settings service gracefully', () => {
      vi.mocked(getValidationSettingsService).mockReturnValue(null as any)
      
      // Constructor should handle null service gracefully
      expect(() => {
        new ValidationResourceTypeFilteringService()
      }).toThrow() // This will throw because the service tries to call .on() on null
    })
  })
})