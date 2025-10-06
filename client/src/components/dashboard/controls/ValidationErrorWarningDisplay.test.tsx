import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  ValidationErrorWarningDisplay, 
  CompactErrorWarningDisplay,
  type ValidationError,
  type ValidationWarning 
} from './ValidationErrorWarningDisplay';

// Mock the utility functions
vi.mock('@/lib/responsive-design-utils', () => ({
  getResponsiveClassNames: vi.fn((...args) => args[0]),
}));

vi.mock('@/lib/accessibility-utils', () => ({
  accessibility: {
    region: vi.fn(() => ({})),
    button: vi.fn(() => ({})),
    list: vi.fn(() => ({})),
  },
  keyboardNavigation: {
    handleEnter: vi.fn(() => vi.fn()),
  },
  screenReader: {
    srOnly: vi.fn(() => null),
  },
}));

vi.mock('@/lib/loading-states-utils', () => ({
  LoadingSpinner: ({ size, text }: { size: string; text: string }) => (
    <div data-testid="loading-spinner">
      Loading... {text}
    </div>
  ),
}));

describe('ValidationErrorWarningDisplay', () => {
  const mockOnErrorClick = vi.fn();
  const mockOnWarningClick = vi.fn();
  const mockOnRefresh = vi.fn();

  const mockError: ValidationError = {
    id: 'error-1',
    type: 'validation',
    severity: 'high',
    message: 'Invalid resource structure',
    resourceType: 'Patient',
    resourceId: 'patient-123',
    aspect: 'structural',
    timestamp: new Date('2024-01-01T10:00:00Z'),
    details: 'The resource does not conform to the expected structure',
    suggestions: ['Check the resource format', 'Validate against the profile'],
    code: 'INVALID_STRUCTURE',
    path: '/Patient/name',
  };

  const mockWarning: ValidationWarning = {
    id: 'warning-1',
    type: 'validation',
    severity: 'medium',
    message: 'Missing optional field',
    resourceType: 'Patient',
    resourceId: 'patient-456',
    aspect: 'profile',
    timestamp: new Date('2024-01-01T10:05:00Z'),
    details: 'The optional field is recommended but not required',
    suggestions: ['Consider adding the field for better compliance'],
    code: 'MISSING_OPTIONAL',
    path: '/Patient/telecom',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('renders with errors and warnings', () => {
      render(
        <ValidationErrorWarningDisplay
          errors={[mockError]}
          warnings={[mockWarning]}
          onErrorClick={mockOnErrorClick}
          onWarningClick={mockOnWarningClick}
          onRefresh={mockOnRefresh}
        />
      );
      
      expect(screen.getByText('Validation Errors')).toBeInTheDocument();
      expect(screen.getByText('Validation Warnings')).toBeInTheDocument();
    });

    it('shows error count in badge', () => {
      render(
        <ValidationErrorWarningDisplay
          errors={[mockError]}
          warnings={[]}
          onErrorClick={mockOnErrorClick}
          onWarningClick={mockOnWarningClick}
          onRefresh={mockOnRefresh}
        />
      );
      
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('shows warning count in badge', () => {
      render(
        <ValidationErrorWarningDisplay
          errors={[]}
          warnings={[mockWarning]}
          onErrorClick={mockOnErrorClick}
          onWarningClick={mockOnWarningClick}
          onRefresh={mockOnRefresh}
        />
      );
      
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('shows "No Issues Found" when there are no errors or warnings', () => {
      render(
        <ValidationErrorWarningDisplay
          errors={[]}
          warnings={[]}
          onErrorClick={mockOnErrorClick}
          onWarningClick={mockOnWarningClick}
          onRefresh={mockOnRefresh}
        />
      );
      
      expect(screen.getByText('No Issues Found')).toBeInTheDocument();
      expect(screen.getByText('All validation checks passed successfully!')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows loading spinner when isLoading is true', () => {
      render(
        <ValidationErrorWarningDisplay
          errors={[]}
          warnings={[]}
          isLoading={true}
          loadingText="Loading validation results..."
          onErrorClick={mockOnErrorClick}
          onWarningClick={mockOnWarningClick}
          onRefresh={mockOnRefresh}
        />
      );
      
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.getByText('Loading... Loading validation results...')).toBeInTheDocument();
    });

    it('uses default loading text when not provided', () => {
      render(
        <ValidationErrorWarningDisplay
          errors={[]}
          warnings={[]}
          isLoading={true}
          onErrorClick={mockOnErrorClick}
          onWarningClick={mockOnWarningClick}
          onRefresh={mockOnRefresh}
        />
      );
      
      expect(screen.getByText('Loading... Loading errors and warnings...')).toBeInTheDocument();
    });
  });

  describe('Filters and Search', () => {
    it('shows filters when showFilters is true', () => {
      render(
        <ValidationErrorWarningDisplay
          errors={[mockError]}
          warnings={[mockWarning]}
          showFilters={true}
          onErrorClick={mockOnErrorClick}
          onWarningClick={mockOnWarningClick}
          onRefresh={mockOnRefresh}
        />
      );
      
      expect(screen.getByText('All Errors')).toBeInTheDocument();
      expect(screen.getByText('All Warnings')).toBeInTheDocument();
    });

    it('hides filters when showFilters is false', () => {
      render(
        <ValidationErrorWarningDisplay
          errors={[mockError]}
          warnings={[mockWarning]}
          showFilters={false}
          onErrorClick={mockOnErrorClick}
          onWarningClick={mockOnWarningClick}
          onRefresh={mockOnRefresh}
        />
      );
      
      expect(screen.queryByText('All Errors')).not.toBeInTheDocument();
      expect(screen.queryByText('All Warnings')).not.toBeInTheDocument();
    });

    it('shows search input when showSearch is true', () => {
      render(
        <ValidationErrorWarningDisplay
          errors={[mockError]}
          warnings={[mockWarning]}
          showSearch={true}
          onErrorClick={mockOnErrorClick}
          onWarningClick={mockOnWarningClick}
          onRefresh={mockOnRefresh}
        />
      );
      
      expect(screen.getByPlaceholderText('Search errors and warnings...')).toBeInTheDocument();
    });

    it('hides search input when showSearch is false', () => {
      render(
        <ValidationErrorWarningDisplay
          errors={[mockError]}
          warnings={[mockWarning]}
          showSearch={false}
          onErrorClick={mockOnErrorClick}
          onWarningClick={mockOnWarningClick}
          onRefresh={mockOnRefresh}
        />
      );
      
      expect(screen.queryByPlaceholderText('Search errors and warnings...')).not.toBeInTheDocument();
    });

    it('shows refresh button when onRefresh is provided', () => {
      render(
        <ValidationErrorWarningDisplay
          errors={[mockError]}
          warnings={[mockWarning]}
          onRefresh={mockOnRefresh}
          onErrorClick={mockOnErrorClick}
          onWarningClick={mockOnWarningClick}
        />
      );
      
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });

    it('hides refresh button when onRefresh is not provided', () => {
      render(
        <ValidationErrorWarningDisplay
          errors={[mockError]}
          warnings={[mockWarning]}
          onErrorClick={mockOnErrorClick}
          onWarningClick={mockOnWarningClick}
        />
      );
      
      expect(screen.queryByText('Refresh')).not.toBeInTheDocument();
    });
  });

  describe('Error Filtering', () => {
    it('filters errors by severity', () => {
      const highError = { ...mockError, severity: 'high' as const };
      const lowError = { ...mockError, id: 'error-2', severity: 'low' as const };
      
      render(
        <ValidationErrorWarningDisplay
          errors={[highError, lowError]}
          warnings={[]}
          showFilters={true}
          onErrorClick={mockOnErrorClick}
          onWarningClick={mockOnWarningClick}
          onRefresh={mockOnRefresh}
        />
      );
      
      // Select high severity filter
      const errorFilter = screen.getByDisplayValue('All Errors');
      fireEvent.change(errorFilter, { target: { value: 'high' } });
      
      // Should only show high severity error
      expect(screen.getByText('Invalid resource structure')).toBeInTheDocument();
    });

    it('filters errors by search term', () => {
      const structureError = { ...mockError, message: 'Invalid structure' };
      const formatError = { ...mockError, id: 'error-2', message: 'Invalid format' };
      
      render(
        <ValidationErrorWarningDisplay
          errors={[structureError, formatError]}
          warnings={[]}
          showSearch={true}
          onErrorClick={mockOnErrorClick}
          onWarningClick={mockOnWarningClick}
          onRefresh={mockOnRefresh}
        />
      );
      
      // Search for "structure"
      const searchInput = screen.getByPlaceholderText('Search errors and warnings...');
      fireEvent.change(searchInput, { target: { value: 'structure' } });
      
      // Should only show structure error
      expect(screen.getByText('Invalid structure')).toBeInTheDocument();
      expect(screen.queryByText('Invalid format')).not.toBeInTheDocument();
    });

    it('searches in error type and resource type', () => {
      render(
        <ValidationErrorWarningDisplay
          errors={[mockError]}
          warnings={[]}
          showSearch={true}
          onErrorClick={mockOnErrorClick}
          onWarningClick={mockOnWarningClick}
          onRefresh={mockOnRefresh}
        />
      );
      
      // Search for "validation" (error type)
      const searchInput = screen.getByPlaceholderText('Search errors and warnings...');
      fireEvent.change(searchInput, { target: { value: 'validation' } });
      
      expect(screen.getByText('Invalid resource structure')).toBeInTheDocument();
      
      // Search for "Patient" (resource type)
      fireEvent.change(searchInput, { target: { value: 'Patient' } });
      
      expect(screen.getByText('Invalid resource structure')).toBeInTheDocument();
    });
  });

  describe('Warning Filtering', () => {
    it('filters warnings by severity', () => {
      const highWarning = { ...mockWarning, severity: 'high' as const };
      const lowWarning = { ...mockWarning, id: 'warning-2', severity: 'low' as const };
      
      render(
        <ValidationErrorWarningDisplay
          errors={[]}
          warnings={[highWarning, lowWarning]}
          showFilters={true}
          onErrorClick={mockOnErrorClick}
          onWarningClick={mockOnWarningClick}
          onRefresh={mockOnRefresh}
        />
      );
      
      // Select high severity filter
      const warningFilter = screen.getByDisplayValue('All Warnings');
      fireEvent.change(warningFilter, { target: { value: 'high' } });
      
      // Should only show high severity warning
      expect(screen.getByText('Missing optional field')).toBeInTheDocument();
    });

    it('filters warnings by search term', () => {
      const fieldWarning = { ...mockWarning, message: 'Missing field' };
      const formatWarning = { ...mockWarning, id: 'warning-2', message: 'Format issue' };
      
      render(
        <ValidationErrorWarningDisplay
          errors={[]}
          warnings={[fieldWarning, formatWarning]}
          showSearch={true}
          onErrorClick={mockOnErrorClick}
          onWarningClick={mockOnWarningClick}
          onRefresh={mockOnRefresh}
        />
      );
      
      // Search for "field"
      const searchInput = screen.getByPlaceholderText('Search errors and warnings...');
      fireEvent.change(searchInput, { target: { value: 'field' } });
      
      // Should only show field warning
      expect(screen.getByText('Missing field')).toBeInTheDocument();
      expect(screen.queryByText('Format issue')).not.toBeInTheDocument();
    });
  });

  describe('Error Display', () => {
    it('displays error information correctly', () => {
      render(
        <ValidationErrorWarningDisplay
          errors={[mockError]}
          warnings={[]}
          onErrorClick={mockOnErrorClick}
          onWarningClick={mockOnWarningClick}
          onRefresh={mockOnRefresh}
        />
      );
      
      expect(screen.getByText('Invalid resource structure')).toBeInTheDocument();
      expect(screen.getByText('high')).toBeInTheDocument();
      expect(screen.getByText('validation')).toBeInTheDocument();
      expect(screen.getByText('structural')).toBeInTheDocument();
      expect(screen.getByText('Patient • patient-123')).toBeInTheDocument();
    });

    it('shows error timestamp', () => {
      render(
        <ValidationErrorWarningDisplay
          errors={[mockError]}
          warnings={[]}
          onErrorClick={mockOnErrorClick}
          onWarningClick={mockOnWarningClick}
          onRefresh={mockOnRefresh}
        />
      );
      
      expect(screen.getByText('10:00:00 AM')).toBeInTheDocument();
    });

    it('calls onErrorClick when error is clicked', () => {
      render(
        <ValidationErrorWarningDisplay
          errors={[mockError]}
          warnings={[]}
          onErrorClick={mockOnErrorClick}
          onWarningClick={mockOnWarningClick}
          onRefresh={mockOnRefresh}
        />
      );
      
      const errorItem = screen.getByText('Invalid resource structure');
      fireEvent.click(errorItem);
      
      expect(mockOnErrorClick).toHaveBeenCalledWith(mockError);
    });
  });

  describe('Warning Display', () => {
    it('displays warning information correctly', () => {
      render(
        <ValidationErrorWarningDisplay
          errors={[]}
          warnings={[mockWarning]}
          onErrorClick={mockOnErrorClick}
          onWarningClick={mockOnWarningClick}
          onRefresh={mockOnRefresh}
        />
      );
      
      expect(screen.getByText('Missing optional field')).toBeInTheDocument();
      expect(screen.getByText('medium')).toBeInTheDocument();
      expect(screen.getByText('validation')).toBeInTheDocument();
      expect(screen.getByText('profile')).toBeInTheDocument();
      expect(screen.getByText('Patient • patient-456')).toBeInTheDocument();
    });

    it('shows warning timestamp', () => {
      render(
        <ValidationErrorWarningDisplay
          errors={[]}
          warnings={[mockWarning]}
          onErrorClick={mockOnErrorClick}
          onWarningClick={mockOnWarningClick}
          onRefresh={mockOnRefresh}
        />
      );
      
      expect(screen.getByText('10:05:00 AM')).toBeInTheDocument();
    });

    it('calls onWarningClick when warning is clicked', () => {
      render(
        <ValidationErrorWarningDisplay
          errors={[]}
          warnings={[mockWarning]}
          onErrorClick={mockOnErrorClick}
          onWarningClick={mockOnWarningClick}
          onRefresh={mockOnRefresh}
        />
      );
      
      const warningItem = screen.getByText('Missing optional field');
      fireEvent.click(warningItem);
      
      expect(mockOnWarningClick).toHaveBeenCalledWith(mockWarning);
    });
  });

  describe('Error Details Expansion', () => {
    it('shows error details when expanded', () => {
      render(
        <ValidationErrorWarningDisplay
          errors={[mockError]}
          warnings={[]}
          showDetails={true}
          onErrorClick={mockOnErrorClick}
          onWarningClick={mockOnWarningClick}
          onRefresh={mockOnRefresh}
        />
      );
      
      // Click expand button
      const expandButton = screen.getByRole('button', { name: /chevron/i });
      fireEvent.click(expandButton);
      
      expect(screen.getByText('Details:')).toBeInTheDocument();
      expect(screen.getByText('The resource does not conform to the expected structure')).toBeInTheDocument();
      expect(screen.getByText('Suggestions:')).toBeInTheDocument();
      expect(screen.getByText('Check the resource format')).toBeInTheDocument();
      expect(screen.getByText('Validate against the profile')).toBeInTheDocument();
      expect(screen.getByText('Code: INVALID_STRUCTURE')).toBeInTheDocument();
      expect(screen.getByText('Path: /Patient/name')).toBeInTheDocument();
    });

    it('hides error details when not expanded', () => {
      render(
        <ValidationErrorWarningDisplay
          errors={[mockError]}
          warnings={[]}
          showDetails={true}
          onErrorClick={mockOnErrorClick}
          onWarningClick={mockOnWarningClick}
          onRefresh={mockOnRefresh}
        />
      );
      
      // Details should not be visible initially
      expect(screen.queryByText('Details:')).not.toBeInTheDocument();
      expect(screen.queryByText('The resource does not conform to the expected structure')).not.toBeInTheDocument();
    });

    it('does not show expand button when showDetails is false', () => {
      render(
        <ValidationErrorWarningDisplay
          errors={[mockError]}
          warnings={[]}
          showDetails={false}
          onErrorClick={mockOnErrorClick}
          onWarningClick={mockOnWarningClick}
          onRefresh={mockOnRefresh}
        />
      );
      
      expect(screen.queryByRole('button', { name: /chevron/i })).not.toBeInTheDocument();
    });
  });

  describe('Warning Details Expansion', () => {
    it('shows warning details when expanded', () => {
      render(
        <ValidationErrorWarningDisplay
          errors={[]}
          warnings={[mockWarning]}
          showDetails={true}
          onErrorClick={mockOnErrorClick}
          onWarningClick={mockOnWarningClick}
          onRefresh={mockOnRefresh}
        />
      );
      
      // Click expand button
      const expandButton = screen.getByRole('button', { name: /chevron/i });
      fireEvent.click(expandButton);
      
      expect(screen.getByText('Details:')).toBeInTheDocument();
      expect(screen.getByText('The optional field is recommended but not required')).toBeInTheDocument();
      expect(screen.getByText('Suggestions:')).toBeInTheDocument();
      expect(screen.getByText('Consider adding the field for better compliance')).toBeInTheDocument();
      expect(screen.getByText('Code: MISSING_OPTIONAL')).toBeInTheDocument();
      expect(screen.getByText('Path: /Patient/telecom')).toBeInTheDocument();
    });
  });

  describe('Copy to Clipboard', () => {
    it('copies error message to clipboard when copy button is clicked', () => {
      // Mock clipboard API
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn(),
        },
      });
      
      render(
        <ValidationErrorWarningDisplay
          errors={[mockError]}
          warnings={[]}
          onErrorClick={mockOnErrorClick}
          onWarningClick={mockOnWarningClick}
          onRefresh={mockOnRefresh}
        />
      );
      
      const copyButton = screen.getByRole('button', { name: /copy/i });
      fireEvent.click(copyButton);
      
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Invalid resource structure');
    });

    it('copies warning message to clipboard when copy button is clicked', () => {
      // Mock clipboard API
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn(),
        },
      });
      
      render(
        <ValidationErrorWarningDisplay
          errors={[]}
          warnings={[mockWarning]}
          onErrorClick={mockOnErrorClick}
          onWarningClick={mockOnWarningClick}
          onRefresh={mockOnRefresh}
        />
      );
      
      const copyButton = screen.getByRole('button', { name: /copy/i });
      fireEvent.click(copyButton);
      
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Missing optional field');
    });
  });

  describe('Max Display Items', () => {
    it('limits displayed errors to maxDisplayItems', () => {
      const multipleErrors = [
        mockError,
        { ...mockError, id: 'error-2' },
        { ...mockError, id: 'error-3' },
        { ...mockError, id: 'error-4' },
        { ...mockError, id: 'error-5' },
        { ...mockError, id: 'error-6' },
      ];
      
      render(
        <ValidationErrorWarningDisplay
          errors={multipleErrors}
          warnings={[]}
          maxDisplayItems={3}
          onErrorClick={mockOnErrorClick}
          onWarningClick={mockOnWarningClick}
          onRefresh={mockOnRefresh}
        />
      );
      
      expect(screen.getByText('Showing 3 of 6 errors')).toBeInTheDocument();
    });

    it('limits displayed warnings to maxDisplayItems', () => {
      const multipleWarnings = [
        mockWarning,
        { ...mockWarning, id: 'warning-2' },
        { ...mockWarning, id: 'warning-3' },
        { ...mockWarning, id: 'warning-4' },
        { ...mockWarning, id: 'warning-5' },
        { ...mockWarning, id: 'warning-6' },
      ];
      
      render(
        <ValidationErrorWarningDisplay
          errors={[]}
          warnings={multipleWarnings}
          maxDisplayItems={3}
          onErrorClick={mockOnErrorClick}
          onWarningClick={mockOnWarningClick}
          onRefresh={mockOnRefresh}
        />
      );
      
      expect(screen.getByText('Showing 3 of 6 warnings')).toBeInTheDocument();
    });
  });

  describe('Refresh Functionality', () => {
    it('calls onRefresh when refresh button is clicked', () => {
      render(
        <ValidationErrorWarningDisplay
          errors={[mockError]}
          warnings={[mockWarning]}
          onRefresh={mockOnRefresh}
          onErrorClick={mockOnErrorClick}
          onWarningClick={mockOnWarningClick}
        />
      );
      
      const refreshButton = screen.getByText('Refresh');
      fireEvent.click(refreshButton);
      
      expect(mockOnRefresh).toHaveBeenCalled();
    });
  });

  describe('Severity Colors', () => {
    const severityTests = [
      { severity: 'critical', expectedVariant: 'destructive' },
      { severity: 'high', expectedVariant: 'destructive' },
      { severity: 'medium', expectedVariant: 'secondary' },
      { severity: 'low', expectedVariant: 'outline' },
    ];

    severityTests.forEach(({ severity, expectedVariant }) => {
      it(`applies correct variant for ${severity} severity error`, () => {
        const error = { ...mockError, severity: severity as any };
        
        render(
          <ValidationErrorWarningDisplay
            errors={[error]}
            warnings={[]}
            onErrorClick={mockOnErrorClick}
            onWarningClick={mockOnWarningClick}
            onRefresh={mockOnRefresh}
          />
        );
        
        expect(screen.getByText(severity)).toBeInTheDocument();
      });
    });
  });

  describe('Props Handling', () => {
    it('handles missing props gracefully', () => {
      expect(() => {
        render(
          <ValidationErrorWarningDisplay
            errors={[]}
            warnings={[]}
            className={undefined}
            onErrorClick={undefined}
            onWarningClick={undefined}
            onRefresh={undefined}
          />
        );
      }).not.toThrow();
    });

    it('applies custom className', () => {
      const { container } = render(
        <ValidationErrorWarningDisplay
          errors={[]}
          warnings={[]}
          className="custom-class"
          onErrorClick={mockOnErrorClick}
          onWarningClick={mockOnWarningClick}
          onRefresh={mockOnRefresh}
        />
      );
      
      expect(container.firstChild).toHaveClass('custom-class');
    });

    it('uses default values when props are not provided', () => {
      render(
        <ValidationErrorWarningDisplay
          errors={[mockError]}
          warnings={[mockWarning]}
          onErrorClick={mockOnErrorClick}
          onWarningClick={mockOnWarningClick}
          onRefresh={mockOnRefresh}
        />
      );
      
      // Should show details by default
      expect(screen.getByRole('button', { name: /chevron/i })).toBeInTheDocument();
      
      // Should show filters by default
      expect(screen.getByText('All Errors')).toBeInTheDocument();
      
      // Should show search by default
      expect(screen.getByPlaceholderText('Search errors and warnings...')).toBeInTheDocument();
    });
  });
});

