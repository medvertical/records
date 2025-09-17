import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { Dashboard } from './dashboard'

// Mock the dashboard components
vi.mock('../../components/dashboard/server-stats-card', () => ({
  ServerStatsCard: ({ data }: any) => <div data-testid="server-stats-card">{JSON.stringify(data)}</div>
}))

vi.mock('../../components/dashboard/resource-stats-card', () => ({
  ResourceStatsCard: ({ data }: any) => <div data-testid="resource-stats-card">{JSON.stringify(data)}</div>
}))

vi.mock('../../components/dashboard/validation-stats-card', () => ({
  ValidationStatsCard: ({ data }: any) => <div data-testid="validation-stats-card">{JSON.stringify(data)}</div>
}))

vi.mock('../../components/dashboard/validation-engine-card', () => ({
  ValidationEngineCard: () => <div data-testid="validation-engine-card">Validation Engine Card</div>
}))

vi.mock('../../components/dashboard/validation-trends', () => ({
  ValidationTrends: ({ data }: any) => <div data-testid="validation-trends">{JSON.stringify(data)}</div>
}))

vi.mock('../../components/dashboard/resource-breakdown', () => ({
  ResourceBreakdown: ({ data }: any) => <div data-testid="resource-breakdown">{JSON.stringify(data)}</div>
}))

vi.mock('../../components/dashboard/resource-type-pie-chart', () => ({
  ResourceTypePieChart: ({ data }: any) => <div data-testid="resource-type-pie-chart">{JSON.stringify(data)}</div>
}))

// Mock the API hooks
const mockUseQuery = vi.fn()

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: any) => mockUseQuery(options)
}))

// Mock the icons
vi.mock('lucide-react', () => ({
  BarChart3: () => <div data-testid="bar-chart-icon" />,
  Server: () => <div data-testid="server-icon" />,
  Database: () => <div data-testid="database-icon" />,
  CheckCircle: () => <div data-testid="check-circle-icon" />,
  TrendingUp: () => <div data-testid="trending-up-icon" />,
  PieChart: () => <div data-testid="pie-chart-icon" />,
  Activity: () => <div data-testid="activity-icon" />,
  RefreshCw: () => <div data-testid="refresh-cw-icon" />,
  AlertCircle: () => <div data-testid="alert-circle-icon" />
}))

