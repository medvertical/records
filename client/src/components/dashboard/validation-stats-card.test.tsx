import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ValidationStatsCard } from './validation-stats-card'

// Mock the icons
vi.mock('lucide-react', () => ({
  CheckCircle: () => <div data-testid="check-circle-icon" />,
  XCircle: () => <div data-testid="x-circle-icon" />,
  AlertCircle: () => <div data-testid="alert-circle-icon" />,
  AlertTriangle: () => <div data-testid="alert-triangle-icon" />,
  TrendingUp: () => <div data-testid="trending-up-icon" />,
  TrendingDown: () => <div data-testid="trending-down-icon" />,
  Minus: () => <div data-testid="minus-icon" />,
  Database: () => <div data-testid="database-icon" />,
  Clock: () => <div data-testid="clock-icon" />
}))

describe('ValidationStatsCard', () => {
  const mockData = {
    totalValidated: 100,
    validResources: 85,
    errorResources: 10,
    warningResources: 5,
    unvalidatedResources: 50,
    validationCoverage: 85,
    validationProgress: 66.7,
    lastValidationRun: new Date('2024-01-15T10:00:00Z'),
    resourceTypeBreakdown: {
      'Patient': { total: 50, validated: 40, valid: 35, errors: 3, warnings: 2, unvalidated: 10, validationRate: 80, successRate: 87.5 },
      'Observation': { total: 30, validated: 25, valid: 20, errors: 3, warnings: 2, unvalidated: 5, validationRate: 83.3, successRate: 80 },
      'Encounter': { total: 20, validated: 15, valid: 12, errors: 2, warnings: 1, unvalidated: 5, validationRate: 75, successRate: 80 }
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render validation statistics', () => {
    render(<ValidationStatsCard data={mockData} />)

    expect(screen.getByText('Validation Statistics')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument() // totalValidated
    expect(screen.getAllByText('85.0%')).toHaveLength(2) // Success rate and validation coverage
    expect(screen.getByText('66.7%')).toBeInTheDocument() // validationProgress
  })

  it('should render resource type breakdown', () => {
    render(<ValidationStatsCard data={mockData} />)

    expect(screen.getByText('Patient')).toBeInTheDocument()
    expect(screen.getByText('Observation')).toBeInTheDocument()
    expect(screen.getByText('Encounter')).toBeInTheDocument()
  })


  it('should handle empty data gracefully', () => {
    const emptyData = {
      totalValidated: 0,
      validResources: 0,
      errorResources: 0,
      warningResources: 0,
      unvalidatedResources: 0,
      validationCoverage: 0,
      validationProgress: 0,
      resourceTypeBreakdown: {}
    }

    render(<ValidationStatsCard data={emptyData} />)

    expect(screen.getByText('Validation Statistics')).toBeInTheDocument()
    expect(screen.getAllByText('0')).toHaveLength(5) // Multiple elements with 0
    expect(screen.getAllByText('0.0%')).toHaveLength(3) // Success rate, coverage, and progress
  })

  it('should handle undefined values gracefully', () => {
    const dataWithUndefined = {
      totalValidated: 100,
      validResources: 85,
      errorResources: 10,
      warningResources: 5,
      unvalidatedResources: 50,
      validationCoverage: undefined,
      validationProgress: 75,
      resourceTypeBreakdown: {
        'Patient': { total: 50, validated: 40, valid: 35, errors: 3, warnings: 2, unvalidated: 10, validationRate: 80, successRate: undefined }
      }
    }

    render(<ValidationStatsCard data={dataWithUndefined} />)

    expect(screen.getByText('Validation Statistics')).toBeInTheDocument()
    expect(screen.getAllByText('0.0%')).toHaveLength(2) // Should default to 0 for both coverage and progress
  })

  it('should display progress bars correctly', () => {
    render(<ValidationStatsCard data={mockData} />)

    const progressBars = screen.getAllByRole('progressbar')
    expect(progressBars.length).toBeGreaterThan(0) // Should have progress bars
  })

  it('should display validation coverage', () => {
    render(<ValidationStatsCard data={mockData} />)

    const coverageElements = screen.getAllByText('85.0%')
    expect(coverageElements).toHaveLength(2) // Success rate and validation coverage
  })

  it('should display validation progress', () => {
    render(<ValidationStatsCard data={mockData} />)

    const progressElement = screen.getByText('66.7%')
    expect(progressElement).toBeInTheDocument()
  })

  it('should handle large numbers correctly', () => {
    const largeData = {
      ...mockData,
      totalValidated: 1000000,
      validationCoverage: 99.99
    }

    render(<ValidationStatsCard data={largeData} />)

    expect(screen.getByText('1,000,000')).toBeInTheDocument()
    expect(screen.getByText('100.0%')).toBeInTheDocument()
  })

  it('should handle decimal precision correctly', () => {
    const decimalData = {
      ...mockData,
      validationCoverage: 92.567,
      validationProgress: 7.433
    }

    render(<ValidationStatsCard data={decimalData} />)

    expect(screen.getByText('92.6%')).toBeInTheDocument() // Rounded to 1 decimal place
    expect(screen.getByText('7.4%')).toBeInTheDocument() // Rounded to 1 decimal place
  })

  it('should render icons correctly', () => {
    render(<ValidationStatsCard data={mockData} />)

    expect(screen.getAllByTestId('check-circle-icon')).toHaveLength(2) // Header and valid count
    expect(screen.getByTestId('alert-circle-icon')).toBeInTheDocument()
    expect(screen.getByTestId('alert-triangle-icon')).toBeInTheDocument()
    expect(screen.getAllByTestId('database-icon')).toHaveLength(4) // Unvalidated count + 3 resource types
    expect(screen.getByTestId('clock-icon')).toBeInTheDocument()
  })

  it('should handle missing breakdown data', () => {
    const dataWithoutBreakdown = {
      ...mockData,
      resourceTypeBreakdown: {}
    }

    render(<ValidationStatsCard data={dataWithoutBreakdown} />)

    expect(screen.getByText('Validation Statistics')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument() // totalValidated should still show
  })

  it('should handle null breakdown gracefully', () => {
    const dataWithNullBreakdown = {
      ...mockData,
      resourceTypeBreakdown: null as any
    }

    render(<ValidationStatsCard data={dataWithNullBreakdown} />)

    expect(screen.getByText('Validation Statistics')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument() // totalValidated should still show
  })
})