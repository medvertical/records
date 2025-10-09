import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ServerValidation } from './server-validation'

// Mock the icons
vi.mock('lucide-react', () => ({
  Server: () => <div data-testid="server-icon" />,
  CheckCircle: () => <div data-testid="check-circle-icon" />,
  XCircle: () => <div data-testid="x-circle-icon" />,
  AlertCircle: () => <div data-testid="alert-circle-icon" />,
  RefreshCw: () => <div data-testid="refresh-cw-icon" />,
  Settings: () => <div data-testid="settings-icon" />,
  Play: () => <div data-testid="play-icon" />,
  Pause: () => <div data-testid="pause-icon" />,
  Square: () => <div data-testid="square-icon" />,
  RotateCcw: () => <div data-testid="rotate-ccw-icon" />,
  Activity: () => <div data-testid="activity-icon" />,
  Database: () => <div data-testid="database-icon" />,
  Clock: () => <div data-testid="clock-icon" />
}))

// Mock the validation controls hook
const mockValidationControls = {
  isLoading: false,
  error: null,
  isValidating: false,
  status: 'idle',
  progress: 0,
  startValidation: vi.fn(),
  stopValidation: vi.fn(),
  pauseValidation: vi.fn(),
  resumeValidation: vi.fn(),
  refreshStatus: vi.fn(),
  setError: vi.fn(),
  clearError: vi.fn()
}

vi.mock('../../hooks/use-validation-controls', () => ({
  useValidationControls: () => mockValidationControls
}))

// Mock the validation polling hook
const mockValidationPolling = {
  data: null,
  isLoading: false,
  error: null,
}

vi.mock('../../hooks/use-validation-polling', () => ({
  useValidationPolling: () => mockValidationPolling
}))

