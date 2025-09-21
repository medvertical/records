/**
 * Unit Tests for Validation Results Retry Indicators
 * 
 * Tests the retry information display in the ValidationResults component.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ValidationResults } from './validation-results';

describe('ValidationResults - Retry Indicators', () => {
  const mockValidationResult = {
    isValid: false,
    resourceType: 'Patient',
    resourceId: 'test-patient-123',
    issues: [
      {
        severity: 'error' as const,
        code: 'validation-error',
        details: 'Test validation error',
        location: ['name', 'family'],
        humanReadable: 'Family name is required',
        category: 'structure' as const,
      },
    ],
    summary: {
      totalIssues: 1,
      errorCount: 1,
      warningCount: 0,
      informationCount: 0,
      fatalCount: 0,
      score: 50,
    },
    validatedAt: new Date('2023-10-26T10:00:00Z'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Retry Information Display', () => {
    it('should display retry information when retryInfo is provided', () => {
      const resultWithRetry = {
        ...mockValidationResult,
        retryInfo: {
          attemptCount: 3,
          maxAttempts: 2,
          isRetry: true,
          previousAttempts: [
            {
              attemptNumber: 1,
              attemptedAt: new Date('2023-10-26T09:58:00Z'),
              success: false,
              errorMessage: 'Network timeout',
              durationMs: 5000,
              resultSummary: {
                isValid: false,
                errorCount: 1,
                warningCount: 0,
                validationScore: 0,
              },
            },
            {
              attemptNumber: 2,
              attemptedAt: new Date('2023-10-26T09:59:00Z'),
              success: false,
              errorMessage: 'Validation service unavailable',
              durationMs: 3000,
              resultSummary: {
                isValid: false,
                errorCount: 2,
                warningCount: 1,
                validationScore: 30,
              },
            },
            {
              attemptNumber: 3,
              attemptedAt: new Date('2023-10-26T10:00:00Z'),
              success: true,
              durationMs: 2000,
              resultSummary: {
                isValid: true,
                errorCount: 0,
                warningCount: 0,
                validationScore: 100,
              },
            },
          ],
          totalRetryDurationMs: 10000,
          canRetry: false,
          retryReason: 'Previous validation attempts failed',
        },
      };

      render(<ValidationResults result={resultWithRetry} />);

      // Check retry information header
      expect(screen.getByText('Validation Retry Information')).toBeInTheDocument();
      
      // Check retry badge
      expect(screen.getByText('Retry #3')).toBeInTheDocument();
      
      // Check retry statistics
      expect(screen.getByText('3/2')).toBeInTheDocument(); // attemptCount/maxAttempts
      expect(screen.getByText('10000ms')).toBeInTheDocument(); // totalRetryDurationMs
      expect(screen.getByText('Max Retries Reached')).toBeInTheDocument(); // canRetry status
      expect(screen.getByText('3')).toBeInTheDocument(); // previousAttempts.length
      
      // Check retry reason
      expect(screen.getByText('Reason: Previous validation attempts failed')).toBeInTheDocument();
    });

    it('should not display retry information when retryInfo is not provided', () => {
      render(<ValidationResults result={mockValidationResult} />);

      expect(screen.queryByText('Validation Retry Information')).not.toBeInTheDocument();
      expect(screen.queryByText('Retry #')).not.toBeInTheDocument();
    });

    it('should display correct retry status when retries are still possible', () => {
      const resultWithRetry = {
        ...mockValidationResult,
        retryInfo: {
          attemptCount: 1,
          maxAttempts: 3,
          isRetry: true,
          previousAttempts: [
            {
              attemptNumber: 1,
              attemptedAt: new Date('2023-10-26T09:58:00Z'),
              success: false,
              errorMessage: 'Temporary network error',
              durationMs: 2000,
            },
          ],
          totalRetryDurationMs: 2000,
          canRetry: true,
          retryReason: 'Network connectivity issue',
        },
      };

      render(<ValidationResults result={resultWithRetry} />);

      expect(screen.getByText('Can Retry')).toBeInTheDocument();
      expect(screen.getByText('Reason: Network connectivity issue')).toBeInTheDocument();
    });

    it('should display previous attempts when available', () => {
      const resultWithRetry = {
        ...mockValidationResult,
        retryInfo: {
          attemptCount: 2,
          maxAttempts: 2,
          isRetry: true,
          previousAttempts: [
            {
              attemptNumber: 1,
              attemptedAt: new Date('2023-10-26T09:58:00Z'),
              success: false,
              errorMessage: 'First attempt failed',
              durationMs: 1500,
              resultSummary: {
                isValid: false,
                errorCount: 2,
                warningCount: 1,
                validationScore: 40,
              },
            },
            {
              attemptNumber: 2,
              attemptedAt: new Date('2023-10-26T09:59:30Z'),
              success: true,
              durationMs: 800,
              resultSummary: {
                isValid: true,
                errorCount: 0,
                warningCount: 0,
                validationScore: 100,
              },
            },
          ],
          totalRetryDurationMs: 2300,
          canRetry: false,
        },
      };

      render(<ValidationResults result={resultWithRetry} />);

      // Check that the details summary is present
      expect(screen.getByText('Show Previous Attempts')).toBeInTheDocument();
      
      // Click to expand previous attempts
      const detailsElement = screen.getByText('Show Previous Attempts');
      detailsElement.click();
      
      // Check that previous attempts are displayed
      expect(screen.getByText('Attempt 1')).toBeInTheDocument();
      expect(screen.getByText('Attempt 2')).toBeInTheDocument();
      
      // Check attempt statuses
      expect(screen.getByText('Failed')).toBeInTheDocument();
      expect(screen.getByText('Success')).toBeInTheDocument();
      
      // Check attempt details
      expect(screen.getByText('Duration: 1500ms')).toBeInTheDocument();
      expect(screen.getByText('Duration: 800ms')).toBeInTheDocument();
      expect(screen.getByText('Error: First attempt failed')).toBeInTheDocument();
    });

    it('should handle empty previous attempts array', () => {
      const resultWithRetry = {
        ...mockValidationResult,
        retryInfo: {
          attemptCount: 1,
          maxAttempts: 2,
          isRetry: false,
          previousAttempts: [],
          totalRetryDurationMs: 0,
          canRetry: true,
        },
      };

      render(<ValidationResults result={resultWithRetry} />);

      expect(screen.getByText('Validation Retry Information')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument(); // previousAttempts.length
      expect(screen.queryByText('Show Previous Attempts')).not.toBeInTheDocument();
    });

    it('should display retry information without retry reason when not provided', () => {
      const resultWithRetry = {
        ...mockValidationResult,
        retryInfo: {
          attemptCount: 2,
          maxAttempts: 2,
          isRetry: true,
          previousAttempts: [
            {
              attemptNumber: 1,
              attemptedAt: new Date('2023-10-26T09:58:00Z'),
              success: false,
              errorMessage: 'Network error',
              durationMs: 1000,
            },
            {
              attemptNumber: 2,
              attemptedAt: new Date('2023-10-26T09:59:00Z'),
              success: true,
              durationMs: 500,
            },
          ],
          totalRetryDurationMs: 1500,
          canRetry: false,
          // retryReason is undefined
        },
      };

      render(<ValidationResults result={resultWithRetry} />);

      expect(screen.getByText('Validation Retry Information')).toBeInTheDocument();
      expect(screen.queryByText('Reason:')).not.toBeInTheDocument();
    });
  });

  describe('Retry Information Styling', () => {
    it('should apply correct styling for retry status indicators', () => {
      const resultWithRetry = {
        ...mockValidationResult,
        retryInfo: {
          attemptCount: 2,
          maxAttempts: 2,
          isRetry: true,
          previousAttempts: [
            {
              attemptNumber: 1,
              attemptedAt: new Date('2023-10-26T09:58:00Z'),
              success: false,
              errorMessage: 'Error',
              durationMs: 1000,
            },
            {
              attemptNumber: 2,
              attemptedAt: new Date('2023-10-26T09:59:00Z'),
              success: true,
              durationMs: 500,
            },
          ],
          totalRetryDurationMs: 1500,
          canRetry: false,
        },
      };

      render(<ValidationResults result={resultWithRetry} />);

      // Check that the retry information container has correct styling
      const retryInfoContainer = screen.getByText('Validation Retry Information').closest('div');
      expect(retryInfoContainer).toHaveClass('bg-gray-50', 'border', 'border-gray-200', 'rounded-lg', 'p-4');
    });

    it('should apply correct styling for retry badge', () => {
      const resultWithRetry = {
        ...mockValidationResult,
        retryInfo: {
          attemptCount: 3,
          maxAttempts: 2,
          isRetry: true,
          previousAttempts: [],
          totalRetryDurationMs: 1000,
          canRetry: false,
        },
      };

      render(<ValidationResults result={resultWithRetry} />);

      const retryBadge = screen.getByText('Retry #3');
      expect(retryBadge).toHaveClass('ml-2'); // Badge should have margin-left
    });
  });

  describe('Retry Information Integration', () => {
    it('should display retry information alongside validation status', () => {
      const resultWithRetry = {
        ...mockValidationResult,
        retryInfo: {
          attemptCount: 2,
          maxAttempts: 2,
          isRetry: true,
          previousAttempts: [],
          totalRetryDurationMs: 2000,
          canRetry: false,
        },
      };

      render(<ValidationResults result={resultWithRetry} />);

      // Check that both retry information and validation status are displayed
      expect(screen.getByText('Validation Retry Information')).toBeInTheDocument();
      expect(screen.getByText('Validation Summary')).toBeInTheDocument();
      
      // Check that validation status shows the resource is invalid
      expect(screen.getByText('This resource has validation issues that need to be addressed')).toBeInTheDocument();
    });

    it('should handle retry information with successful validation', () => {
      const resultWithRetry = {
        ...mockValidationResult,
        isValid: true,
        issues: [],
        summary: {
          totalIssues: 0,
          errorCount: 0,
          warningCount: 0,
          informationCount: 0,
          fatalCount: 0,
          score: 100,
        },
        retryInfo: {
          attemptCount: 2,
          maxAttempts: 2,
          isRetry: true,
          previousAttempts: [],
          totalRetryDurationMs: 1500,
          canRetry: false,
        },
      };

      render(<ValidationResults result={resultWithRetry} />);

      // Check that retry information is still displayed even for successful validation
      expect(screen.getByText('Validation Retry Information')).toBeInTheDocument();
      expect(screen.getByText('This resource passed validation successfully')).toBeInTheDocument();
    });
  });
});
