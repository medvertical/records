// ============================================================================
// Server Stats Card Tests
// ============================================================================

import { render, screen } from '@testing-library/react';
import { ServerStatsCard } from './server-stats-card';
import { FhirServerStats } from '@shared/types/dashboard';

const mockFhirServerStats: FhirServerStats = {
  totalResources: 1000000,
  resourceCounts: {
    'Patient': 400000,
    'Observation': 300000,
    'Encounter': 200000,
    'Condition': 100000
  },
  serverInfo: {
    version: 'R4',
    connected: true,
    lastChecked: new Date('2025-01-01T12:00:00Z'),
    error: undefined
  },
  resourceBreakdown: [
    { type: 'Patient', count: 400000, percentage: 40 },
    { type: 'Observation', count: 300000, percentage: 30 },
    { type: 'Encounter', count: 200000, percentage: 20 },
    { type: 'Condition', count: 100000, percentage: 10 }
  ]
};

describe('ServerStatsCard', () => {
  it('should render FHIR server statistics correctly', () => {
    render(
      <ServerStatsCard 
        data={mockFhirServerStats}
        isLoading={false}
        error={null}
        lastUpdated={new Date()}
      />
    );

    expect(screen.getByText('FHIR Server Statistics')).toBeInTheDocument();
    expect(screen.getByText('R4')).toBeInTheDocument();
    expect(screen.getByText('1,000,000')).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('should display resource distribution', () => {
    render(
      <ServerStatsCard 
        data={mockFhirServerStats}
        isLoading={false}
        error={null}
        lastUpdated={new Date()}
      />
    );

    expect(screen.getByText('Patient')).toBeInTheDocument();
    expect(screen.getByText('Observation')).toBeInTheDocument();
    expect(screen.getByText('Encounter')).toBeInTheDocument();
    expect(screen.getByText('Condition')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    render(
      <ServerStatsCard 
        data={mockFhirServerStats}
        isLoading={true}
        error={null}
        lastUpdated={new Date()}
      />
    );

    expect(screen.getByText('Loading server information...')).toBeInTheDocument();
  });

  it('should show error state', () => {
    const errorMessage = 'Failed to connect to server';
    render(
      <ServerStatsCard 
        data={mockFhirServerStats}
        isLoading={false}
        error={errorMessage}
        lastUpdated={new Date()}
      />
    );

    expect(screen.getByText('Error loading server data')).toBeInTheDocument();
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it('should show disconnected state', () => {
    const disconnectedStats = {
      ...mockFhirServerStats,
      serverInfo: {
        ...mockFhirServerStats.serverInfo,
        connected: false,
        error: 'Connection timeout'
      }
    };

    render(
      <ServerStatsCard 
        data={disconnectedStats}
        isLoading={false}
        error={null}
        lastUpdated={new Date()}
      />
    );

    expect(screen.getByText('Disconnected')).toBeInTheDocument();
    expect(screen.getByText('Connection timeout')).toBeInTheDocument();
  });

  it('should format numbers correctly', () => {
    render(
      <ServerStatsCard 
        data={mockFhirServerStats}
        isLoading={false}
        error={null}
        lastUpdated={new Date()}
      />
    );

    // Check that large numbers are formatted with commas
    expect(screen.getByText('1,000,000')).toBeInTheDocument();
    expect(screen.getByText('400,000')).toBeInTheDocument();
    expect(screen.getByText('300,000')).toBeInTheDocument();
  });

  it('should show data freshness indicator', () => {
    const lastUpdated = new Date('2025-01-01T12:00:00Z');
    render(
      <ServerStatsCard 
        data={mockFhirServerStats}
        isLoading={false}
        error={null}
        lastUpdated={lastUpdated}
      />
    );

    expect(screen.getByText(/Data updated:/)).toBeInTheDocument();
  });
});
