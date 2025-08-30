// ============================================================================
// Validation Stats Card Tests
// ============================================================================

import { render, screen } from '@testing-library/react';
import { ValidationStatsCard } from './validation-stats-card';
import { ValidationStats } from '@shared/types/dashboard';

const mockValidationStats: ValidationStats = {
  totalValidated: 1000,
  validResources: 800,
  errorResources: 150,
  warningResources: 50,
  unvalidatedResources: 999000,
  validationCoverage: 80, // 800/1000 * 100
  validationProgress: 0.1, // 1000/1000000 * 100
  lastValidationRun: new Date('2025-01-01T12:00:00Z'),
  resourceTypeBreakdown: {
    'Patient': {
      total: 500000,
      validated: 500,
      valid: 400,
      errors: 80,
      warnings: 20,
      unvalidated: 499500,
      validationRate: 0.1, // 500/500000 * 100
      successRate: 80 // 400/500 * 100
    },
    'Observation': {
      total: 300000,
      validated: 500,
      valid: 400,
      errors: 70,
      warnings: 30,
      unvalidated: 299500,
      validationRate: 0.167, // 500/300000 * 100
      successRate: 80 // 400/500 * 100
    }
  }
};

describe('ValidationStatsCard', () => {
  it('should render validation statistics correctly', () => {
    render(
      <ValidationStatsCard 
        data={mockValidationStats}
        isLoading={false}
        error={null}
        lastUpdated={new Date()}
      />
    );

    expect(screen.getByText('Validation Statistics')).toBeInTheDocument();
    expect(screen.getByText('1,000')).toBeInTheDocument(); // totalValidated
    expect(screen.getByText('80.0%')).toBeInTheDocument(); // success rate
  });

  it('should display validation coverage and progress', () => {
    render(
      <ValidationStatsCard 
        data={mockValidationStats}
        isLoading={false}
        error={null}
        lastUpdated={new Date()}
      />
    );

    expect(screen.getByText('Validation Coverage')).toBeInTheDocument();
    expect(screen.getByText('Validation Progress')).toBeInTheDocument();
    expect(screen.getByText('80.0%')).toBeInTheDocument(); // coverage
    expect(screen.getByText('0.1%')).toBeInTheDocument(); // progress
  });

  it('should show resource status breakdown', () => {
    render(
      <ValidationStatsCard 
        data={mockValidationStats}
        isLoading={false}
        error={null}
        lastUpdated={new Date()}
      />
    );

    expect(screen.getByText('800')).toBeInTheDocument(); // valid
    expect(screen.getByText('150')).toBeInTheDocument(); // errors
    expect(screen.getByText('50')).toBeInTheDocument(); // warnings
    expect(screen.getByText('999,000')).toBeInTheDocument(); // unvalidated
  });

  it('should display resource type breakdown', () => {
    render(
      <ValidationStatsCard 
        data={mockValidationStats}
        isLoading={false}
        error={null}
        lastUpdated={new Date()}
      />
    );

    expect(screen.getByText('Validation by Resource Type')).toBeInTheDocument();
    expect(screen.getByText('Patient')).toBeInTheDocument();
    expect(screen.getByText('Observation')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    render(
      <ValidationStatsCard 
        data={mockValidationStats}
        isLoading={true}
        error={null}
        lastUpdated={new Date()}
      />
    );

    expect(screen.getByText('Loading validation data...')).toBeInTheDocument();
  });

  it('should show error state', () => {
    const errorMessage = 'Failed to load validation data';
    render(
      <ValidationStatsCard 
        data={mockValidationStats}
        isLoading={false}
        error={errorMessage}
        lastUpdated={new Date()}
      />
    );

    expect(screen.getByText('Error loading validation data')).toBeInTheDocument();
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it('should calculate success rate correctly', () => {
    const statsWithZeroValidated = {
      ...mockValidationStats,
      totalValidated: 0,
      validResources: 0
    };

    render(
      <ValidationStatsCard 
        data={statsWithZeroValidated}
        isLoading={false}
        error={null}
        lastUpdated={new Date()}
      />
    );

    expect(screen.getByText('0.0%')).toBeInTheDocument(); // success rate
  });

  it('should format numbers correctly', () => {
    render(
      <ValidationStatsCard 
        data={mockValidationStats}
        isLoading={false}
        error={null}
        lastUpdated={new Date()}
      />
    );

    // Check that large numbers are formatted with commas
    expect(screen.getByText('999,000')).toBeInTheDocument(); // unvalidated
    expect(screen.getByText('500,000')).toBeInTheDocument(); // total in breakdown
  });

  it('should show last validation run time', () => {
    render(
      <ValidationStatsCard 
        data={mockValidationStats}
        isLoading={false}
        error={null}
        lastUpdated={new Date()}
      />
    );

    expect(screen.getByText(/Last validation:/)).toBeInTheDocument();
  });

  it('should show data freshness indicator', () => {
    const lastUpdated = new Date('2025-01-01T12:00:00Z');
    render(
      <ValidationStatsCard 
        data={mockValidationStats}
        isLoading={false}
        error={null}
        lastUpdated={lastUpdated}
      />
    );

    expect(screen.getByText(/Data updated:/)).toBeInTheDocument();
  });
});
