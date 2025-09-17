import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { logger } from './logger'

// Mock console methods
const mockConsole = {
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn()
}

// Replace console with mock
Object.assign(console, mockConsole)

describe('logger', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset log level to default
    logger.setLogLevel(2)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('log levels', () => {
    it('should log error messages (level 1)', () => {
      logger.error('Test error message')
      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR]'),
        expect.stringContaining('Test error message')
      )
    })

    it('should log warning messages (level 2)', () => {
      logger.warn('Test warning message')
      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringContaining('[WARN]'),
        expect.stringContaining('Test warning message')
      )
    })

    it('should log info messages (level 2)', () => {
      logger.info('Test info message')
      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]'),
        expect.stringContaining('Test info message')
      )
    })

    it('should log debug messages (level 3)', () => {
      logger.debug('Test debug message')
      expect(mockConsole.debug).toHaveBeenCalledWith(
        expect.stringContaining('[DEBUG]'),
        expect.stringContaining('Test debug message')
      )
    })

    it('should not log debug messages when log level is too low', () => {
      logger.setLogLevel(2)
      logger.debug('Test debug message')
      expect(mockConsole.debug).not.toHaveBeenCalled()
    })

    it('should log debug messages when log level is high enough', () => {
      logger.setLogLevel(3)
      logger.debug('Test debug message')
      expect(mockConsole.debug).toHaveBeenCalled()
    })
  })

  describe('contextual logging', () => {
    it('should log with service context', () => {
      logger.fhir(2, 'FHIR operation completed', 'testOperation')
      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('[FHIR]'),
        expect.stringContaining('testOperation'),
        expect.stringContaining('FHIR operation completed')
      )
    })

    it('should log with validation context', () => {
      logger.validation(2, 'Validation completed', 'validateResource')
      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('[VALIDATION]'),
        expect.stringContaining('validateResource'),
        expect.stringContaining('Validation completed')
      )
    })

    it('should log with dashboard context', () => {
      logger.dashboard(2, 'Dashboard data updated', 'getStats')
      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('[DASHBOARD]'),
        expect.stringContaining('getStats'),
        expect.stringContaining('Dashboard data updated')
      )
    })

    it('should log with cache context', () => {
      logger.cache(2, 'Cache hit', 'get')
      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('[CACHE]'),
        expect.stringContaining('get'),
        expect.stringContaining('Cache hit')
      )
    })

    it('should log with SSE context', () => {
      logger.sse(2, 'SSE client connected', 'stream')
      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('[SSE]'),
        expect.stringContaining('stream'),
        expect(stringContaining('SSE client connected')
      )
    })

    it('should log with storage context', () => {
      logger.storage(2, 'Database query executed', 'getFhirServers')
      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('[STORAGE]'),
        expect.stringContaining('getFhirServers'),
        expect.stringContaining('Database query executed')
      )
    })
  })

  describe('log formatting', () => {
    it('should include timestamp in log messages', () => {
      logger.info('Test message')
      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringMatching(/^\d{2}:\d{2}:\d{2} [AP]M/)
      )
    })

    it('should include log level in messages', () => {
      logger.error('Test error')
      logger.warn('Test warning')
      logger.info('Test info')
      logger.debug('Test debug')

      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR]')
      )
      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringContaining('[WARN]')
      )
      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]')
      )
      expect(mockConsole.debug).toHaveBeenCalledWith(
        expect.stringContaining('[DEBUG]')
      )
    })

    it('should include context in contextual log messages', () => {
      logger.fhir(2, 'Test message', 'testOperation')
      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('[FHIR]'),
        expect.stringContaining('testOperation')
      )
    })
  })

  describe('log level management', () => {
    it('should get current log level', () => {
      logger.setLogLevel(3)
      expect(logger.getLogLevel()).toBe(3)
    })

    it('should set log level', () => {
      logger.setLogLevel(1)
      expect(logger.getLogLevel()).toBe(1)
    })

    it('should respect log level when logging', () => {
      logger.setLogLevel(1) // Only errors

      logger.error('Error message')
      logger.warn('Warning message')
      logger.info('Info message')
      logger.debug('Debug message')

      expect(mockConsole.error).toHaveBeenCalled()
      expect(mockConsole.warn).not.toHaveBeenCalled()
      expect(mockConsole.info).not.toHaveBeenCalled()
      expect(mockConsole.debug).not.toHaveBeenCalled()
    })
  })

  describe('log buffer', () => {
    it('should buffer logs when enabled', () => {
      logger.enableBuffer()
      logger.info('Buffered message 1')
      logger.info('Buffered message 2')

      const buffer = logger.getBuffer()
      expect(buffer).toHaveLength(2)
      expect(buffer[0]).toContain('Buffered message 1')
      expect(buffer[1]).toContain('Buffered message 2')
    })

    it('should flush buffer', () => {
      logger.enableBuffer()
      logger.info('Buffered message')
      logger.flushBuffer()

      const buffer = logger.getBuffer()
      expect(buffer).toHaveLength(0)
    })

    it('should clear buffer', () => {
      logger.enableBuffer()
      logger.info('Buffered message')
      logger.clearBuffer()

      const buffer = logger.getBuffer()
      expect(buffer).toHaveLength(0)
    })

    it('should disable buffer', () => {
      logger.enableBuffer()
      logger.info('Buffered message')
      logger.disableBuffer()
      logger.info('Direct message')

      const buffer = logger.getBuffer()
      expect(buffer).toHaveLength(1)
      expect(buffer[0]).toContain('Buffered message')
      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('Direct message')
      )
    })
  })

  describe('production mode', () => {
    it('should optimize for production', () => {
      logger.setProductionMode(true)
      logger.info('Production message')
      logger.debug('Debug message')

      // In production mode, debug messages should not be logged
      expect(mockConsole.debug).not.toHaveBeenCalled()
      expect(mockConsole.info).toHaveBeenCalled()
    })

    it('should disable production mode', () => {
      logger.setProductionMode(false)
      logger.setLogLevel(3)
      logger.debug('Debug message')

      expect(mockConsole.debug).toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should handle logging errors gracefully', () => {
      // Mock console.error to throw an error
      mockConsole.error.mockImplementation(() => {
        throw new Error('Console error')
      })

      // Should not throw error
      expect(() => logger.error('Test error')).not.toThrow()
    })

    it('should handle buffer errors gracefully', () => {
      // Mock buffer operations to throw errors
      const originalBuffer = logger['buffer']
      logger['buffer'] = {
        push: vi.fn().mockImplementation(() => {
          throw new Error('Buffer error')
        })
      }

      logger.enableBuffer()
      expect(() => logger.info('Test message')).not.toThrow()

      // Restore original buffer
      logger['buffer'] = originalBuffer
    })
  })

  describe('performance', () => {
    it('should handle high-frequency logging', () => {
      const startTime = Date.now()
      
      for (let i = 0; i < 1000; i++) {
        logger.info(`Message ${i}`)
      }
      
      const endTime = Date.now()
      const duration = endTime - startTime
      
      // Should complete within reasonable time (less than 1 second)
      expect(duration).toBeLessThan(1000)
    })

    it('should handle large log messages', () => {
      const largeMessage = 'x'.repeat(10000)
      
      expect(() => logger.info(largeMessage)).not.toThrow()
      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining(largeMessage)
      )
    })
  })

  describe('log filtering', () => {
    it('should filter logs by service', () => {
      logger.setLogFilter(['FHIR', 'VALIDATION'])
      
      logger.fhir(2, 'FHIR message', 'test')
      logger.validation(2, 'Validation message', 'test')
      logger.dashboard(2, 'Dashboard message', 'test')
      
      expect(mockConsole.info).toHaveBeenCalledTimes(2)
    })

    it('should clear log filter', () => {
      logger.setLogFilter(['FHIR'])
      logger.clearLogFilter()
      
      logger.fhir(2, 'FHIR message', 'test')
      logger.dashboard(2, 'Dashboard message', 'test')
      
      expect(mockConsole.info).toHaveBeenCalledTimes(2)
    })
  })
})

