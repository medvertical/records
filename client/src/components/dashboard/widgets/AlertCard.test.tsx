import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AlertCard } from './AlertCard'

// Mock the dashboard data wiring hook
const mockUseDashboardDataWiring = vi.fn()
vi.mock('@/hooks/use-dashboard-data-wiring', () => ({
  useDashboardDataWiring: () => mockUseDashboardDataWiring()
}))

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Bell: () => <div data-testid="bell-icon" />,
  AlertTriangle: () => <div data-testid="alert-triangle-icon" />,
  Settings: () => <div data-testid="settings-icon" />
}))

// Mock the base dashboard card components
vi.mock('./BaseDashboardCard', () => ({
  BaseDashboardCard: ({ children, title, icon: Icon, className }: any) => (
    <div data-testid="base-dashboard-card" className={className}>
      <div data-testid="card-header">
        <span>{title}</span>
        <Icon />
      </div>
      <div data-testid="card-content">{children}</div>
    </div>
  ),
  LoadingCard: ({ title, icon: Icon, className }: any) => (
    <div data-testid="loading-card" className={className}>
      <div data-testid="card-header">
        <span>{title}</span>
        <Icon />
      </div>
      <div>Loading...</div>
    </div>
  ),
  ErrorCard: ({ title, icon: Icon, error, className }: any) => (
    <div data-testid="error-card" className={className}>
      <div data-testid="card-header">
        <span>{title}</span>
        <Icon />
      </div>
      <div className="text-destructive">{error}</div>
    </div>
  )
}))

describe('AlertCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render loading state', () => {
    mockUseDashboardDataWiring.mockReturnValue({
      alerts: undefined,
      isLoading: true,
      hasErrors: false,
      refreshAlerts: vi.fn()
    })

    render(<AlertCard />)

    expect(screen.getByTestId('loading-card')).toBeInTheDocument()
    expect(screen.getByText('Alerts')).toBeInTheDocument()
    expect(screen.getByTestId('bell-icon')).toBeInTheDocument()
  })

  it('should render error state', () => {
    mockUseDashboardDataWiring.mockReturnValue({
      alerts: undefined,
      isLoading: false,
      hasErrors: true,
      refreshAlerts: vi.fn()
    })

    render(<AlertCard />)

    expect(screen.getByTestId('error-card')).toBeInTheDocument()
    expect(screen.getByText('Alerts')).toBeInTheDocument()
    expect(screen.getByTestId('alert-triangle-icon')).toBeInTheDocument()
    expect(screen.getByText('Failed to load alerts')).toBeInTheDocument()
  })

  it('should render alerts data', () => {
    const mockAlerts = [
      { id: '1', severity: 'error', message: 'Critical error', timestamp: new Date() },
      { id: '2', severity: 'warning', message: 'Warning message', timestamp: new Date() },
      { id: '3', severity: 'info', message: 'Info message', timestamp: new Date() }
    ]

    mockUseDashboardDataWiring.mockReturnValue({
      alerts: mockAlerts,
      isLoading: false,
      hasErrors: false,
      refreshAlerts: vi.fn()
    })

    render(<AlertCard />)

    expect(screen.getByTestId('base-dashboard-card')).toBeInTheDocument()
    expect(screen.getByText('Alerts')).toBeInTheDocument()
    expect(screen.getByTestId('bell-icon')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument() // Total alerts
    expect(screen.getByText('1 critical')).toBeInTheDocument() // Critical alerts
  })

  it('should render no alerts message', () => {
    mockUseDashboardDataWiring.mockReturnValue({
      alerts: [],
      isLoading: false,
      hasErrors: false,
      refreshAlerts: vi.fn()
    })

    render(<AlertCard />)

    expect(screen.getByTestId('base-dashboard-card')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument() // Total alerts
    expect(screen.getByText('No active alerts')).toBeInTheDocument()
  })

  it('should handle button clicks', () => {
    const mockRefreshAlerts = vi.fn()
    mockUseDashboardDataWiring.mockReturnValue({
      alerts: [],
      isLoading: false,
      hasErrors: false,
      refreshAlerts: mockRefreshAlerts
    })

    render(<AlertCard />)

    const viewAllButton = screen.getByText('View All')
    const configureButton = screen.getByTestId('settings-icon')

    fireEvent.click(viewAllButton)
    fireEvent.click(configureButton)

    // These buttons currently just log to console, so we can't test the actual behavior
    // In a real implementation, we would test the actual functionality
  })

  it('should apply custom className', () => {
    mockUseDashboardDataWiring.mockReturnValue({
      alerts: [],
      isLoading: false,
      hasErrors: false,
      refreshAlerts: vi.fn()
    })

    render(<AlertCard className="custom-alert-class" />)

    expect(screen.getByTestId('base-dashboard-card')).toHaveClass('custom-alert-class')
  })

  it('should handle undefined alerts gracefully', () => {
    mockUseDashboardDataWiring.mockReturnValue({
      alerts: undefined,
      isLoading: false,
      hasErrors: false,
      refreshAlerts: vi.fn()
    })

    render(<AlertCard />)

    expect(screen.getByTestId('base-dashboard-card')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument() // Should default to 0
    expect(screen.getByText('No active alerts')).toBeInTheDocument()
  })
})