import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useValidationControls } from './use-validation-controls'
import * as validationApi from '../api/validation'

// Mock the validation API
vi.mock('../api/validation', () => ({
  startValidation: vi.fn(),
  stopValidation: vi.fn(),
  pauseValidation: vi.fn(),
  resumeValidation: vi.fn(),
  getValidationStatus: vi.fn(),
}))

// Mock the SSE hook
const mockSSE = {
  isConnected: true,
  isValidating: false,
  progress: 0,
  status: 'idle',
  error: null,
  connect: vi.fn(),
  disconnect: vi.fn(),
  setProgress: vi.fn(),
  setStatus: vi.fn(),
}

vi.mock('./use-validation-sse', () => ({
  useValidationSSE: () => mockSSE,
}))

describe('useValidationControls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mock SSE state
    mockSSE.isValidating = false
    mockSSE.status = 'idle'
    mockSSE.progress = 0
    mockSSE.error = null
  })

  it('should initialize with correct default state', () => {
    const { result } = renderHook(() => useValidationControls())

    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBe(null)
    expect(result.current.isValidating).toBe(false)
    expect(result.current.status).toBe('idle')
    expect(result.current.progress).toBe(0)
  })

  it('should start validation successfully', async () => {
    const mockResponse = {
      success: true,
      data: {
        isValidating: true,
        status: 'running',
        progress: 0
      }
    }

    vi.mocked(validationApi.startValidation).mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useValidationControls())

    await act(async () => {
      await result.current.startValidation()
    })

    expect(validationApi.startValidation).toHaveBeenCalled()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBe(null)
  })

  it('should handle start validation error', async () => {
    const mockError = new Error('Failed to start validation')
    vi.mocked(validationApi.startValidation).mockRejectedValue(mockError)

    const { result } = renderHook(() => useValidationControls())

    await act(async () => {
      await result.current.startValidation()
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBe('Failed to start validation')
  })

  it('should stop validation successfully', async () => {
    const mockResponse = {
      success: true,
      data: {
        isValidating: false,
        status: 'idle',
        progress: 50
      }
    }

    vi.mocked(validationApi.stopValidation).mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useValidationControls())

    await act(async () => {
      await result.current.stopValidation()
    })

    expect(validationApi.stopValidation).toHaveBeenCalled()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBe(null)
  })

  it('should handle stop validation error', async () => {
    const mockError = new Error('Failed to stop validation')
    vi.mocked(validationApi.stopValidation).mockRejectedValue(mockError)

    const { result } = renderHook(() => useValidationControls())

    await act(async () => {
      await result.current.stopValidation()
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBe('Failed to stop validation')
  })

  it('should pause validation successfully', async () => {
    const mockResponse = {
      success: true,
      data: {
        isValidating: false,
        status: 'paused',
        progress: 30
      }
    }

    vi.mocked(validationApi.pauseValidation).mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useValidationControls())

    await act(async () => {
      await result.current.pauseValidation()
    })

    expect(validationApi.pauseValidation).toHaveBeenCalled()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBe(null)
  })

  it('should handle pause validation error', async () => {
    const mockError = new Error('Failed to pause validation')
    vi.mocked(validationApi.pauseValidation).mockRejectedValue(mockError)

    const { result } = renderHook(() => useValidationControls())

    await act(async () => {
      await result.current.pauseValidation()
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBe('Failed to pause validation')
  })

  it('should resume validation successfully', async () => {
    const mockResponse = {
      success: true,
      data: {
        isValidating: true,
        status: 'running',
        progress: 30
      }
    }

    vi.mocked(validationApi.resumeValidation).mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useValidationControls())

    await act(async () => {
      await result.current.resumeValidation()
    })

    expect(validationApi.resumeValidation).toHaveBeenCalled()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBe(null)
  })

  it('should handle resume validation error', async () => {
    const mockError = new Error('Failed to resume validation')
    vi.mocked(validationApi.resumeValidation).mockRejectedValue(mockError)

    const { result } = renderHook(() => useValidationControls())

    await act(async () => {
      await result.current.resumeValidation()
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBe('Failed to resume validation')
  })

  it('should refresh validation status successfully', async () => {
    const mockResponse = {
      success: true,
      data: {
        isValidating: true,
        status: 'running',
        progress: 45,
        currentResource: 'Patient/123',
        totalResources: 100,
        processedResources: 45,
        successRate: 0.95,
        errors: []
      }
    }

    vi.mocked(validationApi.getValidationStatus).mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useValidationControls())

    await act(async () => {
      await result.current.refreshStatus()
    })

    expect(validationApi.getValidationStatus).toHaveBeenCalled()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBe(null)
  })

  it('should handle refresh status error', async () => {
    const mockError = new Error('Failed to get status')
    vi.mocked(validationApi.getValidationStatus).mockRejectedValue(mockError)

    const { result } = renderHook(() => useValidationControls())

    await act(async () => {
      await result.current.refreshStatus()
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBe('Failed to get status')
  })

  it('should set loading state during API calls', async () => {
    let resolvePromise: (value: any) => void
    const promise = new Promise(resolve => {
      resolvePromise = resolve
    })

    vi.mocked(validationApi.startValidation).mockReturnValue(promise)

    const { result } = renderHook(() => useValidationControls())

    act(() => {
      result.current.startValidation()
    })

    expect(result.current.isLoading).toBe(true)

    await act(async () => {
      resolvePromise!({
        success: true,
        data: { isValidating: true, status: 'running', progress: 0 }
      })
      await promise
    })

    expect(result.current.isLoading).toBe(false)
  })

  it('should clear error when starting new operation', async () => {
    const { result } = renderHook(() => useValidationControls())

    // Set an error first
    act(() => {
      result.current.setError('Previous error')
    })

    expect(result.current.error).toBe('Previous error')

    // Start validation should clear the error
    const mockResponse = {
      success: true,
      data: { isValidating: true, status: 'running', progress: 0 }
    }
    vi.mocked(validationApi.startValidation).mockResolvedValue(mockResponse)

    await act(async () => {
      await result.current.startValidation()
    })

    expect(result.current.error).toBe(null)
  })

  it('should handle network errors gracefully', async () => {
    const networkError = new Error('Network Error')
    networkError.name = 'NetworkError'
    vi.mocked(validationApi.startValidation).mockRejectedValue(networkError)

    const { result } = renderHook(() => useValidationControls())

    await act(async () => {
      await result.current.startValidation()
    })

    expect(result.current.error).toBe('Network Error')
    expect(result.current.isLoading).toBe(false)
  })

  it('should handle API response errors', async () => {
    const apiError = {
      success: false,
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR'
      }
    }
    vi.mocked(validationApi.startValidation).mockResolvedValue(apiError)

    const { result } = renderHook(() => useValidationControls())

    await act(async () => {
      await result.current.startValidation()
    })

    expect(result.current.error).toBe('Validation failed')
    expect(result.current.isLoading).toBe(false)
  })

  it('should allow manual error clearing', () => {
    const { result } = renderHook(() => useValidationControls())

    act(() => {
      result.current.setError('Test error')
    })

    expect(result.current.error).toBe('Test error')

    act(() => {
      result.current.clearError()
    })

    expect(result.current.error).toBe(null)
  })
})

