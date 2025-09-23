import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AlertCard } from './widgets/AlertCard'
import { OverviewCard } from './widgets/OverviewCard'

// Mock the dashboard data wiring hook
const mockUseDashboardDataWiring = vi.fn()
vi.mock('@/hooks/use-dashboard-data-wiring', () => ({
  useDashboardDataWiring: () => mockUseDashboardDataWiring()
}))

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Bell: () => <div data-testid="bell-icon" />,
  Database: () => <div data-testid="database-icon" />,
  RefreshCw: () => <div data-testid="refresh-cw-icon" />,
  Settings: () => <div data-testid="settings-icon" />,
  AlertTriangle: () => <div data-testid="alert-triangle-icon" />
}))

// Mock the base dashboard card components
vi.mock('./widgets/BaseDashboardCard', () => ({
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

describe('Dashboard Component Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('AlertCard Integration', () => {
    it('should render with proper data integration', () => {
      const mockAlerts = [
        { id: '1', severity: 'error', message: 'Test error', timestamp: new Date() }
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
      expect(screen.getByText('1')).toBeInTheDocument() // Alert count
    })

    it('should handle loading state', () => {
      mockUseDashboardDataWiring.mockReturnValue({
        alerts: undefined,
        isLoading: true,
        hasErrors: false,
        refreshAlerts: vi.fn()
      })

      render(<AlertCard />)

      expect(screen.getByTestId('loading-card')).toBeInTheDocument()
      expect(screen.getByText('Alerts')).toBeInTheDocument()
    })

    it('should handle error state', () => {
      mockUseDashboardDataWiring.mockReturnValue({
        alerts: undefined,
        isLoading: false,
        hasErrors: true,
        refreshAlerts: vi.fn()
      })

      render(<AlertCard />)

      expect(screen.getByTestId('error-card')).toBeInTheDocument()
      expect(screen.getByText('Alerts')).toBeInTheDocument()
      expect(screen.getByText('Failed to load alerts')).toBeInTheDocument()
    })
  })

  describe('OverviewCard Integration', () => {
    it('should render with proper data integration', () => {
      const mockStats = {
        totalResources: 150,
        validatedResources: 75,
        successRate: 50,
        lastUpdated: new Date()
      }

      mockUseDashboardDataWiring.mockReturnValue({
        fhirServerStats: mockStats,
        validationStats: mockStats,
        isLoading: false,
        hasErrors: false,
        refreshOverview: vi.fn()
      })

      render(<OverviewCard />)

      expect(screen.getByTestId('base-dashboard-card')).toBeInTheDocument()
      expect(screen.getByText('Overview')).toBeInTheDocument()
      expect(screen.getByText('150')).toBeInTheDocument() // Total resources
    })

    it('should handle loading state', () => {
      mockUseDashboardDataWiring.mockReturnValue({
        fhirServerStats: undefined,
        validationStats: undefined,
        isLoading: true,
        hasErrors: false,
        refreshOverview: vi.fn()
      })

      render(<OverviewCard />)

      expect(screen.getByTestId('loading-card')).toBeInTheDocument()
      expect(screen.getByText('Overview')).toBeInTheDocument()
    })

    it('should handle error state', () => {
      mockUseDashboardDataWiring.mockReturnValue({
        fhirServerStats: undefined,
        validationStats: undefined,
        isLoading: false,
        hasErrors: true,
        refreshOverview: vi.fn()
      })

      render(<OverviewCard />)

      expect(screen.getByTestId('error-card')).toBeInTheDocument()
      expect(screen.getByText('Overview')).toBeInTheDocument()
      expect(screen.getByText('Failed to load overview data')).toBeInTheDocument()
    })
  })

  describe('Component Interaction', () => {
    it('should render multiple components together', () => {
      mockUseDashboardDataWiring.mockReturnValue({
        alerts: [],
        fhirServerStats: { totalResources: 100 },
        validationStats: { totalValidated: 50 },
        isLoading: false,
        hasErrors: false,
        refreshAlerts: vi.fn(),
        refreshOverview: vi.fn()
      })

      render(
        <div>
          <AlertCard />
          <OverviewCard />
        </div>
      )

      expect(screen.getAllByTestId('base-dashboard-card')).toHaveLength(2)
      expect(screen.getByText('Alerts')).toBeInTheDocument()
      expect(screen.getByText('Overview')).toBeInTheDocument()
    })

    it('should handle mixed states across components', () => {
      // Mock different states for different components
      mockUseDashboardDataWiring
        .mockReturnValueOnce({
          alerts: [],
          isLoading: false,
          hasErrors: false,
          refreshAlerts: vi.fn()
        })
        .mockReturnValueOnce({
          fhirServerStats: undefined,
          validationStats: undefined,
          isLoading: true,
          hasErrors: false,
          refreshOverview: vi.fn()
        })

      render(
        <div>
          <AlertCard />
          <OverviewCard />
        </div>
      )

      expect(screen.getByTestId('base-dashboard-card')).toBeInTheDocument() // AlertCard
      expect(screen.getByTestId('loading-card')).toBeInTheDocument() // OverviewCard
    })
  })
})