describe('ServerValidation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render server validation component', () => {
    render(<ServerValidation />)

    expect(screen.getByText('Server Validation')).toBeInTheDocument()
    expect(screen.getByText('Validation Engine')).toBeInTheDocument()
  })

  it('should display validation engine card', () => {
    render(<ServerValidation />)

    expect(screen.getByText('Validation Engine')).toBeInTheDocument()
  })

  it('should display server status', () => {
    render(<ServerValidation />)

    expect(screen.getByText('Server Status')).toBeInTheDocument()
  })

  it('should display validation progress', () => {
    mockValidationPolling.isValidating = true
    mockValidationPolling.progress = 50
    mockValidationPolling.status = 'running'

    render(<ServerValidation />)

    expect(screen.getByText('Running')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('should display validation status', () => {
    mockValidationPolling.status = 'paused'
    mockValidationPolling.progress = 30

    render(<ServerValidation />)

    expect(screen.getByText('Paused')).toBeInTheDocument()
    expect(screen.getByText('30%')).toBeInTheDocument()
  })

  it('should display connection status', () => {
    mockValidationPolling.isConnected = true

    render(<ServerValidation />)

    expect(screen.getByText('Connected')).toBeInTheDocument()
  })

  it('should display disconnected status', () => {
    mockValidationPolling.isConnected = false

    render(<ServerValidation />)

    expect(screen.getByText('Disconnected')).toBeInTheDocument()
  })

  it('should display error when validation fails', () => {
    mockValidationPolling.error = 'Validation failed'

    render(<ServerValidation />)

    expect(screen.getByText('Validation failed')).toBeInTheDocument()
  })

  it('should display error when controls fail', () => {
    mockValidationControls.error = 'Control error'

    render(<ServerValidation />)

    expect(screen.getByText('Control error')).toBeInTheDocument()
  })

  it('should handle validation start', async () => {
    mockValidationControls.startValidation.mockResolvedValue({ success: true })

    render(<ServerValidation />)

    const startButton = screen.getByRole('button', { name: /start validation/i })
    fireEvent.click(startButton)

    await waitFor(() => {
      expect(mockValidationControls.startValidation).toHaveBeenCalled()
    })
  })

  it('should handle validation stop', async () => {
    mockValidationControls.isValidating = true
    mockValidationControls.status = 'running'
    mockValidationControls.stopValidation.mockResolvedValue({ success: true })

    render(<ServerValidation />)

    const stopButton = screen.getByRole('button', { name: /stop validation/i })
    fireEvent.click(stopButton)

    await waitFor(() => {
      expect(mockValidationControls.stopValidation).toHaveBeenCalled()
    })
  })

  it('should handle validation pause', async () => {
    mockValidationControls.isValidating = true
    mockValidationControls.status = 'running'
    mockValidationControls.pauseValidation.mockResolvedValue({ success: true })

    render(<ServerValidation />)

    const pauseButton = screen.getByRole('button', { name: /pause validation/i })
    fireEvent.click(pauseButton)

    await waitFor(() => {
      expect(mockValidationControls.pauseValidation).toHaveBeenCalled()
    })
  })

  it('should handle validation resume', async () => {
    mockValidationControls.isValidating = false
    mockValidationControls.status = 'paused'
    mockValidationControls.resumeValidation.mockResolvedValue({ success: true })

    render(<ServerValidation />)

    const resumeButton = screen.getByRole('button', { name: /resume validation/i })
    fireEvent.click(resumeButton)

    await waitFor(() => {
      expect(mockValidationControls.resumeValidation).toHaveBeenCalled()
    })
  })

  it('should handle status refresh', async () => {
    mockValidationControls.refreshStatus.mockResolvedValue({ success: true })

    render(<ServerValidation />)

    const refreshButton = screen.getByRole('button', { name: /refresh status/i })
    fireEvent.click(refreshButton)

    await waitFor(() => {
      expect(mockValidationControls.refreshStatus).toHaveBeenCalled()
    })
  })

  it('should display loading state', () => {
    mockValidationControls.isLoading = true

    render(<ServerValidation />)

    const buttons = screen.getAllByRole('button')
    buttons.forEach(button => {
      expect(button).toBeDisabled()
    })
  })

  it('should display progress bar with correct value', () => {
    mockValidationPolling.progress = 75

    render(<ServerValidation />)

    const progressBar = screen.getByRole('progressbar')
    expect(progressBar).toHaveAttribute('aria-valuenow', '75')
  })

  it('should handle different validation states', () => {
    const states = ['idle', 'running', 'paused', 'completed', 'error']

    states.forEach(state => {
      mockValidationPolling.status = state as any
      mockValidationPolling.isValidating = state === 'running'

      const { unmount } = render(<ServerValidation />)

      expect(screen.getByText(state.charAt(0).toUpperCase() + state.slice(1))).toBeInTheDocument()
      unmount()
    })
  })

  it('should display appropriate icons for different states', () => {
    mockValidationPolling.isValidating = true
    mockValidationPolling.status = 'running'

    render(<ServerValidation />)

    expect(screen.getByTestId('play-icon')).toBeInTheDocument()
    expect(screen.getByTestId('pause-icon')).toBeInTheDocument()
    expect(screen.getByTestId('square-icon')).toBeInTheDocument()
  })

  it('should handle validation completion', () => {
    mockValidationPolling.isValidating = false
    mockValidationPolling.status = 'completed'
    mockValidationPolling.progress = 100

    render(<ServerValidation />)

    expect(screen.getByText('Completed')).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('should handle validation error state', () => {
    mockValidationPolling.isValidating = false
    mockValidationPolling.status = 'error'
    mockValidationPolling.error = 'Validation failed'

    render(<ServerValidation />)

    expect(screen.getByText('Error')).toBeInTheDocument()
    expect(screen.getByText('Validation failed')).toBeInTheDocument()
  })

  it('should display current resource when available', () => {
    mockValidationPolling.isValidating = true
    mockValidationPolling.status = 'running'
    mockValidationPolling.progress = 50

    render(<ServerValidation />)

    // The component should display progress information
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('should handle button click errors gracefully', async () => {
    mockValidationControls.startValidation.mockRejectedValue(new Error('Network error'))

    render(<ServerValidation />)

    const startButton = screen.getByRole('button', { name: /start validation/i })
    fireEvent.click(startButton)

    await waitFor(() => {
      expect(mockValidationControls.startValidation).toHaveBeenCalled()
    })
  })

  it('should display connection status correctly', () => {
    mockValidationPolling.isConnected = true

    render(<ServerValidation />)

    expect(screen.getByText('Connected')).toBeInTheDocument()
  })

  it('should display disconnected status correctly', () => {
    mockValidationPolling.isConnected = false

    render(<ServerValidation />)

    expect(screen.getByText('Disconnected')).toBeInTheDocument()
  })

  it('should handle SSE connection errors', () => {
    mockValidationPolling.error = 'SSE connection failed'

    render(<ServerValidation />)

    expect(screen.getByText('SSE connection failed')).toBeInTheDocument()
  })

  it('should handle controls connection errors', () => {
    mockValidationControls.error = 'Controls connection failed'

    render(<ServerValidation />)

    expect(screen.getByText('Controls connection failed')).toBeInTheDocument()
  })

  it('should display both validation and controls status', () => {
    mockValidationPolling.status = 'running'
    mockValidationPolling.progress = 50
    mockValidationControls.status = 'running'
    mockValidationControls.progress = 50

    render(<ServerValidation />)

    expect(screen.getByText('Running')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('should handle mixed states between SSE and controls', () => {
    mockValidationPolling.status = 'running'
    mockValidationPolling.progress = 50
    mockValidationControls.status = 'paused'
    mockValidationControls.progress = 30

    render(<ServerValidation />)

    // Should display both states
    expect(screen.getByText('Running')).toBeInTheDocument()
    expect(screen.getByText('Paused')).toBeInTheDocument()
  })
})
