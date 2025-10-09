/**
 * Metadata Completeness Scorer
 * 
 * Task 10.6: Calculate metadata completeness score (0-100)
 * 
 * Features:
 * - Score based on required and optional metadata fields
 * - Weighted scoring system
 * - Version-specific requirements
 * - Detailed breakdown
 */

// ============================================================================
// Types
// ============================================================================

export interface MetadataScore {
  totalScore: number; // 0-100
  requiredScore: number; // 0-100 (required fields only)
  optionalScore: number; // 0-100 (optional fields)
  breakdown: {
    field: string;
    present: boolean;
    weight: number;
    score: number;
    required: boolean;
  }[];
  missingRequired: string[];
  missingOptional: string[];
}

interface FieldWeights {
  required: Record<string, number>;
  optional: Record<string, number>;
}

// ============================================================================
// MetadataCompletenessScorer Class
// ============================================================================

export class MetadataCompletenessScorer {
  private fieldWeights: Record<string, FieldWeights> = {
    // Version-specific field weights
    R4: {
      required: {
        'id': 15,
        'meta.versionId': 10,
        'meta.lastUpdated': 15
      },
      optional: {
        'meta.profile': 15,
        'meta.security': 10,
        'meta.tag': 10,
        'meta.source': 10,
        'language': 5,
        'text': 10
      }
    },
    R5: {
      required: {
        'id': 15,
        'meta.versionId': 10,
        'meta.lastUpdated': 15
      },
      optional: {
        'meta.profile': 15,
        'meta.security': 10,
        'meta.tag': 10,
        'meta.source': 10,
        'language': 5,
        'text': 10
      }
    },
    R6: {
      required: {
        'id': 15,
        'meta.versionId': 10,
        'meta.lastUpdated': 15
      },
      optional: {
        'meta.profile': 15,
        'meta.security': 10,
        'meta.tag': 10,
        'meta.source': 10,
        'language': 5,
        'text': 10
      }
    }
  };

  /**
   * Calculate metadata completeness score
   */
  calculateScore(
    resource: any,
    fhirVersion: 'R4' | 'R5' | 'R6' = 'R4'
  ): MetadataScore {
    const weights = this.fieldWeights[fhirVersion];
    const breakdown: MetadataScore['breakdown'] = [];
    const missingRequired: string[] = [];
    const missingOptional: string[] = [];

    let requiredTotalWeight = 0;
    let requiredEarnedWeight = 0;
    let optionalTotalWeight = 0;
    let optionalEarnedWeight = 0;

    // Check required fields
    for (const [field, weight] of Object.entries(weights.required)) {
      const present = this.isFieldPresent(resource, field);
      
      requiredTotalWeight += weight;
      if (present) {
        requiredEarnedWeight += weight;
      } else {
        missingRequired.push(field);
      }

      breakdown.push({
        field,
        present,
        weight,
        score: present ? weight : 0,
        required: true
      });
    }

    // Check optional fields
    for (const [field, weight] of Object.entries(weights.optional)) {
      const present = this.isFieldPresent(resource, field);
      
      optionalTotalWeight += weight;
      if (present) {
        optionalEarnedWeight += weight;
      } else {
        missingOptional.push(field);
      }

      breakdown.push({
        field,
        present,
        weight,
        score: present ? weight : 0,
        required: false
      });
    }

    // Calculate scores
    const requiredScore = requiredTotalWeight > 0 
      ? Math.round((requiredEarnedWeight / requiredTotalWeight) * 100)
      : 100;

    const optionalScore = optionalTotalWeight > 0
      ? Math.round((optionalEarnedWeight / optionalTotalWeight) * 100)
      : 100;

    // Total score (70% required, 30% optional)
    const totalScore = Math.round(
      (requiredScore * 0.7) + (optionalScore * 0.3)
    );

    return {
      totalScore,
      requiredScore,
      optionalScore,
      breakdown,
      missingRequired,
      missingOptional
    };
  }

  /**
   * Check if field is present in resource
   */
  private isFieldPresent(resource: any, fieldPath: string): boolean {
    const parts = fieldPath.split('.');
    let current = resource;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return false;
      }
    }

    // Check if value is meaningful (not null, not empty string, not empty array)
    if (current === null || current === undefined) {
      return false;
    }

    if (typeof current === 'string' && current.trim().length === 0) {
      return false;
    }

    if (Array.isArray(current) && current.length === 0) {
      return false;
    }

    return true;
  }

  /**
   * Get score interpretation
   */
  getScoreInterpretation(score: number): {
    level: 'excellent' | 'good' | 'fair' | 'poor';
    message: string;
    color: string;
  } {
    if (score >= 90) {
      return {
        level: 'excellent',
        message: 'Excellent metadata completeness',
        color: 'green'
      };
    } else if (score >= 75) {
      return {
        level: 'good',
        message: 'Good metadata completeness',
        color: 'blue'
      };
    } else if (score >= 50) {
      return {
        level: 'fair',
        message: 'Fair metadata completeness - consider adding more metadata',
        color: 'yellow'
      };
    } else {
      return {
        level: 'poor',
        message: 'Poor metadata completeness - important metadata fields are missing',
        color: 'red'
      };
    }
  }

  /**
   * Get recommendations for improving score
   */
  getRecommendations(score: MetadataScore): string[] {
    const recommendations: string[] = [];

    if (score.missingRequired.length > 0) {
      recommendations.push(
        `Add required metadata fields: ${score.missingRequired.join(', ')}`
      );
    }

    if (score.optionalScore < 50 && score.missingOptional.length > 0) {
      const topMissing = score.breakdown
        .filter(b => !b.required && !b.present)
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 3)
        .map(b => b.field);

      if (topMissing.length > 0) {
        recommendations.push(
          `Consider adding high-value optional fields: ${topMissing.join(', ')}`
        );
      }
    }

    if (!score.breakdown.find(b => b.field === 'meta.profile')?.present) {
      recommendations.push(
        'Add meta.profile to specify which profiles this resource conforms to'
      );
    }

    if (!score.breakdown.find(b => b.field === 'meta.security')?.present) {
      recommendations.push(
        'Add meta.security labels for access control and confidentiality'
      );
    }

    if (!score.breakdown.find(b => b.field === 'text')?.present) {
      recommendations.push(
        'Add human-readable narrative text for better readability'
      );
    }

    return recommendations;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let metadataScorer: MetadataCompletenessScorer | null = null;

export function getMetadataScorer(): MetadataCompletenessScorer {
  if (!metadataScorer) {
    metadataScorer = new MetadataCompletenessScorer();
  }
  return metadataScorer;
}

export default MetadataCompletenessScorer;

