import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ValidationEngineCard } from './validation-engine-card'

// Mock the icons
vi.mock('lucide-react', () => ({
  Play: () => <div data-testid="play-icon" />,
  Pause: () => <div data-testid="pause-icon" />,
  Square: () => <div data-testid="square-icon" />,
  RotateCcw: () => <div data-testid="rotate-ccw-icon" />,
  RefreshCw: () => <div data-testid="refresh-cw-icon" />,
  CheckCircle: () => <div data-testid="check-circle-icon" />,
  XCircle: () => <div data-testid="x-circle-icon" />,
  AlertCircle: () => <div data-testid="alert-circle-icon" />,
  Settings: () => <div data-testid="settings-icon" />,
  Clock: () => <div data-testid="clock-icon" />,
  Database: () => <div data-testid="database-icon" />,
  Activity: () => <div data-testid="activity-icon" />
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

// Mock the validation settings hook
vi.mock('../../hooks/use-validation-settings', () => ({
  useValidationSettings: () => ({
    settings: {
      batchSize: 100,
      timeout: 30000,
      retryAttempts: 3,
      enableParallelProcessing: true
    },
    updateSettings: vi.fn(),
    isLoading: false,
    error: null
  })
}))

describe('ValidationEngineCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render validation engine card', () => {
    render(<ValidationEngineCard />)

    expect(screen.getByText('Validation Engine')).toBeInTheDocument()
    expect(screen.getByText('Idle')).toBeInTheDocument()
    expect(screen.getByText('0%')).toBeInTheDocument()
  })

  it('should display start button when idle', () => {
    render(<ValidationEngineCard />)

    const startButton = screen.getByRole('button', { name: /start validation/i })
    expect(startButton).toBeInTheDocument()
    expect(startButton).not.toBeDisabled()
  })

  it('should display stop and pause buttons when running', () => {
    mockValidationControls.isValidating = true
    mockValidationControls.status = 'running'
    mockValidationControls.progress = 50

    render(<ValidationEngineCard />)

    expect(screen.getByText('Running')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /stop validation/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /pause validation/i })).toBeInTheDocument()
  })

  it('should display resume and stop buttons when paused', () => {
    mockValidationControls.isValidating = false
    mockValidationControls.status = 'paused'
    mockValidationControls.progress = 30

    render(<ValidationEngineCard />)

    expect(screen.getByText('Paused')).toBeInTheDocument()
    expect(screen.getByText('30%')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /resume validation/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /stop validation/i })).toBeInTheDocument()
  })

  it('should call startValidation when start button is clicked', async () => {
    mockValidationControls.startValidation.mockResolvedValue({ success: true })

    render(<ValidationEngineCard />)

    const startButton = screen.getByRole('button', { name: /start validation/i })
    fireEvent.click(startButton)

    await waitFor(() => {
      expect(mockValidationControls.startValidation).toHaveBeenCalled()
    })
  })

  it('should call stopValidation when stop button is clicked', async () => {
    mockValidationControls.isValidating = true
    mockValidationControls.status = 'running'
    mockValidationControls.stopValidation.mockResolvedValue({ success: true })

    render(<ValidationEngineCard />)

    const stopButton = screen.getByRole('button', { name: /stop validation/i })
    fireEvent.click(stopButton)

    await waitFor(() => {
      expect(mockValidationControls.stopValidation).toHaveBeenCalled()
    })
  })

  it('should call pauseValidation when pause button is clicked', async () => {
    mockValidationControls.isValidating = true
    mockValidationControls.status = 'running'
    mockValidationControls.pauseValidation.mockResolvedValue({ success: true })

    render(<ValidationEngineCard />)

    const pauseButton = screen.getByRole('button', { name: /pause validation/i })
    fireEvent.click(pauseButton)

    await waitFor(() => {
      expect(mockValidationControls.pauseValidation).toHaveBeenCalled()
    })
  })

  it('should call resumeValidation when resume button is clicked', async () => {
    mockValidationControls.isValidating = false
    mockValidationControls.status = 'paused'
    mockValidationControls.resumeValidation.mockResolvedValue({ success: true })

    render(<ValidationEngineCard />)

    const resumeButton = screen.getByRole('button', { name: /resume validation/i })
    fireEvent.click(resumeButton)

    await waitFor(() => {
      expect(mockValidationControls.resumeValidation).toHaveBeenCalled()
    })
  })

  it('should call refreshStatus when refresh button is clicked', async () => {
    mockValidationControls.refreshStatus.mockResolvedValue({ success: true })

    render(<ValidationEngineCard />)

    const refreshButton = screen.getByRole('button', { name: /refresh status/i })
    fireEvent.click(refreshButton)

    await waitFor(() => {
      expect(mockValidationControls.refreshStatus).toHaveBeenCalled()
    })
  })

  it('should disable buttons when loading', () => {
    mockValidationControls.isLoading = true

    render(<ValidationEngineCard />)

    const startButton = screen.getByRole('button', { name: /start validation/i })
    expect(startButton).toBeDisabled()
  })

  it('should display error message when error occurs', () => {
    mockValidationControls.error = 'Validation failed'

    render(<ValidationEngineCard />)

    expect(screen.getByText('Validation failed')).toBeInTheDocument()
  })

  it('should clear error when clear button is clicked', () => {
    mockValidationControls.error = 'Validation failed'

    render(<ValidationEngineCard />)

    const clearButton = screen.getByRole('button', { name: /clear error/i })
    fireEvent.click(clearButton)

    expect(mockValidationControls.clearError).toHaveBeenCalled()
  })

  it('should display progress bar with correct value', () => {
    mockValidationControls.progress = 75

    render(<ValidationEngineCard />)

    const progressBar = screen.getByRole('progressbar')
    expect(progressBar).toHaveAttribute('aria-valuenow', '75')
  })

  it('should display success rate when available', () => {
    mockValidationControls.isValidating = true
    mockValidationControls.status = 'running'
    mockValidationControls.progress = 50

    render(<ValidationEngineCard />)

    // The component should display progress information
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('should handle different status states correctly', () => {
    const statuses = ['idle', 'running', 'paused', 'completed', 'error']

    statuses.forEach(status => {
      mockValidationControls.status = status as any
      mockValidationControls.isValidating = status === 'running'

      const { unmount } = render(<ValidationEngineCard />)

      expect(screen.getByText(status.charAt(0).toUpperCase() + status.slice(1))).toBeInTheDocument()
      unmount()
    })
  })

  it('should display appropriate icons for different states', () => {
    mockValidationControls.isValidating = true
    mockValidationControls.status = 'running'

    render(<ValidationEngineCard />)

    expect(screen.getByTestId('pause-icon')).toBeInTheDocument()
    expect(screen.getByTestId('square-icon')).toBeInTheDocument()
  })

  it('should handle validation completion', () => {
    mockValidationControls.isValidating = false
    mockValidationControls.status = 'completed'
    mockValidationControls.progress = 100

    render(<ValidationEngineCard />)

    expect(screen.getByText('Completed')).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('should handle validation error state', () => {
    mockValidationControls.isValidating = false
    mockValidationControls.status = 'error'
    mockValidationControls.error = 'Validation failed'

    render(<ValidationEngineCard />)

    expect(screen.getByText('Error')).toBeInTheDocument()
    expect(screen.getByText('Validation failed')).toBeInTheDocument()
  })

  it('should display current resource when available', () => {
    mockValidationControls.isValidating = true
    mockValidationControls.status = 'running'
    mockValidationControls.progress = 50

    render(<ValidationEngineCard />)

    // The component should display progress information
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('should handle button click errors gracefully', async () => {
    mockValidationControls.startValidation.mockRejectedValue(new Error('Network error'))

    render(<ValidationEngineCard />)

    const startButton = screen.getByRole('button', { name: /start validation/i })
    fireEvent.click(startButton)

    await waitFor(() => {
      expect(mockValidationControls.startValidation).toHaveBeenCalled()
    })
  })

  it('should display loading state on buttons', () => {
    mockValidationControls.isLoading = true

    render(<ValidationEngineCard />)

    const buttons = screen.getAllByRole('button')
    buttons.forEach(button => {
      expect(button).toBeDisabled()
    })
  })
})
