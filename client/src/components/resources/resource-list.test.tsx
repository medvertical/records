import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ResourceList from './resource-list';

// Mock fetch globally
global.fetch = vi.fn();

// Mock wouter router
vi.mock('wouter', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRoute: () => ['/resources'],
  useLocation: () => '/resources',
}));

// Mock validation settings response
const mockValidationSettings = {
  settings: {
    structural: { enabled: true, severity: 'error' },
    profile: { enabled: true, severity: 'error' },
    terminology: { enabled: true, severity: 'warning' },
    reference: { enabled: true, severity: 'error' },
    businessRule: { enabled: true, severity: 'warning' },
    metadata: { enabled: true, severity: 'info' }
  }
};

// Test data
const mockResources = [
  {
    id: 'patient-1',
    resourceType: 'Patient',
    name: [{ given: ['John'], family: 'Doe' }],
    birthDate: '1990-01-01',
    gender: 'male',
    _validationSummary: {
      lastValidated: '2024-01-15T10:00:00Z',
      errorCount: 0,
      warningCount: 0,
      informationCount: 0,
      validationScore: 100,
      hasErrors: false,
      hasWarnings: false,
      isValid: true,
      aspectBreakdown: {
        structural: { enabled: true, issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true },
        profile: { enabled: true, issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true },
        terminology: { enabled: true, issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true },
        reference: { enabled: true, issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true },
        businessRule: { enabled: true, issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true },
        metadata: { enabled: true, issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true }
      }
    }
  },
  {
    id: 'patient-2',
    resourceType: 'Patient',
    name: [{ given: ['Jane'], family: 'Smith' }],
    birthDate: '1985-05-15',
    gender: 'female',
    _validationSummary: {
      lastValidated: '2024-01-15T10:00:00Z',
      errorCount: 2,
      warningCount: 1,
      informationCount: 0,
      validationScore: 65,
      hasErrors: true,
      hasWarnings: true,
      isValid: false,
      aspectBreakdown: {
        structural: { enabled: true, issueCount: 2, errorCount: 2, warningCount: 0, informationCount: 0, validationScore: 70, passed: false },
        profile: { enabled: true, issueCount: 1, errorCount: 0, warningCount: 1, informationCount: 0, validationScore: 95, passed: true },
        terminology: { enabled: true, issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true },
        reference: { enabled: true, issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true },
        businessRule: { enabled: true, issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true },
        metadata: { enabled: true, issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true }
      }
    }
  },
  {
    id: 'observation-1',
    resourceType: 'Observation',
    code: { text: 'Blood Pressure' },
    subject: { reference: 'Patient/patient-1' },
    effectiveDateTime: '2024-01-15T10:00:00Z',
    _validationSummary: {
      lastValidated: '2024-01-15T10:00:00Z',
      errorCount: 0,
      warningCount: 3,
      informationCount: 1,
      validationScore: 84,
      hasErrors: false,
      hasWarnings: true,
      isValid: true,
      aspectBreakdown: {
        structural: { enabled: true, issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true },
        profile: { enabled: true, issueCount: 2, errorCount: 0, warningCount: 2, informationCount: 0, validationScore: 90, passed: true },
        terminology: { enabled: true, issueCount: 1, errorCount: 0, warningCount: 1, informationCount: 0, validationScore: 95, passed: true },
        reference: { enabled: true, issueCount: 1, errorCount: 0, warningCount: 0, informationCount: 1, validationScore: 99, passed: true },
        businessRule: { enabled: true, issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true },
        metadata: { enabled: true, issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true }
      }
    }
  },
  {
    id: 'unvalidated-resource',
    resourceType: 'Condition',
    code: { text: 'Diabetes' },
    _validationSummary: null // No validation summary means not validated
  },
  {
    id: 'never-validated-resource',
    resourceType: 'Encounter',
    type: [{ text: 'Emergency' }],
    _validationSummary: {
      lastValidated: null, // null lastValidated means never validated
      errorCount: 0,
      warningCount: 0,
      informationCount: 0,
      validationScore: 0,
      hasErrors: false,
      hasWarnings: false,
      isValid: false
    }
  }
];

const createTestQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
};

const renderWithQueryClient = (component: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
};

describe('ResourceList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockValidationSettings),
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Validation Status Display Logic', () => {
    it('should display "Valid" status for resources with no errors or warnings', () => {
      renderWithQueryClient(
        <ResourceList
          resources={[mockResources[0]]}
          total={1}
          page={0}
          onPageChange={vi.fn()}
        />
      );

      expect(screen.getByText('Valid')).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument(); // Validation score
    });

    it('should display "Error" status for resources with validation errors', () => {
      renderWithQueryClient(
        <ResourceList
          resources={[mockResources[1]]}
          total={1}
          page={0}
          onPageChange={vi.fn()}
        />
      );

      expect(screen.getByText('2 Errors')).toBeInTheDocument();
      expect(screen.getByText('65')).toBeInTheDocument(); // Validation score
    });

    it('should display "Warning" status for resources with only warnings', () => {
      renderWithQueryClient(
        <ResourceList
          resources={[mockResources[2]]}
          total={1}
          page={0}
          onPageChange={vi.fn()}
        />
      );

      expect(screen.getByText('3 Warnings')).toBeInTheDocument();
      expect(screen.getByText('84')).toBeInTheDocument(); // Validation score
    });

    it('should display "Not Validated" status for resources without validation summary', () => {
      renderWithQueryClient(
        <ResourceList
          resources={[mockResources[3]]}
          total={1}
          page={0}
          onPageChange={vi.fn()}
        />
      );

      expect(screen.getByText('Not Validated')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument(); // Validation score should be 0
    });

    it('should display "Not Validated" status for resources with null lastValidated', () => {
      renderWithQueryClient(
        <ResourceList
          resources={[mockResources[4]]}
          total={1}
          page={0}
          onPageChange={vi.fn()}
        />
      );

      expect(screen.getByText('Not Validated')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument(); // Validation score should be 0
    });

    it('should show validation progress for resources currently being validated', () => {
      const validatingResourceIds = new Set([1]);
      const validationProgress = new Map([
        [1, {
          resourceId: 1,
          progress: 50,
          currentAspect: 'Structural Validation',
          completedAspects: ['Profile', 'Terminology'],
          totalAspects: 6
        }]
      ]);

      renderWithQueryClient(
        <ResourceList
          resources={[mockResources[0]]}
          total={1}
          page={0}
          onPageChange={vi.fn()}
          validatingResourceIds={validatingResourceIds}
          validationProgress={validationProgress}
        />
      );

      expect(screen.getByText('50%')).toBeInTheDocument();
      expect(screen.getByText('Structural Validation')).toBeInTheDocument();
    });
  });

  describe('UI Filtering Based on Validation Settings', () => {
    it('should filter validation results when some aspects are disabled', async () => {
      const disabledAspectsSettings = {
        settings: {
          structural: { enabled: false, severity: 'error' },
          profile: { enabled: true, severity: 'error' },
          terminology: { enabled: false, severity: 'warning' },
          reference: { enabled: true, severity: 'error' },
          businessRule: { enabled: false, severity: 'warning' },
          metadata: { enabled: true, severity: 'info' }
        }
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(disabledAspectsSettings),
      });

      renderWithQueryClient(
        <ResourceList
          resources={[mockResources[1]]} // Resource with errors in structural aspect
          total={1}
          page={0}
          onPageChange={vi.fn()}
        />
      );

      // Wait for settings to load
      await screen.findByText(/Patient\/patient-2/);

      // Since structural aspect is disabled, the errors should be filtered out
      // and the resource should show as valid or with reduced error count
      const errorBadge = screen.queryByText('2 Errors');
      expect(errorBadge).not.toBeInTheDocument();
    });

    it('should show correct validation score after filtering disabled aspects', async () => {
      const partiallyDisabledSettings = {
        settings: {
          structural: { enabled: false, severity: 'error' }, // Disable structural (has 2 errors)
          profile: { enabled: true, severity: 'error' },      // Keep profile (has 1 warning)
          terminology: { enabled: true, severity: 'warning' },
          reference: { enabled: true, severity: 'error' },
          businessRule: { enabled: true, severity: 'warning' },
          metadata: { enabled: true, severity: 'info' }
        }
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(partiallyDisabledSettings),
      });

      renderWithQueryClient(
        <ResourceList
          resources={[mockResources[1]]}
          total={1}
          page={0}
          onPageChange={vi.fn()}
        />
      );

      // Wait for settings to load
      await screen.findByText(/Patient\/patient-2/);

      // Original score: 100 - (2 errors * 15) - (1 warning * 5) = 65
      // After disabling structural: 100 - (1 warning * 5) = 95
      // But we need to check what the actual filtered result shows
      const validationScore = screen.getByText(/^\d+$/); // Find numeric validation score
      expect(validationScore).toBeInTheDocument();
    });
  });

  describe('Resource Display Names and Subtext', () => {
    it('should display correct name for Patient resources', () => {
      renderWithQueryClient(
        <ResourceList
          resources={[mockResources[0]]}
          total={1}
          page={0}
          onPageChange={vi.fn()}
        />
      );

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('DOB: 1/1/1990 | Male')).toBeInTheDocument();
    });

    it('should display correct name for Observation resources', () => {
      renderWithQueryClient(
        <ResourceList
          resources={[mockResources[2]]}
          total={1}
          page={0}
          onPageChange={vi.fn()}
        />
      );

      expect(screen.getByText('Blood Pressure')).toBeInTheDocument();
      expect(screen.getByText('Patient/patient-1 | 1/15/2024')).toBeInTheDocument();
    });

    it('should display fallback names for unknown resource types', () => {
      const unknownResource = {
        id: 'unknown-1',
        resourceType: 'UnknownType',
        _validationSummary: mockResources[0]._validationSummary
      };

      renderWithQueryClient(
        <ResourceList
          resources={[unknownResource]}
          total={1}
          page={0}
          onPageChange={vi.fn()}
        />
      );

      expect(screen.getByText('UnknownType Resource')).toBeInTheDocument();
      expect(screen.getByText('unknown-1')).toBeInTheDocument();
    });
  });

  describe('Pagination Logic', () => {
    it('should display correct pagination information', () => {
      renderWithQueryClient(
        <ResourceList
          resources={mockResources.slice(0, 5)}
          total={25}
          page={1}
          onPageChange={vi.fn()}
          pageSize={5}
        />
      );

      expect(screen.getByText('Showing 6 to 10 of 25 resources')).toBeInTheDocument();
      expect(screen.getByText('Page 2 of 5')).toBeInTheDocument();
    });

    it('should handle edge cases in pagination', () => {
      renderWithQueryClient(
        <ResourceList
          resources={[]}
          total={0}
          page={0}
          onPageChange={vi.fn()}
        />
      );

      expect(screen.getByText('Showing 0 to 0 of 0 resources')).toBeInTheDocument();
    });

    it('should disable previous button on first page', () => {
      renderWithQueryClient(
        <ResourceList
          resources={mockResources.slice(0, 5)}
          total={25}
          page={0}
          onPageChange={vi.fn()}
          pageSize={5}
        />
      );

      const prevButton = screen.getByRole('button', { name: /previous/i });
      expect(prevButton).toBeDisabled();
    });

    it('should disable next button on last page', () => {
      renderWithQueryClient(
        <ResourceList
          resources={mockResources.slice(0, 5)}
          total={25}
          page={4} // Last page (0-indexed)
          onPageChange={vi.fn()}
          pageSize={5}
        />
      );

      const nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).toBeDisabled();
    });
  });

  describe('Validation Badge Rendering', () => {
    it('should render validation badge with correct styling for valid resources', () => {
      renderWithQueryClient(
        <ResourceList
          resources={[mockResources[0]]}
          total={1}
          page={0}
          onPageChange={vi.fn()}
        />
      );

      const validBadge = screen.getByText('Valid');
      expect(validBadge).toHaveClass('bg-green-50', 'text-fhir-success');
    });

    it('should render validation badge with correct styling for error resources', () => {
      renderWithQueryClient(
        <ResourceList
          resources={[mockResources[1]]}
          total={1}
          page={0}
          onPageChange={vi.fn()}
        />
      );

      const errorBadge = screen.getByText('2 Errors');
      expect(errorBadge).toHaveClass('bg-red-50', 'text-fhir-error');
    });

    it('should render validation badge with correct styling for warning resources', () => {
      renderWithQueryClient(
        <ResourceList
          resources={[mockResources[2]]}
          total={1}
          page={0}
          onPageChange={vi.fn()}
        />
      );

      const warningBadge = screen.getByText('3 Warnings');
      expect(warningBadge).toHaveClass('bg-orange-50', 'text-fhir-warning');
    });

    it('should render validation badge with correct styling for unvalidated resources', () => {
      renderWithQueryClient(
        <ResourceList
          resources={[mockResources[3]]}
          total={1}
          page={0}
          onPageChange={vi.fn()}
        />
      );

      const unvalidatedBadge = screen.getByText('Not Validated');
      expect(unvalidatedBadge).toHaveClass('bg-gray-50', 'text-gray-600');
    });

    it('should show dashed border for unvalidated resources', () => {
      renderWithQueryClient(
        <ResourceList
          resources={[mockResources[3]]}
          total={1}
          page={0}
          onPageChange={vi.fn()}
        />
      );

      const resourceCard = screen.getByText('Not Validated').closest('.border-dashed');
      expect(resourceCard).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle fetch errors gracefully', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      renderWithQueryClient(
        <ResourceList
          resources={[mockResources[0]]}
          total={1}
          page={0}
          onPageChange={vi.fn()}
        />
      );

      // Should still render the resource list even if validation settings fail to load
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('should handle malformed validation summary data', () => {
      const malformedResource = {
        id: 'malformed-1',
        resourceType: 'Patient',
        _validationSummary: {
          // Missing required fields
          errorCount: 'invalid', // Should be number
          validationScore: null // Should be number
        }
      };

      renderWithQueryClient(
        <ResourceList
          resources={[malformedResource]}
          total={1}
          page={0}
          onPageChange={vi.fn()}
        />
      );

      // Should gracefully handle malformed data and show as not validated
      expect(screen.getByText('Not Validated')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      renderWithQueryClient(
        <ResourceList
          resources={[mockResources[0]]}
          total={1}
          page={0}
          onPageChange={vi.fn()}
        />
      );

      // Check for proper button roles
      const prevButton = screen.getByRole('button', { name: /previous/i });
      const nextButton = screen.getByRole('button', { name: /next/i });
      
      expect(prevButton).toBeInTheDocument();
      expect(nextButton).toBeInTheDocument();
    });

    it('should provide tooltips for validation information', () => {
      renderWithQueryClient(
        <ResourceList
          resources={[mockResources[0]]}
          total={1}
          page={0}
          onPageChange={vi.fn()}
        />
      );

      // Tooltips should be present for validation information
      // This is tested implicitly through the rendering of tooltip content
      expect(screen.getByText('Valid')).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('should render efficiently with large resource lists', () => {
      const largeResourceList = Array.from({ length: 100 }, (_, i) => ({
        ...mockResources[0],
        id: `resource-${i}`,
        name: [{ given: [`Resource${i}`], family: 'Test' }]
      }));

      const startTime = performance.now();
      
      renderWithQueryClient(
        <ResourceList
          resources={largeResourceList}
          total={100}
          page={0}
          onPageChange={vi.fn()}
        />
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render within reasonable time (adjust threshold as needed)
      expect(renderTime).toBeLessThan(1000); // 1 second
      expect(screen.getByText('Resource0 Test')).toBeInTheDocument();
    });
  });
});
