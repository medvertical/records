// ============================================================================
// Dashboard Type Definitions
// ============================================================================

/**
 * FHIR Server Statistics - Data from the actual FHIR server
 */
export interface FhirServerStats {
  totalResources: number;
  resourceCounts: Record<string, number>;
  serverInfo: {
    version: string;
    connected: boolean;
    lastChecked: Date;
    error?: string;
  };
  resourceBreakdown: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
}

/**
 * Validation Statistics - Data from local database validation results
 */
export interface ValidationStats {
  totalValidated: number;
  validResources: number;
  errorResources: number;
  warningResources: number;
  unvalidatedResources: number;
  validationCoverage: number; // Percentage of validated resources that are valid
  validationProgress: number; // Percentage of total resources that have been validated
  lastValidationRun?: Date;
  resourceTypeBreakdown: Record<string, {
    total: number;
    validated: number;
    valid: number;
    errors: number;
    warnings: number;
    unvalidated: number;
    validationRate: number; // Percentage of this type that has been validated
    successRate: number; // Percentage of validated resources that are valid
  }>;
}

/**
 * Combined Dashboard Data - Properly separated data sources
 */
export interface DashboardData {
  fhirServer: FhirServerStats;
  validation: ValidationStats;
  lastUpdated: Date;
  dataFreshness: {
    fhirServer: Date;
    validation: Date;
  };
}

/**
 * Validation Progress - Real-time validation state
 */
export interface ValidationProgress {
  totalResources: number;
  processedResources: number;
  validResources: number;
  errorResources: number;
  warningResources: number;
  currentResourceType?: string;
  startTime: Date;
  estimatedTimeRemaining?: number;
  isComplete: boolean;
  errors: string[];
  status: 'not_running' | 'running' | 'paused' | 'completed' | 'error';
  processingRate: number; // Resources per minute
}

/**
 * Dashboard Card Configuration
 */
export interface DashboardCard {
  id: string;
  title: string;
  type: 'fhir-server' | 'validation' | 'combined';
  dataSource: 'fhir-server' | 'validation' | 'both';
  position: number;
  visible: boolean;
  config: Record<string, any>;
}

/**
 * Data Source Indicators
 */
export interface DataSourceIndicator {
  source: 'fhir-server' | 'validation' | 'combined';
  label: string;
  description: string;
  lastUpdated: Date;
  isStale: boolean;
}

/**
 * Dashboard Error Types
 */
export interface DashboardError {
  type: 'fhir-server' | 'validation' | 'combined';
  message: string;
  timestamp: Date;
  recoverable: boolean;
  retryCount: number;
}
