import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { errorHandler } from './error-handler'

// Mock the logger
vi.mock('./logger.js', () => ({
  logger: {
    error: vi.fn(),
    getLogLevel: vi.fn(() => 2)
  }
}))

describe('errorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('handleError', () => {
    it('should handle standard Error objects', () => {
      const error = new Error('Test error message')
      const result = errorHandler.handleError(error)

      expect(result).toEqual({
        success: false,
        error: {
          code: 'UNKNOWN_ERROR',
          message: 'Test error message',
          category: 'unknown',
          severity: 'high',
          recoverable: true,
          recoveryAction: 'retry',
          timestamp: expect.any(String)
        },
        timestamp: expect.any(String)
      })
    })

    it('should handle errors with custom context', () => {
      const error = new Error('Validation failed')
      const context = {
        service: 'validation',
        operation: 'validateResource',
        resourceType: 'Patient'
      }

      const result = errorHandler.handleError(error, context)

      expect(result).toEqual({
        success: false,
        error: {
          code: 'UNKNOWN_ERROR',
          message: 'Validation failed',
          category: 'unknown',
          severity: 'high',
          recoverable: true,
          recoveryAction: 'retry',
          context,
          timestamp: expect.any(String)
        },
        timestamp: expect.any(String)
      })
    })

    it('should handle errors with custom options', () => {
      const error = new Error('Database connection failed')
      const options = {
        code: 'DATABASE_CONNECTION_ERROR',
        category: 'database',
        severity: 'critical' as const,
        recoverable: false,
        recoveryAction: 'system-restart' as const
      }

      const result = errorHandler.handleError(error, undefined, options)

      expect(result).toEqual({
        success: false,
        error: {
          code: 'DATABASE_CONNECTION_ERROR',
          message: 'Database connection failed',
          category: 'database',
          severity: 'critical',
          recoverable: false,
          recoveryAction: 'system-restart',
          timestamp: expect.any(String)
        },
        timestamp: expect.any(String)
      })
    })

    it('should handle string errors', () => {
      const error = 'Simple string error'
      const result = errorHandler.handleError(error)

      expect(result).toEqual({
        success: false,
        error: {
          code: 'UNKNOWN_ERROR',
          message: 'Simple string error',
          category: 'unknown',
          severity: 'high',
          recoverable: true,
          recoveryAction: 'retry',
          timestamp: expect.any(String)
        },
        timestamp: expect.any(String)
      })
    })

    it('should handle null/undefined errors', () => {
      const result = errorHandler.handleError(null)

      expect(result).toEqual({
        success: false,
        error: {
          code: 'UNKNOWN_ERROR',
          message: 'Unknown error occurred',
          category: 'unknown',
          severity: 'high',
          recoverable: true,
          recoveryAction: 'retry',
          timestamp: expect.any(String)
        },
        timestamp: expect.any(String)
      })
    })

    it('should handle errors with stack traces', () => {
      const error = new Error('Error with stack')
      error.stack = 'Error: Error with stack\n    at test (test.js:1:1)'

      const result = errorHandler.handleError(error)

      expect(result.error.message).toBe('Error with stack')
      // Stack trace should be included in development
      expect(result.error.stack).toBeDefined()
    })

    it('should categorize errors by message patterns', () => {
      const validationError = new Error('Validation failed: missing required field')
      const networkError = new Error('Network request failed')
      const databaseError = new Error('Database query failed')
      const authError = new Error('Authentication required')

      const validationResult = errorHandler.handleError(validationError)
      const networkResult = errorHandler.handleError(networkError)
      const databaseResult = errorHandler.handleError(databaseError)
      const authResult = errorHandler.handleError(authError)

      expect(validationResult.error.category).toBe('validation')
      expect(networkResult.error.category).toBe('network')
      expect(databaseResult.error.category).toBe('database')
      expect(authResult.error.category).toBe('authentication')
    })

    it('should determine severity based on error type', () => {
      const criticalError = new Error('System crash')
      const highError = new Error('Service unavailable')
      const mediumError = new Error('Partial data loss')
      const lowError = new Error('Minor warning')

      const criticalResult = errorHandler.handleError(criticalError)
      const highResult = errorHandler.handleError(highError)
      const mediumResult = errorHandler.handleError(mediumError)
      const lowResult = errorHandler.handleError(lowError)

      expect(criticalResult.error.severity).toBe('critical')
      expect(highResult.error.severity).toBe('high')
      expect(mediumResult.error.severity).toBe('medium')
      expect(lowResult.error.severity).toBe('low')
    })

    it('should suggest appropriate recovery actions', () => {
      const retryError = new Error('Temporary network issue')
      const fallbackError = new Error('Primary service unavailable')
      const skipError = new Error('Non-critical validation failed')
      const abortError = new Error('Critical system error')

      const retryResult = errorHandler.handleError(retryError)
      const fallbackResult = errorHandler.handleError(fallbackError)
      const skipResult = errorHandler.handleError(skipError)
      const abortResult = errorHandler.handleError(abortError)

      expect(retryResult.error.recoveryAction).toBe('retry')
      expect(fallbackResult.error.recoveryAction).toBe('fallback')
      expect(skipResult.error.recoveryAction).toBe('skip')
      expect(abortResult.error.recoveryAction).toBe('abort')
    })
  })

  describe('createError', () => {
    it('should create standardized error objects', () => {
      const error = errorHandler.createError('VALIDATION_FAILED', 'Validation failed', {
        category: 'validation',
        severity: 'high',
        recoverable: true,
        recoveryAction: 'retry'
      })

      expect(error).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Validation failed',
          category: 'validation',
          severity: 'high',
          recoverable: true,
          recoveryAction: 'retry',
          timestamp: expect.any(String)
        },
        timestamp: expect.any(String)
      })
    })

    it('should create errors with context', () => {
      const context = {
        service: 'validation',
        operation: 'validateResource',
        resourceType: 'Patient'
      }

      const error = errorHandler.createError('VALIDATION_FAILED', 'Validation failed', {
        category: 'validation',
        context
      })

      expect(error.error.context).toEqual(context)
    })

    it('should create errors with suggestions', () => {
      const suggestions = [
        'Check if the resource structure is correct',
        'Verify required fields are present'
      ]

      const error = errorHandler.createError('VALIDATION_FAILED', 'Validation failed', {
        category: 'validation',
        suggestions
      })

      expect(error.error.suggestions).toEqual(suggestions)
    })
  })

  describe('isRecoverable', () => {
    it('should determine if error is recoverable', () => {
      const recoverableError = new Error('Temporary network issue')
      const nonRecoverableError = new Error('System crash')

      expect(errorHandler.isRecoverable(recoverableError)).toBe(true)
      expect(errorHandler.isRecoverable(nonRecoverableError)).toBe(false)
    })

    it('should handle custom recoverable flags', () => {
      const error = new Error('Custom error')
      const options = { recoverable: false }

      expect(errorHandler.isRecoverable(error, options)).toBe(false)
    })
  })

  describe('getRecoveryAction', () => {
    it('should suggest appropriate recovery actions', () => {
      const retryError = new Error('Temporary network issue')
      const fallbackError = new Error('Primary service unavailable')
      const skipError = new Error('Non-critical validation failed')
      const abortError = new Error('Critical system error')

      expect(errorHandler.getRecoveryAction(retryError)).toBe('retry')
      expect(errorHandler.getRecoveryAction(fallbackError)).toBe('fallback')
      expect(errorHandler.getRecoveryAction(skipError)).toBe('skip')
      expect(errorHandler.getRecoveryAction(abortError)).toBe('abort')
    })

    it('should handle custom recovery actions', () => {
      const error = new Error('Custom error')
      const options = { recoveryAction: 'user-intervention' as const }

      expect(errorHandler.getRecoveryAction(error, options)).toBe('user-intervention')
    })
  })

  describe('categorizeError', () => {
    it('should categorize errors by message patterns', () => {
      expect(errorHandler.categorizeError(new Error('Validation failed'))).toBe('validation')
      expect(errorHandler.categorizeError(new Error('Network request failed'))).toBe('network')
      expect(errorHandler.categorizeError(new Error('Database query failed'))).toBe('database')
      expect(errorHandler.categorizeError(new Error('Authentication required'))).toBe('authentication')
      expect(errorHandler.categorizeError(new Error('Configuration error'))).toBe('configuration')
      expect(errorHandler.categorizeError(new Error('System error'))).toBe('system')
      expect(errorHandler.categorizeError(new Error('User input error'))).toBe('user-input')
      expect(errorHandler.categorizeError(new Error('External service error'))).toBe('external-service')
      expect(errorHandler.categorizeError(new Error('Timeout error'))).toBe('timeout')
      expect(errorHandler.categorizeError(new Error('Rate limit exceeded'))).toBe('rate-limit')
      expect(errorHandler.categorizeError(new Error('Unknown error'))).toBe('unknown')
    })

    it('should handle custom categories', () => {
      const error = new Error('Custom error')
      const options = { category: 'custom' as any }

      expect(errorHandler.categorizeError(error, options)).toBe('custom')
    })
  })

  describe('determineSeverity', () => {
    it('should determine severity based on error type', () => {
      expect(errorHandler.determineSeverity(new Error('System crash'))).toBe('critical')
      expect(errorHandler.determineSeverity(new Error('Service unavailable'))).toBe('high')
      expect(errorHandler.determineSeverity(new Error('Partial data loss'))).toBe('medium')
      expect(errorHandler.determineSeverity(new Error('Minor warning'))).toBe('low')
    })

    it('should handle custom severities', () => {
      const error = new Error('Custom error')
      const options = { severity: 'medium' as const }

      expect(errorHandler.determineSeverity(error, options)).toBe('medium')
    })
  })

  describe('error metrics', () => {
    it('should track error metrics', () => {
      const error1 = new Error('Validation failed')
      const error2 = new Error('Network error')
      const error3 = new Error('Validation failed')

      errorHandler.handleError(error1)
      errorHandler.handleError(error2)
      errorHandler.handleError(error3)

      const metrics = errorHandler.getErrorMetrics()

      expect(metrics.totalErrors).toBe(3)
      expect(metrics.errorsByCategory.validation).toBe(2)
      expect(metrics.errorsByCategory.network).toBe(1)
      expect(metrics.errorsBySeverity.high).toBe(3)
    })

    it('should reset error metrics', () => {
      const error = new Error('Test error')
      errorHandler.handleError(error)

      let metrics = errorHandler.getErrorMetrics()
      expect(metrics.totalErrors).toBe(1)

      errorHandler.resetErrorMetrics()

      metrics = errorHandler.getErrorMetrics()
      expect(metrics.totalErrors).toBe(0)
    })
  })
})

