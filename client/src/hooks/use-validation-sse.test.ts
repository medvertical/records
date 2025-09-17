import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useValidationSSE } from './use-validation-sse'

// Mock the API functions
vi.mock('../api/validation', () => ({
  startValidation: vi.fn(),
  stopValidation: vi.fn(),
  pauseValidation: vi.fn(),
  resumeValidation: vi.fn(),
  getValidationStatus: vi.fn(),
}))

// Mock EventSource
const mockEventSource = {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  close: vi.fn(),
  readyState: 1,
  url: '',
  withCredentials: false,
  CONNECTING: 0,
  OPEN: 1,
  CLOSED: 2,
}

describe('useValidationSSE', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // @ts-ignore
    global.EventSource = vi.fn(() => mockEventSource)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useValidationSSE())

    expect(result.current.isConnected).toBe(false)
    expect(result.current.isValidating).toBe(false)
    expect(result.current.progress).toBe(0)
    expect(result.current.status).toBe('idle')
    expect(result.current.error).toBe(null)
  })

  it('should connect to SSE endpoint', async () => {
    const { result } = renderHook(() => useValidationSSE())

    act(() => {
      result.current.connect()
    })

    expect(global.EventSource).toHaveBeenCalledWith('/api/validation/stream')
    expect(mockEventSource.addEventListener).toHaveBeenCalledWith('message', expect.any(Function))
    expect(mockEventSource.addEventListener).toHaveBeenCalledWith('error', expect.any(Function))
    expect(mockEventSource.addEventListener).toHaveBeenCalledWith('open', expect.any(Function))
  })

  it('should handle SSE connection open', async () => {
    const { result } = renderHook(() => useValidationSSE())

    act(() => {
      result.current.connect()
    })

    // Simulate connection open
    const openHandler = mockEventSource.addEventListener.mock.calls.find(
      call => call[0] === 'open'
    )?.[1]
    
    if (openHandler) {
      act(() => {
        openHandler()
      })
    }

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true)
    })
  })

  it('should handle SSE messages', async () => {
    const { result } = renderHook(() => useValidationSSE())

    act(() => {
      result.current.connect()
    })

    // Simulate receiving a message
    const messageHandler = mockEventSource.addEventListener.mock.calls.find(
      call => call[0] === 'message'
    )?.[1]
    
    if (messageHandler) {
      const mockEvent = {
        data: JSON.stringify({
          type: 'validation-progress',
          data: {
            progress: 50,
            status: 'running',
            isValidating: true,
            currentResource: 'Patient/123',
            totalResources: 100,
            processedResources: 50,
            successRate: 0.95,
            errors: []
          }
        })
      }

      act(() => {
        messageHandler(mockEvent)
      })

      await waitFor(() => {
        expect(result.current.progress).toBe(50)
        expect(result.current.status).toBe('running')
        expect(result.current.isValidating).toBe(true)
      })
    }
  })

  it('should handle validation start message', async () => {
    const { result } = renderHook(() => useValidationSSE())

    act(() => {
      result.current.connect()
    })

    const messageHandler = mockEventSource.addEventListener.mock.calls.find(
      call => call[0] === 'message'
    )?.[1]
    
    if (messageHandler) {
      const mockEvent = {
        data: JSON.stringify({
          type: 'validation-started',
          data: {
            isValidating: true,
            status: 'running',
            progress: 0
          }
        })
      }

      act(() => {
        messageHandler(mockEvent)
      })

      await waitFor(() => {
        expect(result.current.isValidating).toBe(true)
        expect(result.current.status).toBe('running')
        expect(result.current.progress).toBe(0)
      })
    }
  })

  it('should handle validation stop message', async () => {
    const { result } = renderHook(() => useValidationSSE())

    // Set initial state
    act(() => {
      result.current.setProgress(75)
      result.current.setStatus('running')
    })

    act(() => {
      result.current.connect()
    })

    const messageHandler = mockEventSource.addEventListener.mock.calls.find(
      call => call[0] === 'message'
    )?.[1]
    
    if (messageHandler) {
      const mockEvent = {
        data: JSON.stringify({
          type: 'validation-stopped',
          data: {
            isValidating: false,
            status: 'idle',
            progress: 75
          }
        })
      }

      act(() => {
        messageHandler(mockEvent)
      })

      await waitFor(() => {
        expect(result.current.isValidating).toBe(false)
        expect(result.current.status).toBe('idle')
        expect(result.current.progress).toBe(75)
      })
    }
  })

  it('should handle validation paused message', async () => {
    const { result } = renderHook(() => useValidationSSE())

    act(() => {
      result.current.connect()
    })

    const messageHandler = mockEventSource.addEventListener.mock.calls.find(
      call => call[0] === 'message'
    )?.[1]
    
    if (messageHandler) {
      const mockEvent = {
        data: JSON.stringify({
          type: 'validation-paused',
          data: {
            isValidating: false,
            status: 'paused',
            progress: 30
          }
        })
      }

      act(() => {
        messageHandler(mockEvent)
      })

      await waitFor(() => {
        expect(result.current.isValidating).toBe(false)
        expect(result.current.status).toBe('paused')
        expect(result.current.progress).toBe(30)
      })
    }
  })

  it('should handle validation resumed message', async () => {
    const { result } = renderHook(() => useValidationSSE())

    act(() => {
      result.current.connect()
    })

    const messageHandler = mockEventSource.addEventListener.mock.calls.find(
      call => call[0] === 'message'
    )?.[1]
    
    if (messageHandler) {
      const mockEvent = {
        data: JSON.stringify({
          type: 'validation-resumed',
          data: {
            isValidating: true,
            status: 'running',
            progress: 30
          }
        })
      }

      act(() => {
        messageHandler(mockEvent)
      })

      await waitFor(() => {
        expect(result.current.isValidating).toBe(true)
        expect(result.current.status).toBe('running')
        expect(result.current.progress).toBe(30)
      })
    }
  })

  it('should handle connection status message', async () => {
    const { result } = renderHook(() => useValidationSSE())

    act(() => {
      result.current.connect()
    })

    const messageHandler = mockEventSource.addEventListener.mock.calls.find(
      call => call[0] === 'message'
    )?.[1]
    
    if (messageHandler) {
      const mockEvent = {
        data: JSON.stringify({
          type: 'connection-status',
          data: {
            connected: true,
            serverStatus: 'healthy',
            lastHeartbeat: new Date().toISOString()
          }
        })
      }

      act(() => {
        messageHandler(mockEvent)
      })

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })
    }
  })

  it('should handle heartbeat message', async () => {
    const { result } = renderHook(() => useValidationSSE())

    act(() => {
      result.current.connect()
    })

    const messageHandler = mockEventSource.addEventListener.mock.calls.find(
      call => call[0] === 'message'
    )?.[1]
    
    if (messageHandler) {
      const mockEvent = {
        data: JSON.stringify({
          type: 'heartbeat',
          data: {
            timestamp: new Date().toISOString(),
            serverTime: new Date().toISOString()
          }
        })
      }

      act(() => {
        messageHandler(mockEvent)
      })

      // Heartbeat should not change validation state
      expect(result.current.isValidating).toBe(false)
      expect(result.current.status).toBe('idle')
    }
  })

  it('should handle SSE connection error', async () => {
    const { result } = renderHook(() => useValidationSSE())

    act(() => {
      result.current.connect()
    })

    const errorHandler = mockEventSource.addEventListener.mock.calls.find(
      call => call[0] === 'error'
    )?.[1]
    
    if (errorHandler) {
      act(() => {
        errorHandler(new Error('Connection failed'))
      })

      await waitFor(() => {
        expect(result.current.isConnected).toBe(false)
        expect(result.current.error).toBe('Connection failed')
      })
    }
  })

  it('should disconnect and cleanup', () => {
    const { result } = renderHook(() => useValidationSSE())

    act(() => {
      result.current.connect()
    })

    act(() => {
      result.current.disconnect()
    })

    expect(mockEventSource.close).toHaveBeenCalled()
  })

  it('should handle invalid JSON in SSE message', async () => {
    const { result } = renderHook(() => useValidationSSE())

    act(() => {
      result.current.connect()
    })

    const messageHandler = mockEventSource.addEventListener.mock.calls.find(
      call => call[0] === 'message'
    )?.[1]
    
    if (messageHandler) {
      const mockEvent = {
        data: 'invalid json'
      }

      act(() => {
        messageHandler(mockEvent)
      })

      // Should not crash and maintain current state
      expect(result.current.status).toBe('idle')
    }
  })

  it('should handle unknown message types gracefully', async () => {
    const { result } = renderHook(() => useValidationSSE())

    act(() => {
      result.current.connect()
    })

    const messageHandler = mockEventSource.addEventListener.mock.calls.find(
      call => call[0] === 'message'
    )?.[1]
    
    if (messageHandler) {
      const mockEvent = {
        data: JSON.stringify({
          type: 'unknown-type',
          data: { some: 'data' }
        })
      }

      act(() => {
        messageHandler(mockEvent)
      })

      // Should not crash and maintain current state
      expect(result.current.status).toBe('idle')
    }
  })

  it('should allow manual state updates', () => {
    const { result } = renderHook(() => useValidationSSE())

    act(() => {
      result.current.setProgress(25)
    })

    expect(result.current.progress).toBe(25)

    act(() => {
      result.current.setStatus('running')
    })

    expect(result.current.status).toBe('running')
  })

  it('should handle reconnection attempts', async () => {
    const { result } = renderHook(() => useValidationSSE())

    // First connection
    act(() => {
      result.current.connect()
    })

    expect(global.EventSource).toHaveBeenCalledTimes(1)

    // Disconnect
    act(() => {
      result.current.disconnect()
    })

    // Reconnect
    act(() => {
      result.current.connect()
    })

    expect(global.EventSource).toHaveBeenCalledTimes(2)
  })
})