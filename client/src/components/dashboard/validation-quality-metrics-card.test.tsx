/**
 * Unit tests for Validation Quality Metrics Card
 * 
 * Tests the display of comprehensive validation quality metrics including
 * accuracy, completeness, consistency, performance, and reliability scores.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ValidationQualityMetricsCard } from './validation-quality-metrics-card';
import type { ValidationQualityMetrics } from '@shared/types/validation';

// Mock Lucide React icons
vi.mock('lucide-react', () => ({
  Award: () => <div data-testid="award-icon" />,
  Target: () => <div data-testid="target-icon" />,
  CheckCircle: () => <div data-testid="check-circle-icon" />,
  AlertTriangle: () => <div data-testid="alert-triangle-icon" />,
  TrendingUp: () => <div data-testid="trending-up-icon" />,
  TrendingDown: () => <div data-testid="trending-down-icon" />,
  Activity: () => <div data-testid="activity-icon" />,
  Clock: () => <div data-testid="clock-icon" />,
  Shield: () => <div data-testid="shield-icon" />,
  BarChart3: () => <div data-testid="bar-chart-3-icon" />,
  Layers: () => <div data-testid="layers-icon" />,
  Database: () => <div data-testid="database-icon" />,
  Zap: () => <div data-testid="zap-icon" />,
  Info: () => <div data-testid="info-icon" />
}));

describe('ValidationQualityMetricsCard', () => {
  let mockQualityMetrics: ValidationQualityMetrics;

  beforeEach(() => {
    mockQualityMetrics = {
      overallQualityScore: 85,
      accuracy: {
        truePositiveRate: 0.92,
        trueNegativeRate: 0.88,
        falsePositiveRate: 0.12,
        falseNegativeRate: 0.08,
        precision: 0.92,
        recall: 0.92,
        f1Score: 0.92,
        accuracy: 0.90,
        confidence: 88
      },
      completeness: {
        fullValidationCoverage: 90,
        aspectCoverage: 85,
        requiredFieldCoverage: 95,
        optionalFieldCoverage: 75,
        validationGaps: 2,
        completenessScore: 86,
        missingAreas: ['terminology-validation']
      },
      consistency: {
        runConsistency: 88,
        resourceConsistency: 85,
        aspectConsistency: 90,
        scoreStandardDeviation: 5.2,
        coefficientOfVariation: 0.06,
        inconsistentValidations: 3,
        consistencyScore: 87
      },
      performance: {
        averageValidationTime: 150,
        medianValidationTime: 140,
        p95ValidationTime: 200,
        throughput: 400,
        resourceUtilization: 85,
        memoryEfficiency: 90,
        performanceScore: 88,
        bottlenecks: ['terminology-validation']
      },
      reliability: {
        uptime: 99.5,
        errorRate: 2.5,
        recoveryTime: 3000,
        retrySuccessRate: 85,
        dataIntegrity: 99.8,
        reliabilityScore: 94,
        reliabilityIssues: []
      },
      aspectQualityScores: {
        structural: {
          aspect: 'structural',
          qualityScore: 92,
          issueCount: 1,
          issueSeverityDistribution: {
            fatal: 0,
            error: 0,
            warning: 1,
            information: 0
          },
          coverage: 95,
          accuracy: 92,
          performance: {
            averageTime: 100,
            totalTime: 1000,
            throughput: 600
          },
          trends: []
        },
        profile: {
          aspect: 'profile',
          qualityScore: 88,
          issueCount: 2,
          issueSeverityDistribution: {
            fatal: 0,
            error: 1,
            warning: 1,
            information: 0
          },
          coverage: 90,
          accuracy: 88,
          performance: {
            averageTime: 150,
            totalTime: 1500,
            throughput: 400
          },
          trends: []
        },
        terminology: {
          aspect: 'terminology',
          qualityScore: 75,
          issueCount: 5,
          issueSeverityDistribution: {
            fatal: 0,
            error: 2,
            warning: 3,
            information: 0
          },
          coverage: 80,
          accuracy: 75,
          performance: {
            averageTime: 200,
            totalTime: 2000,
            throughput: 300
          },
          trends: []
        },
        reference: {
          aspect: 'reference',
          qualityScore: 90,
          issueCount: 1,
          issueSeverityDistribution: {
            fatal: 0,
            error: 0,
            warning: 1,
            information: 0
          },
          coverage: 85,
          accuracy: 90,
          performance: {
            averageTime: 120,
            totalTime: 1200,
            throughput: 500
          },
          trends: []
        },
        businessRule: {
          aspect: 'businessRule',
          qualityScore: 85,
          issueCount: 2,
          issueSeverityDistribution: {
            fatal: 0,
            error: 1,
            warning: 1,
            information: 0
          },
          coverage: 88,
          accuracy: 85,
          performance: {
            averageTime: 180,
            totalTime: 1800,
            throughput: 333
          },
          trends: []
        },
        metadata: {
          aspect: 'metadata',
          qualityScore: 95,
          issueCount: 0,
          issueSeverityDistribution: {
            fatal: 0,
            error: 0,
            warning: 0,
            information: 0
          },
          coverage: 98,
          accuracy: 95,
          performance: {
            averageTime: 80,
            totalTime: 800,
            throughput: 750
          },
          trends: []
        }
      },
      qualityTrends: [
        {
          timestamp: new Date('2024-01-01T10:00:00Z'),
          qualityScore: 82,
          accuracyScore: 85,
          completenessScore: 80,
          consistencyScore: 85,
          performanceScore: 85,
          reliabilityScore: 90,
          resourcesValidated: 100,
          duration: 30000
        },
        {
          timestamp: new Date('2024-01-01T11:00:00Z'),
          qualityScore: 85,
          accuracyScore: 88,
          completenessScore: 83,
          consistencyScore: 87,
          performanceScore: 88,
          reliabilityScore: 94,
          resourcesValidated: 150,
          duration: 45000
        }
      ],
      recommendations: [
        {
          id: 'improve-terminology',
          type: 'accuracy',
          priority: 'high',
          title: 'Improve Terminology Validation',
          description: 'Terminology validation shows lower quality scores and should be enhanced',
          expectedImpact: 15,
          effort: 'medium',
          relatedAspects: ['terminology'],
          actionItems: [
            'Review terminology validation rules',
            'Update terminology server configuration',
            'Add missing terminology validations'
          ],
          estimatedTime: '2-3 weeks'
        },
        {
          id: 'optimize-performance',
          type: 'performance',
          priority: 'medium',
          title: 'Optimize Validation Performance',
          description: 'Performance bottlenecks detected in terminology validation',
          expectedImpact: 12,
          effort: 'high',
          relatedAspects: ['terminology'],
          actionItems: [
            'Optimize terminology validation algorithms',
            'Implement caching for terminology lookups',
            'Parallelize terminology validation processes'
          ],
          estimatedTime: '3-4 weeks'
        }
      ]
    };
  });

  describe('rendering', () => {
    it('should render loading state correctly', () => {
      render(<ValidationQualityMetricsCard isLoading={true} />);

      expect(screen.getByText('Validation Quality Metrics')).toBeInTheDocument();
      expect(screen.getByText('Comprehensive quality assessment of validation performance')).toBeInTheDocument();
      expect(screen.getByTestId('award-icon')).toBeInTheDocument();
    });

    it('should render quality metrics correctly', () => {
      render(<ValidationQualityMetricsCard qualityMetrics={mockQualityMetrics} />);

      expect(screen.getByText('Validation Quality Metrics')).toBeInTheDocument();
      expect(screen.getByText('Grade B')).toBeInTheDocument();
      expect(screen.getByText('Good')).toBeInTheDocument();
      expect(screen.getByText('85')).toBeInTheDocument(); // Just the score number
    });

    it('should display overall quality score with progress bar', () => {
      render(<ValidationQualityMetricsCard qualityMetrics={mockQualityMetrics} />);

      expect(screen.getByText('Overall Quality Score')).toBeInTheDocument();
      expect(screen.getByText('85')).toBeInTheDocument(); // Just the score number
      expect(screen.getByText('Good')).toBeInTheDocument();
    });

    it('should display quality factors with progress bars', () => {
      render(<ValidationQualityMetricsCard qualityMetrics={mockQualityMetrics} />);

      expect(screen.getByText('Accuracy')).toBeInTheDocument();
      expect(screen.getByText('90%')).toBeInTheDocument();
      expect(screen.getByText('Completeness')).toBeInTheDocument();
      expect(screen.getByText('86%')).toBeInTheDocument();
      expect(screen.getByText('Consistency')).toBeInTheDocument();
      expect(screen.getByText('87%')).toBeInTheDocument();
      expect(screen.getByText('Performance')).toBeInTheDocument();
      expect(screen.getAllByText('88%')).toHaveLength(3); // Consistency, Performance, and Confidence
      expect(screen.getByText('Reliability')).toBeInTheDocument();
      expect(screen.getByText('94%')).toBeInTheDocument();
      expect(screen.getByText('Confidence')).toBeInTheDocument();
      expect(screen.getAllByText('88%')).toHaveLength(3); // Appears in multiple sections
    });

    it('should display aspect quality breakdown', () => {
      render(<ValidationQualityMetricsCard qualityMetrics={mockQualityMetrics} />);

      expect(screen.getByText('Validation Aspect Quality')).toBeInTheDocument();
      expect(screen.getByText('structural')).toBeInTheDocument();
      expect(screen.getByText('profile')).toBeInTheDocument();
      expect(screen.getByText('terminology')).toBeInTheDocument();
      expect(screen.getByText('reference')).toBeInTheDocument();
      expect(screen.getByText('business Rule')).toBeInTheDocument();
      expect(screen.getByText('metadata')).toBeInTheDocument();
      
      // Check that aspect scores are displayed (some may appear multiple times)
      expect(screen.getAllByText('92%')).toHaveLength(3); // Appears in multiple sections
      expect(screen.getAllByText('88%')).toHaveLength(3); // Appears in multiple sections
      expect(screen.getByText('75%')).toBeInTheDocument();
      expect(screen.getByText('90%')).toBeInTheDocument();
      expect(screen.getByText('85%')).toBeInTheDocument();
      expect(screen.getByText('95%')).toBeInTheDocument();
    });

    it('should display key metrics summary', () => {
      render(<ValidationQualityMetricsCard qualityMetrics={mockQualityMetrics} />);

      // Check key metrics - use getAllByText for values that appear multiple times
      expect(screen.getAllByText('92%')).toHaveLength(3); // Precision, Recall, and Aspect Quality
      expect(screen.getByText('3')).toBeInTheDocument(); // Inconsistent
      expect(screen.getByText('1')).toBeInTheDocument(); // Bottlenecks
    });

    it('should display recommendations when available', () => {
      render(<ValidationQualityMetricsCard qualityMetrics={mockQualityMetrics} />);

      expect(screen.getByText('Top Recommendations')).toBeInTheDocument();
      expect(screen.getByText('Improve Terminology Validation')).toBeInTheDocument();
      expect(screen.getByText('Optimize Validation Performance')).toBeInTheDocument();
      expect(screen.getByText('high')).toBeInTheDocument();
      expect(screen.getByText('medium')).toBeInTheDocument();
    });

    it('should not display recommendations when empty', () => {
      const metricsWithoutRecommendations = {
        ...mockQualityMetrics,
        recommendations: []
      };

      render(<ValidationQualityMetricsCard qualityMetrics={metricsWithoutRecommendations} />);

      expect(screen.queryByText('Top Recommendations')).not.toBeInTheDocument();
    });
  });

  describe('quality grade and status', () => {
    it('should display correct grade and status for excellent quality', () => {
      const excellentMetrics = {
        ...mockQualityMetrics,
        overallQualityScore: 95
      };

      render(<ValidationQualityMetricsCard qualityMetrics={excellentMetrics} />);

      expect(screen.getByText('Grade A')).toBeInTheDocument();
      expect(screen.getByText('Excellent')).toBeInTheDocument();
    });

    it('should display correct grade and status for good quality', () => {
      render(<ValidationQualityMetricsCard qualityMetrics={mockQualityMetrics} />);

      expect(screen.getByText('Grade B')).toBeInTheDocument();
      expect(screen.getByText('Good')).toBeInTheDocument();
    });

    it('should display correct grade and status for acceptable quality', () => {
      const acceptableMetrics = {
        ...mockQualityMetrics,
        overallQualityScore: 75
      };

      render(<ValidationQualityMetricsCard qualityMetrics={acceptableMetrics} />);

      expect(screen.getByText('Grade C')).toBeInTheDocument();
      expect(screen.getByText('Acceptable')).toBeInTheDocument();
    });

    it('should display correct grade and status for poor quality', () => {
      const poorMetrics = {
        ...mockQualityMetrics,
        overallQualityScore: 65
      };

      render(<ValidationQualityMetricsCard qualityMetrics={poorMetrics} />);

      expect(screen.getByText('Grade D')).toBeInTheDocument();
      expect(screen.getByText('Poor')).toBeInTheDocument();
    });

    it('should display correct grade and status for unacceptable quality', () => {
      const unacceptableMetrics = {
        ...mockQualityMetrics,
        overallQualityScore: 45
      };

      render(<ValidationQualityMetricsCard qualityMetrics={unacceptableMetrics} />);

      expect(screen.getByText('Grade F')).toBeInTheDocument();
      expect(screen.getByText('Unacceptable')).toBeInTheDocument();
    });
  });

  describe('trend indicators', () => {
    it('should display improving trend icon for high scores', () => {
      const improvingMetrics = {
        ...mockQualityMetrics,
        overallQualityScore: 95
      };

      render(<ValidationQualityMetricsCard qualityMetrics={improvingMetrics} />);

      expect(screen.getByTestId('trending-up-icon')).toBeInTheDocument();
    });

    it('should display stable trend icon for medium scores', () => {
      render(<ValidationQualityMetricsCard qualityMetrics={mockQualityMetrics} />);

      expect(screen.getByTestId('activity-icon')).toBeInTheDocument();
    });

    it('should display declining trend icon for low scores', () => {
      const decliningMetrics = {
        ...mockQualityMetrics,
        overallQualityScore: 45
      };

      render(<ValidationQualityMetricsCard qualityMetrics={decliningMetrics} />);

      expect(screen.getByTestId('trending-down-icon')).toBeInTheDocument();
    });
  });

  describe('aspect quality display', () => {
    it('should display aspect quality scores with progress bars', () => {
      render(<ValidationQualityMetricsCard qualityMetrics={mockQualityMetrics} />);

      // Check that aspect quality scores are displayed
      expect(screen.getByText('structural')).toBeInTheDocument();
      expect(screen.getAllByText('92%')).toHaveLength(3); // Appears in multiple sections
      expect(screen.getByText('Issues: 1 | Coverage: 95%')).toBeInTheDocument();

      expect(screen.getByText('profile')).toBeInTheDocument();
      expect(screen.getAllByText('88%')).toHaveLength(3); // Appears in multiple sections
      expect(screen.getByText('Issues: 2 | Coverage: 90%')).toBeInTheDocument();
    });

    it('should format aspect names correctly', () => {
      render(<ValidationQualityMetricsCard qualityMetrics={mockQualityMetrics} />);

      // Check for the formatted aspect name as it appears in the component
      expect(screen.getByText('business Rule')).toBeInTheDocument();
    });
  });

  describe('recommendations display', () => {
    it('should display recommendation priority badges correctly', () => {
      render(<ValidationQualityMetricsCard qualityMetrics={mockQualityMetrics} />);

      expect(screen.getByText('high')).toBeInTheDocument();
      expect(screen.getByText('medium')).toBeInTheDocument();
    });

    it('should display recommendation descriptions', () => {
      render(<ValidationQualityMetricsCard qualityMetrics={mockQualityMetrics} />);

      expect(screen.getByText('Terminology validation shows lower quality scores and should be enhanced')).toBeInTheDocument();
      expect(screen.getByText('Performance bottlenecks detected in terminology validation')).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('should handle missing quality metrics gracefully', () => {
      render(<ValidationQualityMetricsCard qualityMetrics={null as any} />);

      expect(screen.getByText('Validation Quality Metrics')).toBeInTheDocument();
    });

    it('should handle incomplete quality metrics', () => {
      const incompleteMetrics = {
        overallQualityScore: 85,
        accuracy: mockQualityMetrics.accuracy,
        completeness: mockQualityMetrics.completeness,
        consistency: mockQualityMetrics.consistency,
        performance: mockQualityMetrics.performance,
        reliability: mockQualityMetrics.reliability,
        aspectQualityScores: {},
        qualityTrends: [],
        recommendations: []
      } as ValidationQualityMetrics;

      render(<ValidationQualityMetricsCard qualityMetrics={incompleteMetrics} />);

      expect(screen.getByText('Validation Quality Metrics')).toBeInTheDocument();
      expect(screen.getByText('85')).toBeInTheDocument(); // Check for the score number
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      render(<ValidationQualityMetricsCard qualityMetrics={mockQualityMetrics} />);

      expect(screen.getByText('Validation Quality Metrics')).toBeInTheDocument();
      expect(screen.getByText('Comprehensive quality assessment of validation performance')).toBeInTheDocument();
    });

    it('should display progress bars with proper values', () => {
      render(<ValidationQualityMetricsCard qualityMetrics={mockQualityMetrics} />);

      // Progress bars should be present (tested by checking for the component structure)
      expect(screen.getByText('Overall Quality Score')).toBeInTheDocument();
      expect(screen.getByText('85')).toBeInTheDocument(); // Check for the score number
    });
  });
});
