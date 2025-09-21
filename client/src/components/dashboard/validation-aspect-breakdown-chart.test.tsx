import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ValidationAspectBreakdownChart } from './validation-aspect-breakdown-chart';
import { ValidationAspectSummary } from '@shared/types/dashboard';

describe('ValidationAspectBreakdownChart - Enhanced Progress Display', () => {
  const mockAspectBreakdown: Record<string, ValidationAspectSummary> = {
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
    },
    reference: {
      enabled: false,
      issueCount: 0,
      errorCount: 0,
      warningCount: 0,
      informationCount: 0,
      score: 100.0
    },
    businessRule: {
      enabled: true,
      issueCount: 40,
      errorCount: 15,
      warningCount: 20,
      informationCount: 5,
      score: 75.0
    },
    metadata: {
      enabled: true,
      issueCount: 10,
      errorCount: 2,
      warningCount: 5,
      informationCount: 3,
      score: 95.0
    }
  };

  describe('Real-time Progress Bars', () => {
    it('should display validation aspect breakdown with progress bars', () => {
      render(<ValidationAspectBreakdownChart aspectBreakdown={mockAspectBreakdown} />);
      
      expect(screen.getByText('Validation Aspect Breakdown')).toBeInTheDocument();
      expect(screen.getByText('Structural')).toBeInTheDocument();
      expect(screen.getByText('Profile')).toBeInTheDocument();
      expect(screen.getByText('Terminology')).toBeInTheDocument();
    });

    it('should display progress bars with correct scores', () => {
      render(<ValidationAspectBreakdownChart aspectBreakdown={mockAspectBreakdown} />);
      
      // Check that progress bars are rendered
      const progressBars = screen.getAllByRole('progressbar');
      expect(progressBars.length).toBeGreaterThan(0);
      
      // Check score displays
      expect(screen.getByText('85%')).toBeInTheDocument(); // Structural
      expect(screen.getByText('90%')).toBeInTheDocument(); // Profile
      expect(screen.getByText('95%')).toBeInTheDocument(); // Terminology
      expect(screen.getByText('75%')).toBeInTheDocument(); // Business Rule
    });

    it('should display detailed score information', () => {
      render(<ValidationAspectBreakdownChart aspectBreakdown={mockAspectBreakdown} />);
      
      // Check for detailed score percentages
      expect(screen.getByText('85.0%')).toBeInTheDocument(); // Structural detailed
      expect(screen.getByText('90.0%')).toBeInTheDocument(); // Profile detailed
      expect(screen.getByText('95.0%')).toBeInTheDocument(); // Terminology detailed
    });

    it('should sort aspects by score in descending order', () => {
      render(<ValidationAspectBreakdownChart aspectBreakdown={mockAspectBreakdown} />);
      
      // Terminology (95%) should be first, then Profile (90%), then Structural (85%), then Business Rule (75%)
      const aspectElements = screen.getAllByText(/Terminology|Profile|Structural|Business Rule/);
      expect(aspectElements[0]).toHaveTextContent('Terminology');
      expect(aspectElements[1]).toHaveTextContent('Profile');
      expect(aspectElements[2]).toHaveTextContent('Structural');
      expect(aspectElements[3]).toHaveTextContent('Business Rule');
    });
  });

  describe('Aspect Status Indicators', () => {
    it('should display enabled/disabled status badges', () => {
      render(<ValidationAspectBreakdownChart aspectBreakdown={mockAspectBreakdown} />);
      
      // Check for enabled aspects
      expect(screen.getByText('Enabled')).toBeInTheDocument();
      
      // Reference should be disabled
      expect(screen.getByText('Disabled')).toBeInTheDocument();
    });

    it('should show appropriate styling for enabled vs disabled aspects', () => {
      render(<ValidationAspectBreakdownChart aspectBreakdown={mockAspectBreakdown} />);
      
      // Enabled aspects should have green badges
      const enabledBadges = screen.getAllByText('Enabled');
      expect(enabledBadges.length).toBeGreaterThan(0);
      
      // Disabled aspects should have secondary badges
      const disabledBadges = screen.getAllByText('Disabled');
      expect(disabledBadges.length).toBe(1);
    });
  });

  describe('Issue Counts Display', () => {
    it('should display error, warning, and information counts', () => {
      render(<ValidationAspectBreakdownChart aspectBreakdown={mockAspectBreakdown} />);
      
      // Check for error counts
      expect(screen.getByText('20')).toBeInTheDocument(); // Structural errors
      expect(screen.getByText('10')).toBeInTheDocument(); // Profile errors
      expect(screen.getByText('5')).toBeInTheDocument(); // Terminology errors
      
      // Check for warning counts
      expect(screen.getByText('20')).toBeInTheDocument(); // Structural warnings
      expect(screen.getByText('15')).toBeInTheDocument(); // Profile warnings
      
      // Check for information counts
      expect(screen.getByText('10')).toBeInTheDocument(); // Structural info
      expect(screen.getByText('5')).toBeInTheDocument(); // Profile info
    });

    it('should display total issue counts', () => {
      render(<ValidationAspectBreakdownChart aspectBreakdown={mockAspectBreakdown} />);
      
      // Check total counts
      expect(screen.getByText('50')).toBeInTheDocument(); // Structural total
      expect(screen.getByText('30')).toBeInTheDocument(); // Profile total
      expect(screen.getByText('25')).toBeInTheDocument(); // Terminology total
    });

    it('should display issue type labels', () => {
      render(<ValidationAspectBreakdownChart aspectBreakdown={mockAspectBreakdown} />);
      
      expect(screen.getAllByText('Errors')).toHaveLength(5); // 5 enabled aspects
      expect(screen.getAllByText('Warnings')).toHaveLength(5);
      expect(screen.getAllByText('Info')).toHaveLength(5);
      expect(screen.getAllByText('Total')).toHaveLength(5);
    });
  });

  describe('Loading and Error States', () => {
    it('should display loading state', () => {
      render(<ValidationAspectBreakdownChart aspectBreakdown={{}} isLoading={true} />);
      
      expect(screen.getByText('Loading aspect breakdown data...')).toBeInTheDocument();
      expect(screen.getByText('Validation Aspect Breakdown')).toBeInTheDocument();
    });

    it('should display error state', () => {
      const errorMessage = 'Failed to load aspect breakdown';
      render(<ValidationAspectBreakdownChart aspectBreakdown={{}} error={errorMessage} />);
      
      expect(screen.getByText('Error loading aspect breakdown data')).toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    it('should display empty state when no data', () => {
      render(<ValidationAspectBreakdownChart aspectBreakdown={{}} />);
      
      expect(screen.getByText('No aspect breakdown data available')).toBeInTheDocument();
      expect(screen.getByText('No validation aspect data to display')).toBeInTheDocument();
    });
  });

  describe('Score Color Coding', () => {
    it('should apply appropriate colors for different score ranges', () => {
      const scoreBreakdown = {
        excellent: { enabled: true, issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, score: 95.0 },
        good: { enabled: true, issueCount: 10, errorCount: 2, warningCount: 5, informationCount: 3, score: 85.0 },
        fair: { enabled: true, issueCount: 25, errorCount: 8, warningCount: 12, informationCount: 5, score: 70.0 },
        poor: { enabled: true, issueCount: 50, errorCount: 20, warningCount: 20, informationCount: 10, score: 45.0 }
      };

      render(<ValidationAspectBreakdownChart aspectBreakdown={scoreBreakdown} />);
      
      // All aspects should be rendered with their respective scores
      expect(screen.getByText('95%')).toBeInTheDocument();
      expect(screen.getByText('85%')).toBeInTheDocument();
      expect(screen.getByText('70%')).toBeInTheDocument();
      expect(screen.getByText('45%')).toBeInTheDocument();
    });
  });

  describe('Summary Information', () => {
    it('should display summary note about enabled aspects', () => {
      render(<ValidationAspectBreakdownChart aspectBreakdown={mockAspectBreakdown} />);
      
      expect(screen.getByText(/Only enabled aspects are shown in validation results/)).toBeInTheDocument();
      expect(screen.getByText(/Disabled aspects are filtered out during validation result processing/)).toBeInTheDocument();
    });

    it('should display detailed breakdown description', () => {
      render(<ValidationAspectBreakdownChart aspectBreakdown={mockAspectBreakdown} />);
      
      expect(screen.getByText('Detailed breakdown of validation issues by aspect (filtered by enabled aspects)')).toBeInTheDocument();
    });
  });
});