describe('Dashboard', () => {
  const mockDashboardData = {
    serverStats: {
      serverName: 'Test Server',
      serverUrl: 'https://hapi.fhir.org/baseR4',
      isConnected: true,
      fhirVersion: '4.0.1',
      responseTime: 150,
      lastChecked: '2024-01-01T00:00:00.000Z'
    },
    resourceStats: {
      totalResources: 425,
      resourceTypes: [
        { resourceType: 'Patient', count: 100, percentage: 23.53 },
        { resourceType: 'Observation', count: 250, percentage: 58.82 },
        { resourceType: 'Encounter', count: 75, percentage: 17.65 }
      ],
      lastUpdated: '2024-01-01T00:00:00.000Z'
    },
    validationStats: {
      totalProfiles: 5,
      totalValidated: 100,
      validationCoverage: 85,
      validationProgress: 75,
      successRate: 92.5,
      errorRate: 7.5,
      recentErrors: 3,
      breakdown: {
        byProfile: [
          {
            profileName: 'Patient Profile',
            total: 50,
            valid: 45,
            invalid: 5,
            successRate: 90
          }
        ],
        byResourceType: [
          {
            resourceType: 'Patient',
            total: 50,
            valid: 45,
            invalid: 5,
            successRate: 90
          }
        ]
      }
    },
    lastUpdated: '2024-01-01T00:00:00.000Z'
  }

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock successful API response
    mockUseQuery.mockReturnValue({
      data: mockDashboardData,
      isLoading: false,
      error: null,
      refetch: vi.fn()
    })
  })

  it('should render dashboard page', () => {
    render(<Dashboard />)

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('FHIR Validation Platform')).toBeInTheDocument()
  })

  it('should render all dashboard components', () => {
    render(<Dashboard />)

    expect(screen.getByTestId('server-stats-card')).toBeInTheDocument()
    expect(screen.getByTestId('resource-stats-card')).toBeInTheDocument()
    expect(screen.getByTestId('validation-stats-card')).toBeInTheDocument()
    expect(screen.getByTestId('validation-engine-card')).toBeInTheDocument()
    expect(screen.getByTestId('validation-trends')).toBeInTheDocument()
    expect(screen.getByTestId('resource-breakdown')).toBeInTheDocument()
    expect(screen.getByTestId('resource-type-pie-chart')).toBeInTheDocument()
  })

  it('should pass correct data to server stats card', () => {
    render(<Dashboard />)

    const serverStatsCard = screen.getByTestId('server-stats-card')
    expect(serverStatsCard).toHaveTextContent(JSON.stringify(mockDashboardData.serverStats))
  })

  it('should pass correct data to resource stats card', () => {
    render(<Dashboard />)

    const resourceStatsCard = screen.getByTestId('resource-stats-card')
    expect(resourceStatsCard).toHaveTextContent(JSON.stringify(mockDashboardData.resourceStats))
  })

  it('should pass correct data to validation stats card', () => {
    render(<Dashboard />)

    const validationStatsCard = screen.getByTestId('validation-stats-card')
    expect(validationStatsCard).toHaveTextContent(JSON.stringify(mockDashboardData.validationStats))
  })

  it('should pass correct data to validation trends', () => {
    render(<Dashboard />)

    const validationTrends = screen.getByTestId('validation-trends')
    expect(validationTrends).toHaveTextContent(JSON.stringify(mockDashboardData.validationStats))
  })

  it('should pass correct data to resource breakdown', () => {
    render(<Dashboard />)

    const resourceBreakdown = screen.getByTestId('resource-breakdown')
    expect(resourceBreakdown).toHaveTextContent(JSON.stringify(mockDashboardData.resourceStats))
  })

  it('should pass correct data to resource type pie chart', () => {
    render(<Dashboard />)

    const resourceTypePieChart = screen.getByTestId('resource-type-pie-chart')
    expect(resourceTypePieChart).toHaveTextContent(JSON.stringify(mockDashboardData.resourceStats))
  })

  it('should display loading state', () => {
    mockUseQuery.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
      refetch: vi.fn()
    })

    render(<Dashboard />)

    expect(screen.getByText('Loading dashboard data...')).toBeInTheDocument()
  })

  it('should display error state', () => {
    const error = new Error('Failed to load dashboard data')
    mockUseQuery.mockReturnValue({
      data: null,
      isLoading: false,
      error,
      refetch: vi.fn()
    })

    render(<Dashboard />)

    expect(screen.getByText('Error loading dashboard data')).toBeInTheDocument()
    expect(screen.getByText('Failed to load dashboard data')).toBeInTheDocument()
  })

  it('should display retry button on error', () => {
    const error = new Error('Failed to load dashboard data')
    const mockRefetch = vi.fn()
    mockUseQuery.mockReturnValue({
      data: null,
      isLoading: false,
      error,
      refetch: mockRefetch
    })

    render(<Dashboard />)

    const retryButton = screen.getByRole('button', { name: /retry/i })
    expect(retryButton).toBeInTheDocument()
  })

  it('should call refetch when retry button is clicked', async () => {
    const error = new Error('Failed to load dashboard data')
    const mockRefetch = vi.fn()
    mockUseQuery.mockReturnValue({
      data: null,
      isLoading: false,
      error,
      refetch: mockRefetch
    })

    render(<Dashboard />)

    const retryButton = screen.getByRole('button', { name: /retry/i })
    retryButton.click()

    await waitFor(() => {
      expect(mockRefetch).toHaveBeenCalled()
    })
  })

  it('should handle empty data gracefully', () => {
    mockUseQuery.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      refetch: vi.fn()
    })

    render(<Dashboard />)

    expect(screen.getByText('No dashboard data available')).toBeInTheDocument()
  })

  it('should handle partial data gracefully', () => {
    const partialData = {
      serverStats: mockDashboardData.serverStats,
      resourceStats: null,
      validationStats: mockDashboardData.validationStats,
      lastUpdated: '2024-01-01T00:00:00.000Z'
    }

    mockUseQuery.mockReturnValue({
      data: partialData,
      isLoading: false,
      error: null,
      refetch: vi.fn()
    })

    render(<Dashboard />)

    expect(screen.getByTestId('server-stats-card')).toBeInTheDocument()
    expect(screen.getByTestId('validation-stats-card')).toBeInTheDocument()
    // Resource stats card should still render but with null data
    expect(screen.getByTestId('resource-stats-card')).toBeInTheDocument()
  })

  it('should display last updated timestamp', () => {
    render(<Dashboard />)

    expect(screen.getByText('Last updated: 1/1/2024, 12:00:00 AM')).toBeInTheDocument()
  })

  it('should handle missing last updated timestamp', () => {
    const dataWithoutTimestamp = {
      ...mockDashboardData,
      lastUpdated: null
    }

    mockUseQuery.mockReturnValue({
      data: dataWithoutTimestamp,
      isLoading: false,
      error: null,
      refetch: vi.fn()
    })

    render(<Dashboard />)

    expect(screen.getByText('Last updated: Unknown')).toBeInTheDocument()
  })

  it('should render dashboard sections in correct order', () => {
    render(<Dashboard />)

    const sections = screen.getAllByRole('region')
    expect(sections).toHaveLength(7) // 7 dashboard sections
  })

  it('should handle API query options correctly', () => {
    render(<Dashboard />)

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryKey: ['dashboard', 'combined'],
      queryFn: expect.any(Function),
      refetchInterval: 30000,
      staleTime: 10000
    })
  })

  it('should handle refetch interval', () => {
    render(<Dashboard />)

    // The component should set up automatic refetching
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        refetchInterval: 30000
      })
    )
  })

  it('should handle stale time', () => {
    render(<Dashboard />)

    // The component should set up stale time
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        staleTime: 10000
      })
    )
  })

  it('should render icons correctly', () => {
    render(<Dashboard />)

    expect(screen.getByTestId('bar-chart-icon')).toBeInTheDocument()
    expect(screen.getByTestId('server-icon')).toBeInTheDocument()
    expect(screen.getByTestId('database-icon')).toBeInTheDocument()
    expect(screen.getByTestId('check-circle-icon')).toBeInTheDocument()
    expect(screen.getByTestId('trending-up-icon')).toBeInTheDocument()
    expect(screen.getByTestId('pie-chart-icon')).toBeInTheDocument()
    expect(screen.getByTestId('activity-icon')).toBeInTheDocument()
  })

  it('should handle component unmounting gracefully', () => {
    const { unmount } = render(<Dashboard />)

    expect(() => unmount()).not.toThrow()
  })

  it('should handle rapid data updates', () => {
    const { rerender } = render(<Dashboard />)

    // Simulate rapid data updates
    const updatedData = {
      ...mockDashboardData,
      validationStats: {
        ...mockDashboardData.validationStats,
        progress: 100
      }
    }

    mockUseQuery.mockReturnValue({
      data: updatedData,
      isLoading: false,
      error: null,
      refetch: vi.fn()
    })

    rerender(<Dashboard />)

    expect(screen.getByTestId('validation-stats-card')).toBeInTheDocument()
  })
})
