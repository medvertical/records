import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import axios from 'axios'
import { FhirClient } from './fhir-client'

// Mock axios
vi.mock('axios')
const mockedAxios = vi.mocked(axios)

// Mock the logger
vi.mock('../../utils/logger.js', () => ({
  logger: {
    fhir: vi.fn(),
    getLogLevel: vi.fn(() => 2)
  }
}))

// Mock the error handler
vi.mock('../../utils/error-handler.js', () => ({
  errorHandler: {
    handleError: vi.fn((error) => ({
      success: false,
      error: {
        code: 'FHIR_CLIENT_ERROR',
        message: error.message,
        category: 'fhir-server',
        severity: 'high',
        recoverable: true,
        recoveryAction: 'retry'
      }
    }))
  }
}))

describe('FhirClient', () => {
  let fhirClient: FhirClient

  beforeEach(() => {
    vi.clearAllMocks()
    fhirClient = new FhirClient('https://hapi.fhir.org/baseR4')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    it('should initialize with base URL', () => {
      expect(fhirClient['baseUrl']).toBe('https://hapi.fhir.org/baseR4')
      expect(fhirClient['headers']).toEqual({
        'Accept': 'application/fhir+json',
        'Content-Type': 'application/fhir+json'
      })
    })

    it('should initialize with authentication', () => {
      const authConfig = {
        type: 'basic' as const,
        username: 'testuser',
        password: 'testpass'
      }
      
      const client = new FhirClient('https://hapi.fhir.org/baseR4', authConfig)
      
      expect(client['authConfig']).toEqual(authConfig)
      expect(client['headers']['Authorization']).toBe('Basic dGVzdHVzZXI6dGVzdHBhc3M=')
    })
  })

  describe('testConnection', () => {
    it('should return success for valid connection', async () => {
      const mockResponse = {
        data: {
          resourceType: 'CapabilityStatement',
          status: 'active',
          fhirVersion: '4.0.1'
        },
        status: 200,
        statusText: 'OK'
      }

      mockedAxios.get.mockResolvedValue(mockResponse)

      const result = await fhirClient.testConnection()

      expect(result).toEqual({
        success: true,
        data: {
          connected: true,
          serverInfo: {
            resourceType: 'CapabilityStatement',
            status: 'active',
            fhirVersion: '4.0.1'
          },
          responseTime: expect.any(Number),
          statusCode: 200
        }
      })

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://hapi.fhir.org/baseR4/metadata',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Accept': 'application/fhir+json'
          }),
          timeout: 10000,
          validateStatus: expect.any(Function)
        })
      )
    })

    it('should handle DNS errors', async () => {
      const dnsError = new Error('getaddrinfo ENOTFOUND invalid-server.com')
      dnsError.code = 'ENOTFOUND'
      mockedAxios.get.mockRejectedValue(dnsError)

      const result = await fhirClient.testConnection()

      expect(result).toEqual({
        success: false,
        error: {
          code: 'FHIR_CLIENT_ERROR',
          message: 'getaddrinfo ENOTFOUND invalid-server.com',
          category: 'fhir-server',
          severity: 'high',
          recoverable: true,
          recoveryAction: 'retry'
        }
      })
    })

    it('should handle connection refused errors', async () => {
      const connectionError = new Error('connect ECONNREFUSED 127.0.0.1:8080')
      connectionError.code = 'ECONNREFUSED'
      mockedAxios.get.mockRejectedValue(connectionError)

      const result = await fhirClient.testConnection()

      expect(result).toEqual({
        success: false,
        error: {
          code: 'FHIR_CLIENT_ERROR',
          message: 'connect ECONNREFUSED 127.0.0.1:8080',
          category: 'fhir-server',
          severity: 'high',
          recoverable: true,
          recoveryAction: 'retry'
        }
      })
    })

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('timeout of 10000ms exceeded')
      timeoutError.code = 'ECONNABORTED'
      mockedAxios.get.mockRejectedValue(timeoutError)

      const result = await fhirClient.testConnection()

      expect(result).toEqual({
        success: false,
        error: {
          code: 'FHIR_CLIENT_ERROR',
          message: 'timeout of 10000ms exceeded',
          category: 'fhir-server',
          severity: 'high',
          recoverable: true,
          recoveryAction: 'retry'
        }
      })
    })

    it('should handle SSL errors', async () => {
      const sslError = new Error('certificate verify failed')
      sslError.code = 'CERT_HAS_EXPIRED'
      mockedAxios.get.mockRejectedValue(sslError)

      const result = await fhirClient.testConnection()

      expect(result).toEqual({
        success: false,
        error: {
          code: 'FHIR_CLIENT_ERROR',
          message: 'certificate verify failed',
          category: 'fhir-server',
          severity: 'high',
          recoverable: true,
          recoveryAction: 'retry'
        }
      })
    })

    it('should handle HTTP 401 errors', async () => {
      const authError = {
        response: {
          status: 401,
          statusText: 'Unauthorized',
          data: { error: 'Authentication required' }
        },
        message: 'Request failed with status code 401'
      }
      mockedAxios.get.mockRejectedValue(authError)

      const result = await fhirClient.testConnection()

      expect(result).toEqual({
        success: false,
        error: {
          code: 'FHIR_CLIENT_ERROR',
          message: 'Request failed with status code 401',
          category: 'fhir-server',
          severity: 'high',
          recoverable: true,
          recoveryAction: 'retry'
        }
      })
    })

    it('should handle HTTP 403 errors', async () => {
      const forbiddenError = {
        response: {
          status: 403,
          statusText: 'Forbidden',
          data: { error: 'Access denied' }
        },
        message: 'Request failed with status code 403'
      }
      mockedAxios.get.mockRejectedValue(forbiddenError)

      const result = await fhirClient.testConnection()

      expect(result).toEqual({
        success: false,
        error: {
          code: 'FHIR_CLIENT_ERROR',
          message: 'Request failed with status code 403',
          category: 'fhir-server',
          severity: 'high',
          recoverable: true,
          recoveryAction: 'retry'
        }
      })
    })

    it('should handle HTTP 404 errors', async () => {
      const notFoundError = {
        response: {
          status: 404,
          statusText: 'Not Found',
          data: { error: 'Endpoint not found' }
        },
        message: 'Request failed with status code 404'
      }
      mockedAxios.get.mockRejectedValue(notFoundError)

      const result = await fhirClient.testConnection()

      expect(result).toEqual({
        success: false,
        error: {
          code: 'FHIR_CLIENT_ERROR',
          message: 'Request failed with status code 404',
          category: 'fhir-server',
          severity: 'high',
          recoverable: true,
          recoveryAction: 'retry'
        }
      })
    })

    it('should handle HTTP 500 errors', async () => {
      const serverError = {
        response: {
          status: 500,
          statusText: 'Internal Server Error',
          data: { error: 'Server error' }
        },
        message: 'Request failed with status code 500'
      }
      mockedAxios.get.mockRejectedValue(serverError)

      const result = await fhirClient.testConnection()

      expect(result).toEqual({
        success: false,
        error: {
          code: 'FHIR_CLIENT_ERROR',
          message: 'Request failed with status code 500',
          category: 'fhir-server',
          severity: 'high',
          recoverable: true,
          recoveryAction: 'retry'
        }
      })
    })

    it('should handle invalid JSON responses', async () => {
      const invalidJsonError = new Error('Unexpected token < in JSON at position 0')
      mockedAxios.get.mockRejectedValue(invalidJsonError)

      const result = await fhirClient.testConnection()

      expect(result).toEqual({
        success: false,
        error: {
          code: 'FHIR_CLIENT_ERROR',
          message: 'Unexpected token < in JSON at position 0',
          category: 'fhir-server',
          severity: 'high',
          recoverable: true,
          recoveryAction: 'retry'
        }
      })
    })
  })

  describe('getResourceCount', () => {
    it('should return count using _summary=count with _total=accurate', async () => {
      const mockResponse = {
        data: {
          resourceType: 'Bundle',
          type: 'searchset',
          total: 150
        }
      }

      mockedAxios.get.mockResolvedValue(mockResponse)

      const result = await fhirClient.getResourceCount('Patient')

      expect(result).toBe(150)
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://hapi.fhir.org/baseR4/Patient?_summary=count&_total=accurate',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Accept': 'application/fhir+json'
          }),
          timeout: 15000
        })
      )
    })

    it('should fallback to _total=true if _total=accurate fails', async () => {
      // First call fails
      mockedAxios.get
        .mockRejectedValueOnce(new Error('_total=accurate not supported'))
        // Second call succeeds
        .mockResolvedValueOnce({
          data: {
            resourceType: 'Bundle',
            type: 'searchset',
            total: 200
          }
        })

      const result = await fhirClient.getResourceCount('Patient')

      expect(result).toBe(200)
      expect(mockedAxios.get).toHaveBeenCalledTimes(2)
    })

    it('should fallback to search with _total=accurate', async () => {
      // First two calls fail
      mockedAxios.get
        .mockRejectedValueOnce(new Error('_total=accurate not supported'))
        .mockRejectedValueOnce(new Error('_total=true not supported'))
        // Third call succeeds
        .mockResolvedValueOnce({
          data: {
            resourceType: 'Bundle',
            type: 'searchset',
            total: 100,
            entry: [{ resource: { id: '1' } }]
          }
        })

      const result = await fhirClient.getResourceCount('Patient')

      expect(result).toBe(100)
      expect(mockedAxios.get).toHaveBeenCalledTimes(3)
    })

    it('should return 0 when no resources found', async () => {
      mockedAxios.get
        .mockRejectedValueOnce(new Error('_total=accurate not supported'))
        .mockRejectedValueOnce(new Error('_total=true not supported'))
        .mockResolvedValueOnce({
          data: {
            resourceType: 'Bundle',
            type: 'searchset',
            entry: []
          }
        })

      const result = await fhirClient.getResourceCount('Patient')

      expect(result).toBe(0)
    })

    it('should return 0 on error', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Server error'))

      const result = await fhirClient.getResourceCount('Patient')

      expect(result).toBe(0)
    })
  })

  describe('searchResources', () => {
    it('should search resources with default parameters', async () => {
      const mockResponse = {
        data: {
          resourceType: 'Bundle',
          type: 'searchset',
          entry: [
            { resource: { id: '1', resourceType: 'Patient' } },
            { resource: { id: '2', resourceType: 'Patient' } }
          ]
        }
      }

      mockedAxios.get.mockResolvedValue(mockResponse)

      const result = await fhirClient.searchResources('Patient')

      expect(result).toEqual({
        resourceType: 'Bundle',
        type: 'searchset',
        entry: [
          { resource: { id: '1', resourceType: 'Patient' } },
          { resource: { id: '2', resourceType: 'Patient' } }
          ]
      })

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://hapi.fhir.org/baseR4/Patient',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Accept': 'application/fhir+json'
          }),
          timeout: 30000
        })
      )
    })

    it('should search resources with custom parameters', async () => {
      const mockResponse = {
        data: {
          resourceType: 'Bundle',
          type: 'searchset',
          entry: []
        }
      }

      mockedAxios.get.mockResolvedValue(mockResponse)

      const result = await fhirClient.searchResources('Patient', {
        name: 'John',
        _count: '10'
      })

      expect(result).toEqual({
        resourceType: 'Bundle',
        type: 'searchset',
        entry: []
      })

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://hapi.fhir.org/baseR4/Patient?name=John&_count=10',
        expect.any(Object)
      )
    })

    it('should handle search errors', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Search failed'))

      await expect(fhirClient.searchResources('Patient')).rejects.toThrow('Search failed')
    })
  })

  describe('updateAuthConfig', () => {
    it('should update authentication configuration', () => {
      const newAuthConfig = {
        type: 'bearer' as const,
        token: 'new-token'
      }

      fhirClient.updateAuthConfig(newAuthConfig)

      expect(fhirClient['authConfig']).toEqual(newAuthConfig)
      expect(fhirClient['headers']['Authorization']).toBe('Bearer new-token')
    })

    it('should clear authentication when set to none', () => {
      const newAuthConfig = {
        type: 'none' as const
      }

      fhirClient.updateAuthConfig(newAuthConfig)

      expect(fhirClient['authConfig']).toEqual(newAuthConfig)
      expect(fhirClient['headers']['Authorization']).toBeUndefined()
    })
  })
})

