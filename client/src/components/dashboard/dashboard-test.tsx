// ============================================================================
// Dashboard Test Component - Quick Test of New Components
// ============================================================================

import { ServerStatsCard } from './server-stats-card';
import { ValidationStatsCard } from './validation-stats-card';
import { FhirServerStats, ValidationStats } from '@shared/types/dashboard';

// Mock data for testing
const mockFhirServerStats: FhirServerStats = {
  totalResources: 2625823,
  resourceCounts: {
    'Patient': 500000,
    'Observation': 800000,
    'Encounter': 300000,
    'Condition': 200000,
    'Practitioner': 100000,
    'Organization': 50000,
    'Other': 725823
  },
  serverInfo: {
    version: 'R4',
    connected: true,
    lastChecked: new Date(),
    error: undefined
  },
  resourceBreakdown: [
    { type: 'Patient', count: 500000, percentage: 19.0 },
    { type: 'Observation', count: 800000, percentage: 30.5 },
    { type: 'Encounter', count: 300000, percentage: 11.4 },
    { type: 'Condition', count: 200000, percentage: 7.6 },
    { type: 'Practitioner', count: 100000, percentage: 3.8 },
    { type: 'Organization', count: 50000, percentage: 1.9 }
  ]
};

const mockValidationStats: ValidationStats = {
  totalValidated: 1250,
  validResources: 1100,
  errorResources: 120,
  warningResources: 30,
  unvalidatedResources: 2624573,
  validationCoverage: 88.0, // 1100/1250 * 100
  validationProgress: 0.048, // 1250/2625823 * 100
  lastValidationRun: new Date(),
  resourceTypeBreakdown: {
    'Patient': {
      total: 500000,
      validated: 500,
      valid: 450,
      errors: 40,
      warnings: 10,
      unvalidated: 499500,
      validationRate: 0.1, // 500/500000 * 100
      successRate: 90.0 // 450/500 * 100
    },
    'Observation': {
      total: 800000,
      validated: 750,
      valid: 650,
      errors: 80,
      warnings: 20,
      unvalidated: 799250,
      validationRate: 0.094, // 750/800000 * 100
      successRate: 86.7 // 650/750 * 100
    }
  }
};

export function DashboardTest() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Dashboard Components Test</h1>
      
      <div className="grid gap-6 lg:grid-cols-2">
        <ServerStatsCard 
          data={mockFhirServerStats}
          isLoading={false}
          error={null}
          lastUpdated={new Date()}
        />
        
        <ValidationStatsCard 
          data={mockValidationStats}
          isLoading={false}
          error={null}
          lastUpdated={new Date()}
        />
      </div>
      
      <div className="text-sm text-muted-foreground">
        This is a test component to verify the new dashboard components work correctly.
        The data shown above is mock data for demonstration purposes.
      </div>
    </div>
  );
}
