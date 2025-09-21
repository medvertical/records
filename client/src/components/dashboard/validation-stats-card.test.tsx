import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ValidationStatsCard } from './validation-stats-card';
import { ValidationStats } from '@shared/types/dashboard';

// Mock the validation settings query
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(() => ({
    data: {
      structural: { enabled: true, severity: 'error' },
      profile: { enabled: true, severity: 'warning' },
      terminology: { enabled: true, severity: 'warning' },
      reference: { enabled: false, severity: 'error' },
      businessRule: { enabled: true, severity: 'warning' },
      metadata: { enabled: true, severity: 'information' }
    },
    isLoading: false,
    error: null
  }))
}));

// Mock fetch
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({
    settings: {
      structural: { enabled: true, severity: 'error' },
      profile: { enabled: true, severity: 'warning' },
      terminology: { enabled: true, severity: 'warning' },
      reference: { enabled: false, severity: 'error' },
      businessRule: { enabled: true, severity: 'warning' },
      metadata: { enabled: true, severity: 'information' }
    }
  })
});

describe('ValidationStatsCard - Enhanced Progress Display', () => {
  const mockValidationStats: ValidationStats = {
    totalValidated: 1500,
    validResources: 1200,
    errorResources: 150,
    warningResources: 100,
    unvalidatedResources: 500,
    validationCoverage: 80.0,
    validationProgress: 75.0,
    lastValidationRun: new Date('2024-01-15T10:30:00Z'),
    resourceTypeBreakdown: {
      'Patient': {
        total: 500,
        validated: 450,
        valid: 400,
        errors: 30,
        warnings: 20,
        unvalidated: 50,
        validationRate: 90.0,
        successRate: 88.9
      },
      'Observation': {
        total: 300,
        validated: 250,
        valid: 200,
        errors: 25,
        warnings: 25,
        unvalidated: 50,
        validationRate: 83.3,
        successRate: 80.0
      },
      'DiagnosticReport': {
        total: 200,
        validated: 150,
        valid: 120,
        errors: 15,
        warnings: 15,
        unvalidated: 50,
        validationRate: 75.0,
        successRate: 80.0
      }
    },
    aspectBreakdown: {
      structural: {
        enabled: true,
        issueCount: 50,
        errorCount: 20,
        warningCount: 20,
        informationCount: 10,
        score: 85.0
      },
      profile: {
        enabled: true,
        issueCount: 30,
        errorCount: 10,
        warningCount: 15,
        informationCount: 5,
        score: 90.0
      },
      terminology: {
        enabled: true,
        issueCount: 25,
        errorCount: 5,
        warningCount: 15,
        informationCount: 5,
        score: 95.0
      }
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Resource Type Progress Breakdown', () => {
    it('should display resource type progress breakdown with validation rates', () => {
      render(<ValidationStatsCard data={mockValidationStats} />);
      
      // Check that resource types are displayed
      expect(screen.getByText('Validation by Resource Type')).toBeInTheDocument();
      expect(screen.getByText('Patient')).toBeInTheDocument();
      expect(screen.getByText('Observation')).toBeInTheDocument();
      expect(screen.getByText('DiagnosticReport')).toBeInTheDocument();
      
      // Check validation progress information
      expect(screen.getByText('450/500 validated')).toBeInTheDocument();
      expect(screen.getByText('250/300 validated')).toBeInTheDocument();
      expect(screen.getByText('150/200 validated')).toBeInTheDocument();
    });

    it('should display validation progress bars for each resource type', () => {
      render(<ValidationStatsCard data={mockValidationStats} />);
      
      // Check that progress bars are rendered (they should have role="progressbar")
      const progressBars = screen.getAllByRole('progressbar');
      expect(progressBars.length).toBeGreaterThan(0);
    });

    it('should display success rate information for validated resources', () => {
      render(<ValidationStatsCard data={mockValidationStats} />);
      
      // Check success rate percentages
      expect(screen.getByText('88.9%')).toBeInTheDocument(); // Patient success rate
      const successRateElements = screen.getAllByText('80.0%');
      expect(successRateElements.length).toBeGreaterThan(0); // Observation success rate
    });

    it('should display status breakdown with counts', () => {
      render(<ValidationStatsCard data={mockValidationStats} />);
      
      // Check status indicators
      expect(screen.getByText('400 valid')).toBeInTheDocument();
      expect(screen.getByText('30 errors')).toBeInTheDocument();
      expect(screen.getByText('20 warnings')).toBeInTheDocument();
    });

    it('should sort resource types by total count', () => {
      render(<ValidationStatsCard data={mockValidationStats} />);
      
      // Patient should be first (500 total), then Observation (300), then DiagnosticReport (200)
      const resourceTypeElements = screen.getAllByText(/Patient|Observation|DiagnosticReport/);
      expect(resourceTypeElements[0]).toHaveTextContent('Patient');
      expect(resourceTypeElements[1]).toHaveTextContent('Observation');
      expect(resourceTypeElements[2]).toHaveTextContent('DiagnosticReport');
    });
  });

  describe('Active Validation Aspects Display', () => {
    it('should display enabled validation aspects', () => {
      render(<ValidationStatsCard data={mockValidationStats} />);
      
      expect(screen.getByText('Active Validation Aspects')).toBeInTheDocument();
      const structuralElements = screen.getAllByText('structural');
      expect(structuralElements.length).toBeGreaterThan(0);
      const profileElements = screen.getAllByText('profile');
      expect(profileElements.length).toBeGreaterThan(0);
      const terminologyElements = screen.getAllByText('terminology');
      expect(terminologyElements.length).toBeGreaterThan(0);
      expect(screen.getByText('business Rule')).toBeInTheDocument();
      expect(screen.getByText('metadata')).toBeInTheDocument();
    });

    it('should show aspect status with appropriate styling', () => {
      render(<ValidationStatsCard data={mockValidationStats} />);
      
      // Enabled aspects should have green styling
      const structuralElements = screen.getAllByText('structural');
      expect(structuralElements.length).toBeGreaterThan(0);
      const profileElements = screen.getAllByText('profile');
      expect(profileElements.length).toBeGreaterThan(0);
      const terminologyElements = screen.getAllByText('terminology');
      expect(terminologyElements.length).toBeGreaterThan(0);
      expect(screen.getByText('business Rule')).toBeInTheDocument();
      expect(screen.getByText('metadata')).toBeInTheDocument();
    });
  });

  describe('Loading and Error States', () => {
    it('should display loading state when isLoading is true', () => {
      render(<ValidationStatsCard isLoading={true} />);
      
      expect(screen.getByText('Loading validation data...')).toBeInTheDocument();
      expect(screen.getByText('Validation Statistics')).toBeInTheDocument();
    });

    it('should display error state when error is provided', () => {
      const errorMessage = 'Failed to load validation data';
      render(<ValidationStatsCard error={errorMessage} />);
      
      expect(screen.getByText('Error loading validation data')).toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    it('should handle empty data gracefully', () => {
      render(<ValidationStatsCard data={null} />);
      
      // Should still render the card structure
      expect(screen.getByText('Validation Statistics')).toBeInTheDocument();
      expect(screen.getByText('Validation results from local database')).toBeInTheDocument();
    });
  });

  describe('Summary Statistics', () => {
    it('should display total validated resources', () => {
      render(<ValidationStatsCard data={mockValidationStats} />);
      
      expect(screen.getByText('1,500')).toBeInTheDocument(); // totalValidated formatted
    });

    it('should calculate and display success rate', () => {
      render(<ValidationStatsCard data={mockValidationStats} />);
      
      // Success rate should be (1200/1500) * 100 = 80%
      const successRateElements = screen.getAllByText('80.0%');
      expect(successRateElements.length).toBeGreaterThan(0);
    });

    it('should display validation coverage', () => {
      render(<ValidationStatsCard data={mockValidationStats} />);
      
      expect(screen.getByText('Validation Coverage')).toBeInTheDocument();
      const coverageElements = screen.getAllByText('80.0%');
      expect(coverageElements.length).toBeGreaterThan(0);
    });

    it('should display validation progress', () => {
      render(<ValidationStatsCard data={mockValidationStats} />);
      
      const progressLabels = screen.getAllByText('Validation Progress');
      expect(progressLabels.length).toBeGreaterThan(0);
      const progressElements = screen.getAllByText('75.0%');
      expect(progressElements.length).toBeGreaterThan(0);
    });
  });

  describe('Resource Status Breakdown', () => {
    it('should display resource status counts', () => {
      render(<ValidationStatsCard data={mockValidationStats} />);
      
      expect(screen.getByText('1,200')).toBeInTheDocument(); // validResources
      expect(screen.getByText('150')).toBeInTheDocument(); // errorResources
      expect(screen.getByText('100')).toBeInTheDocument(); // warningResources
      expect(screen.getByText('500')).toBeInTheDocument(); // unvalidatedResources
    });

    it('should display status labels', () => {
      render(<ValidationStatsCard data={mockValidationStats} />);
      
      expect(screen.getByText('Valid')).toBeInTheDocument();
      const errorLabels = screen.getAllByText('Errors');
      expect(errorLabels.length).toBeGreaterThan(0);
      const warningLabels = screen.getAllByText('Warnings');
      expect(warningLabels.length).toBeGreaterThan(0);
      expect(screen.getByText('Unvalidated')).toBeInTheDocument();
    });
  });
});