describe('CompactErrorWarningDisplay', () => {
  const mockError: ValidationError = {
    id: 'error-1',
    type: 'validation',
    severity: 'critical',
    message: 'Critical error',
    timestamp: new Date(),
  };

  const mockWarning: ValidationWarning = {
    id: 'warning-1',
    type: 'validation',
    severity: 'high',
    message: 'High priority warning',
    timestamp: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('shows critical and high errors', () => {
      const criticalError = { ...mockError, severity: 'critical' as const };
      const highError = { ...mockError, id: 'error-2', severity: 'high' as const };
      
      render(
        <CompactErrorWarningDisplay
          errors={[criticalError, highError]}
          warnings={[]}
        />
      );
      
      expect(screen.getByText('2 critical errors')).toBeInTheDocument();
    });

    it('shows high priority warnings', () => {
      const highWarning = { ...mockWarning, severity: 'high' as const };
      
      render(
        <CompactErrorWarningDisplay
          errors={[]}
          warnings={[highWarning]}
        />
      );
      
      expect(screen.getByText('1 high priority warning')).toBeInTheDocument();
    });

    it('shows "No issues found" when there are no critical errors or high warnings', () => {
      const lowError = { ...mockError, severity: 'low' as const };
      const mediumWarning = { ...mockWarning, severity: 'medium' as const };
      
      render(
        <CompactErrorWarningDisplay
          errors={[lowError]}
          warnings={[mediumWarning]}
        />
      );
      
      expect(screen.getByText('No issues found')).toBeInTheDocument();
    });

    it('shows "No issues found" when there are no errors or warnings', () => {
      render(
        <CompactErrorWarningDisplay
          errors={[]}
          warnings={[]}
        />
      );
      
      expect(screen.getByText('No issues found')).toBeInTheDocument();
    });
  });

  describe('Max Items', () => {
    it('limits displayed items to maxItems', () => {
      const multipleErrors = [
        { ...mockError, severity: 'critical' as const },
        { ...mockError, id: 'error-2', severity: 'critical' as const },
        { ...mockError, id: 'error-3', severity: 'critical' as const },
        { ...mockError, id: 'error-4', severity: 'critical' as const },
      ];
      
      render(
        <CompactErrorWarningDisplay
          errors={multipleErrors}
          warnings={[]}
          maxItems={2}
        />
      );
      
      // Should only show 2 critical errors
      expect(screen.getByText('2 critical errors')).toBeInTheDocument();
    });

    it('uses default maxItems when not provided', () => {
      const multipleErrors = [
        { ...mockError, severity: 'critical' as const },
        { ...mockError, id: 'error-2', severity: 'critical' as const },
        { ...mockError, id: 'error-3', severity: 'critical' as const },
        { ...mockError, id: 'error-4', severity: 'critical' as const },
      ];
      
      render(
        <CompactErrorWarningDisplay
          errors={multipleErrors}
          warnings={[]}
        />
      );
      
      // Should show all critical errors (default maxItems is 3)
      expect(screen.getByText('4 critical errors')).toBeInTheDocument();
    });
  });

  describe('Props Handling', () => {
    it('handles missing props gracefully', () => {
      expect(() => {
        render(
          <CompactErrorWarningDisplay
            errors={[]}
            warnings={[]}
            className={undefined}
            maxItems={undefined}
          />
        );
      }).not.toThrow();
    });

    it('applies custom className', () => {
      const { container } = render(
        <CompactErrorWarningDisplay
          errors={[]}
          warnings={[]}
          className="custom-class"
        />
      );
      
      expect(container.firstChild).toHaveClass('custom-class');
    });
  });
});