// ============================================================================
// Validation Control Types
// ============================================================================

/**
 * Validation control state types
 */
export type ValidationStatus = 'not_running' | 'running' | 'paused' | 'completed' | 'error' | 'stopping';

export type ValidationAction = 'start' | 'pause' | 'resume' | 'stop' | 'reset';

/**
 * Validation progress with enhanced typing
 */
export interface ValidationProgress {
  totalResources: number;
  processedResources: number;
  validResources: number;
  errorResources: number;
  warningResources: number;
  currentResourceType?: string;
  startTime: Date | string;
  estimatedTimeRemaining?: number;
  isComplete: boolean;
  errors: string[];
  status: ValidationStatus;
  processingRate: number; // Resources per minute
  currentBatch?: {
    batchNumber: number;
    totalBatches: number;
    batchSize: number;
    resourcesInBatch: number;
  };
  performance?: {
    averageTimePerResource: number;
    totalTimeMs: number;
    memoryUsage?: number;
  };
  retryStatistics?: {
    totalRetryAttempts: number;
    successfulRetries: number;
    failedRetries: number;
    resourcesWithRetries: number;
    averageRetriesPerResource: number;
  };
}

/**
 * Validation controls state with comprehensive typing
 */
export interface ValidationControlsState {
  isRunning: boolean;
  isPaused: boolean;
  isStopping: boolean;
  progress: ValidationProgress | null;
  error: string | null;
  lastAction: ValidationAction | null;
  batchSize: number;
  configuration: ValidationConfiguration;
  history: ValidationRunHistory[];
  metrics: ValidationMetrics;
}

/**
 * Validation configuration options
 */
export interface ValidationConfiguration {
  batchSize: number;
  minBatchSize: number;
  maxBatchSize: number;
  enablePersistence: boolean;
  retryAttempts: number;
  retryDelay: number;
  autoRetry: boolean;
  strictMode: boolean;
  validationAspects: {
    structural: boolean;
    profile: boolean;
    terminology: boolean;
    reference: boolean;
    businessRule: boolean;
    metadata: boolean;
  };
  performance: {
    maxConcurrentValidations: number;
    timeoutMs: number;
    memoryLimitMB: number;
  };
}

/**
 * Validation run history entry
 */
export interface ValidationRunHistory {
  id: string;
  startTime: Date;
  endTime?: Date;
  status: ValidationStatus;
  totalResources: number;
  processedResources: number;
  validResources: number;
  errorResources: number;
  batchSize: number;
  duration?: number;
  error?: string;
  configuration: ValidationConfiguration;
}

/**
 * Validation metrics for performance tracking
 */
export interface ValidationMetrics {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  averageDuration: number;
  averageThroughput: number; // Resources per minute
  bestThroughput: number;
  worstThroughput: number;
  averageSuccessRate: number;
  totalResourcesProcessed: number;
  totalValidResources: number;
  totalErrorResources: number;
  lastRunDate?: Date;
}

/**
 * Validation control actions with proper typing
 */
export interface ValidationControlsActions {
  startValidation: (options?: StartValidationOptions) => Promise<void>;
  pauseValidation: () => Promise<void>;
  resumeValidation: () => Promise<void>;
  stopValidation: () => Promise<void>;
  updateBatchSize: (batchSize: number) => void;
  updateConfiguration: (config: Partial<ValidationConfiguration>) => void;
  clearError: () => void;
  resetState: () => void;
  clearHistory: () => void;
  exportResults: (format: 'json' | 'csv' | 'pdf') => Promise<void>;
  getHistory: () => ValidationRunHistory[];
  getMetrics: () => ValidationMetrics;
}

/**
 * Options for starting validation
 */
export interface StartValidationOptions {
  batchSize?: number;
  forceRevalidation?: boolean;
  skipUnchanged?: boolean;
  resourceTypes?: string[];
  customConfiguration?: Partial<ValidationConfiguration>;
}

/**
 * WebSocket message types for validation updates
 */
export interface ValidationWebSocketMessage {
  type: 'validation-progress' | 'validation-completed' | 'validation-error' | 'validation-paused' | 'validation-resumed';
  timestamp: Date;
  data: any;
}

export interface ValidationProgressMessage extends ValidationWebSocketMessage {
  type: 'validation-progress';
  data: ValidationProgress;
}

export interface ValidationCompletedMessage extends ValidationWebSocketMessage {
  type: 'validation-completed';
  data: {
    progress: ValidationProgress;
    summary: ValidationRunSummary;
  };
}

export interface ValidationErrorMessage extends ValidationWebSocketMessage {
  type: 'validation-error';
  data: {
    error: string;
    code?: string;
    recoverable: boolean;
    retryAfter?: number;
  };
}

/**
 * Validation run summary
 */
export interface ValidationRunSummary {
  totalResources: number;
  processedResources: number;
  validResources: number;
  errorResources: number;
  warningResources: number;
  skippedResources: number;
  duration: number;
  averageProcessingTime: number;
  successRate: number;
  errorRate: number;
  resourceTypeBreakdown: Record<string, {
    total: number;
    valid: number;
    errors: number;
    warnings: number;
    skipped: number;
  }>;
}

/**
 * Validation error types
 */
export interface ValidationError {
  code: string;
  message: string;
  severity: 'fatal' | 'error' | 'warning' | 'information';
  recoverable: boolean;
  retryAfter?: number;
  context?: Record<string, any>;
}

/**
 * Retry tracking information for validation results
 */
export interface ValidationRetryInfo {
  /** Number of retry attempts made */
  attemptCount: number;
  
  /** Maximum number of retry attempts allowed */
  maxAttempts: number;
  
  /** Whether this validation was a retry */
  isRetry: boolean;
  
  /** Previous validation attempt results */
  previousAttempts: ValidationRetryAttempt[];
  
  /** Total retry duration in milliseconds */
  totalRetryDurationMs: number;
  
  /** Whether retry is still possible */
  canRetry: boolean;
  
  /** Reason for retry (if applicable) */
  retryReason?: string;
}

/**
 * Individual retry attempt information
 */
export interface ValidationRetryAttempt {
  /** Attempt number (1-based) */
  attemptNumber: number;
  
  /** Timestamp of the attempt */
  attemptedAt: Date;
  
  /** Whether the attempt was successful */
  success: boolean;
  
  /** Error message if the attempt failed */
  errorMessage?: string;
  
  /** Duration of this attempt in milliseconds */
  durationMs: number;
  
  /** Validation result summary of this attempt */
  resultSummary?: {
    isValid: boolean;
    errorCount: number;
    warningCount: number;
    validationScore: number;
  };
}

/**
 * Validation hook configuration
 */
export interface ValidationControlsConfig {
  defaultBatchSize?: number;
  minBatchSize?: number;
  maxBatchSize?: number;
  enablePersistence?: boolean;
  retryAttempts?: number;
  retryDelay?: number;
  autoRetry?: boolean;
  strictMode?: boolean;
  enableMetrics?: boolean;
  maxHistoryEntries?: number;
  performanceMonitoring?: boolean;
}

/**
 * Validation hook return type
 */
export interface ValidationControlsHook {
  state: ValidationControlsState;
  actions: ValidationControlsActions;
  isLoading: boolean;
  isConnected: boolean;
  canStart: boolean;
  canPause: boolean;
  canResume: boolean;
  canStop: boolean;
  progressPercentage: number;
  estimatedTimeRemaining: number | null;
  currentThroughput: number;
  successRate: number;
}

/**
 * Validation result export formats
 */
export interface ValidationExportOptions {
  format: 'json' | 'csv' | 'pdf';
  includeHistory?: boolean;
  includeMetrics?: boolean;
  includeConfiguration?: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
  resourceTypes?: string[];
}

/**
 * Validation performance benchmark
 */
export interface ValidationBenchmark {
  name: string;
  description: string;
  targetThroughput: number; // Resources per minute
  targetSuccessRate: number; // Percentage
  targetDuration: number; // Milliseconds
  actualThroughput?: number;
  actualSuccessRate?: number;
  actualDuration?: number;
  passed: boolean;
  score: number; // 0-100
}

// ============================================================================
// Validation Quality Metrics and Scoring
// ============================================================================

/**
 * Comprehensive validation quality metrics
 */
export interface ValidationQualityMetrics {
  /** Overall quality score (0-100) */
  overallQualityScore: number;
  
  /** Accuracy metrics */
  accuracy: ValidationAccuracyMetrics;
  
  /** Completeness metrics */
  completeness: ValidationCompletenessMetrics;
  
  /** Consistency metrics */
  consistency: ValidationConsistencyMetrics;
  
  /** Performance metrics */
  performance: ValidationPerformanceMetrics;
  
  /** Reliability metrics */
  reliability: ValidationReliabilityMetrics;
  
  /** Aspect-specific quality scores */
  aspectQualityScores: Record<string, ValidationAspectQuality>;
  
  /** Quality trends over time */
  qualityTrends: ValidationQualityTrend[];
  
  /** Quality recommendations */
  recommendations: ValidationQualityRecommendation[];
}

/**
 * Validation accuracy metrics
 */
export interface ValidationAccuracyMetrics {
  /** True positive rate (correctly identified valid resources) */
  truePositiveRate: number;
  
  /** True negative rate (correctly identified invalid resources) */
  trueNegativeRate: number;
  
  /** False positive rate (incorrectly identified valid resources) */
  falsePositiveRate: number;
  
  /** False negative rate (missed invalid resources) */
  falseNegativeRate: number;
  
  /** Precision (positive predictive value) */
  precision: number;
  
  /** Recall (sensitivity) */
  recall: number;
  
  /** F1 score (harmonic mean of precision and recall) */
  f1Score: number;
  
  /** Overall accuracy percentage */
  accuracy: number;
  
  /** Validation confidence level (0-100) */
  confidence: number;
}

/**
 * Validation completeness metrics
 */
export interface ValidationCompletenessMetrics {
  /** Percentage of resources that were fully validated */
  fullValidationCoverage: number;
  
  /** Percentage of validation aspects covered */
  aspectCoverage: number;
  
  /** Percentage of required fields validated */
  requiredFieldCoverage: number;
  
  /** Percentage of optional fields validated */
  optionalFieldCoverage: number;
  
  /** Number of validation gaps identified */
  validationGaps: number;
  
  /** Completeness score (0-100) */
  completenessScore: number;
  
  /** Missing validation areas */
  missingAreas: string[];
}

/**
 * Validation consistency metrics
 */
export interface ValidationConsistencyMetrics {
  /** Consistency score across validation runs (0-100) */
  runConsistency: number;
  
  /** Consistency score across similar resources (0-100) */
  resourceConsistency: number;
  
  /** Consistency score across validation aspects (0-100) */
  aspectConsistency: number;
  
  /** Standard deviation of validation scores */
  scoreStandardDeviation: number;
  
  /** Coefficient of variation */
  coefficientOfVariation: number;
  
  /** Number of inconsistent validations */
  inconsistentValidations: number;
  
  /** Overall consistency score (0-100) */
  consistencyScore: number;
}

/**
 * Validation performance metrics
 */
export interface ValidationPerformanceMetrics {
  /** Average validation time per resource (ms) */
  averageValidationTime: number;
  
  /** Median validation time per resource (ms) */
  medianValidationTime: number;
  
  /** 95th percentile validation time (ms) */
  p95ValidationTime: number;
  
  /** Throughput (resources per minute) */
  throughput: number;
  
  /** Resource utilization efficiency */
  resourceUtilization: number;
  
  /** Memory efficiency */
  memoryEfficiency: number;
  
  /** Performance score (0-100) */
  performanceScore: number;
  
  /** Performance bottlenecks identified */
  bottlenecks: string[];
}

/**
 * Validation reliability metrics
 */
export interface ValidationReliabilityMetrics {
  /** System uptime percentage */
  uptime: number;
  
  /** Error rate percentage */
  errorRate: number;
  
  /** Recovery time after failures (ms) */
  recoveryTime: number;
  
  /** Retry success rate */
  retrySuccessRate: number;
  
  /** Data integrity score */
  dataIntegrity: number;
  
  /** Reliability score (0-100) */
  reliabilityScore: number;
  
  /** Known reliability issues */
  reliabilityIssues: string[];
}

/**
 * Quality metrics for a specific validation aspect
 */
export interface ValidationAspectQuality {
  /** Aspect name */
  aspect: string;
  
  /** Quality score for this aspect (0-100) */
  qualityScore: number;
  
  /** Number of issues found */
  issueCount: number;
  
  /** Issue severity distribution */
  issueSeverityDistribution: {
    fatal: number;
    error: number;
    warning: number;
    information: number;
  };
  
  /** Coverage percentage */
  coverage: number;
  
  /** Accuracy for this aspect */
  accuracy: number;
  
  /** Performance metrics for this aspect */
  performance: {
    averageTime: number;
    totalTime: number;
    throughput: number;
  };
  
  /** Quality trends for this aspect */
  trends: ValidationAspectQualityTrend[];
}

/**
 * Quality trend data point
 */
export interface ValidationQualityTrend {
  /** Timestamp of the measurement */
  timestamp: Date;
  
  /** Overall quality score */
  qualityScore: number;
  
  /** Accuracy score */
  accuracyScore: number;
  
  /** Completeness score */
  completenessScore: number;
  
  /** Consistency score */
  consistencyScore: number;
  
  /** Performance score */
  performanceScore: number;
  
  /** Reliability score */
  reliabilityScore: number;
  
  /** Number of resources validated */
  resourcesValidated: number;
  
  /** Validation duration */
  duration: number;
}

/**
 * Quality trend for a specific aspect
 */
export interface ValidationAspectQualityTrend {
  /** Timestamp of the measurement */
  timestamp: Date;
  
  /** Quality score for this aspect */
  qualityScore: number;
  
  /** Issue count */
  issueCount: number;
  
  /** Coverage percentage */
  coverage: number;
  
  /** Performance metrics */
  performance: {
    averageTime: number;
    throughput: number;
  };
}

/**
 * Quality recommendation
 */
export interface ValidationQualityRecommendation {
  /** Recommendation ID */
  id: string;
  
  /** Recommendation type */
  type: 'accuracy' | 'completeness' | 'consistency' | 'performance' | 'reliability' | 'general';
  
  /** Priority level */
  priority: 'low' | 'medium' | 'high' | 'critical';
  
  /** Recommendation title */
  title: string;
  
  /** Detailed recommendation description */
  description: string;
  
  /** Expected impact on quality score */
  expectedImpact: number;
  
  /** Implementation effort */
  effort: 'low' | 'medium' | 'high';
  
  /** Related validation aspects */
  relatedAspects: string[];
  
  /** Action items */
  actionItems: string[];
  
  /** Estimated implementation time */
  estimatedTime?: string;
}

/**
 * Validation quality configuration
 */
export interface ValidationQualityConfig {
  /** Quality thresholds */
  thresholds: {
    excellent: number; // >= 90
    good: number;      // >= 80
    acceptable: number; // >= 70
    poor: number;      // >= 60
    // < 60 is considered unacceptable
  };
  
  /** Quality weights for overall score calculation */
  weights: {
    accuracy: number;
    completeness: number;
    consistency: number;
    performance: number;
    reliability: number;
  };
  
  /** Minimum sample size for reliable metrics */
  minSampleSize: number;
  
  /** Quality trend analysis window (days) */
  trendAnalysisWindow: number;
  
  /** Enable quality recommendations */
  enableRecommendations: boolean;
  
  /** Quality monitoring interval (minutes) */
  monitoringInterval: number;
}

/**
 * Validation quality report
 */
export interface ValidationQualityReport {
  /** Report generation timestamp */
  generatedAt: Date;
  
  /** Report period */
  period: {
    start: Date;
    end: Date;
  };
  
  /** Overall quality metrics */
  qualityMetrics: ValidationQualityMetrics;
  
  /** Quality grade (A, B, C, D, F) */
  qualityGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  
  /** Quality status */
  status: 'excellent' | 'good' | 'acceptable' | 'poor' | 'unacceptable';
  
  /** Key findings */
  keyFindings: string[];
  
  /** Quality trends summary */
  trendsSummary: string;
  
  /** Top recommendations */
  topRecommendations: ValidationQualityRecommendation[];
  
  /** Quality benchmarks comparison */
  benchmarkComparison: {
    current: ValidationQualityMetrics;
    benchmark: ValidationQualityMetrics;
    improvement: number;
  };
  
  /** Resource type quality breakdown */
  resourceTypeQuality: Record<string, ValidationQualityMetrics>;
  
  /** Quality history */
  qualityHistory: ValidationQualityTrend[];
}

// ============================================================================
// Validation Confidence Scoring
// ============================================================================

/**
 * Validation confidence factors
 */
export interface ValidationConfidenceFactors {
  /** Completeness of validation aspects covered */
  aspectCompleteness: number;
  
  /** Quality of validation data sources */
  dataSourceQuality: number;
  
  /** Consistency of validation results */
  resultConsistency: number;
  
  /** Validation rule coverage */
  ruleCoverage: number;
  
  /** Historical accuracy of similar validations */
  historicalAccuracy: number;
  
  /** Validation engine reliability */
  engineReliability: number;
  
  /** Resource complexity factor */
  resourceComplexity: number;
  
  /** External dependency reliability */
  externalDependencyReliability: number;
}

/**
 * Validation confidence issues
 */
export interface ValidationConfidenceIssue {
  /** Issue type */
  type: 'missing_data' | 'incomplete_validation' | 'external_dependency_failure' | 'rule_ambiguity' | 'historical_inconsistency';
  
  /** Issue description */
  description: string;
  
  /** Impact on confidence (0-100) */
  confidenceImpact: number;
  
  /** Severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';
  
  /** Related validation aspect */
  relatedAspect?: string;
  
  /** Suggested resolution */
  resolution?: string;
}

/**
 * Validation confidence metrics
 */
export interface ValidationConfidenceMetrics {
  /** Overall confidence score (0-100) */
  confidenceScore: number;
  
  /** Confidence level category */
  confidenceLevel: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  
  /** Individual confidence factors */
  confidenceFactors: ValidationConfidenceFactors;
  
  /** Issues that reduce confidence */
  confidenceIssues: ValidationConfidenceIssue[];
  
  /** Validation certainty (0-100) */
  validationCertainty: number;
  
  /** Confidence trend over time */
  confidenceTrend: 'improving' | 'stable' | 'declining' | 'unknown';
  
  /** Confidence explanation */
  explanation: string;
  
  /** Recommendations for improving confidence */
  recommendations: string[];
}

/**
 * Validation result with confidence scoring
 */
export interface ValidationResultWithConfidence {
  /** Standard validation result */
  validationResult: any; // Base validation result
  
  /** Confidence metrics */
  confidence: ValidationConfidenceMetrics;
  
  /** Whether confidence is sufficient for the use case */
  confidenceSufficient: boolean;
  
  /** Recommended actions based on confidence */
  recommendedActions: ValidationConfidenceAction[];
}

/**
 * Recommended action based on confidence level
 */
export interface ValidationConfidenceAction {
  /** Action type */
  type: 'review_manually' | 'seek_additional_validation' | 'trust_result' | 'investigate_further' | 'retry_validation';
  
  /** Action description */
  description: string;
  
  /** Priority level */
  priority: 'low' | 'medium' | 'high' | 'critical';
  
  /** Expected impact on confidence */
  expectedConfidenceImprovement: number;
  
  /** Action cost/effort */
  effort: 'low' | 'medium' | 'high';
}

// ============================================================================
// Validation Completeness Indicators
// ============================================================================

/**
 * Validation completeness factors
 */
export interface ValidationCompletenessFactors {
  /** Aspect completeness score (0-100) */
  aspectCompleteness: number;
  
  /** Field coverage score (0-100) */
  fieldCoverage: number;
  
  /** Rule coverage score (0-100) */
  ruleCoverage: number;
  
  /** Profile compliance score (0-100) */
  profileCompliance: number;
  
  /** Terminology validation coverage (0-100) */
  terminologyCoverage: number;
  
  /** Reference validation coverage (0-100) */
  referenceCoverage: number;
  
  /** Business rule coverage (0-100) */
  businessRuleCoverage: number;
  
  /** Metadata validation coverage (0-100) */
  metadataCoverage: number;
}

/**
 * Coverage metrics for validation aspects
 */
export interface ValidationCoverageMetrics {
  /** Overall coverage percentage */
  overallCoverage: number;
  
  /** Coverage by validation aspect */
  aspectCoverage: Record<string, {
    coverage: number;
    totalFields: number;
    validatedFields: number;
    skippedFields: number;
    missingFields: string[];
  }>;
  
  /** Coverage by field type */
  fieldTypeCoverage: Record<string, {
    coverage: number;
    totalFields: number;
    validatedFields: number;
    requiredFields: number;
    optionalFields: number;
  }>;
  
  /** Coverage by resource section */
  sectionCoverage: Record<string, {
    coverage: number;
    totalSections: number;
    validatedSections: number;
    missingSections: string[];
  }>;
}

/**
 * Missing validation area
 */
export interface MissingValidationArea {
  /** Area type */
  type: 'aspect' | 'field' | 'rule' | 'profile' | 'terminology' | 'reference' | 'business_rule' | 'metadata';
  
  /** Area identifier */
  identifier: string;
  
  /** Area description */
  description: string;
  
  /** Impact on completeness (0-100) */
  impact: number;
  
  /** Severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';
  
  /** Reason for missing validation */
  reason: 'not_enabled' | 'not_available' | 'validation_failed' | 'configuration_error' | 'resource_limitation';
  
  /** Suggested resolution */
  resolution?: string;
  
  /** Related validation aspect */
  relatedAspect?: string;
}

/**
 * Validation gap
 */
export interface ValidationGap {
  /** Gap ID */
  id: string;
  
  /** Gap type */
  type: 'missing_field' | 'incomplete_validation' | 'unvalidated_section' | 'missing_rule' | 'profile_mismatch';
  
  /** Gap description */
  description: string;
  
  /** Resource path where gap occurs */
  path: string[];
  
  /** Gap severity */
  severity: 'low' | 'medium' | 'high' | 'critical';
  
  /** Impact on validation completeness */
  completenessImpact: number;
  
  /** Suggested fix */
  suggestedFix: string;
  
  /** Whether gap can be automatically resolved */
  autoResolvable: boolean;
  
  /** Related validation aspect */
  relatedAspect: string;
}

/**
 * Validation completeness metrics
 */
export interface ValidationCompletenessMetrics {
  /** Overall completeness score (0-100) */
  completenessScore: number;
  
  /** Completeness level category */
  completenessLevel: 'incomplete' | 'partial' | 'mostly_complete' | 'complete' | 'fully_complete';
  
  /** Individual completeness factors */
  completenessFactors: ValidationCompletenessFactors;
  
  /** Coverage metrics */
  coverageMetrics: ValidationCoverageMetrics;
  
  /** Missing validation areas */
  missingValidationAreas: MissingValidationArea[];
  
  /** Validation gaps */
  validationGaps: ValidationGap[];
  
  /** Completeness trend over time */
  completenessTrend: 'improving' | 'stable' | 'declining' | 'unknown';
  
  /** Completeness explanation */
  explanation: string;
  
  /** Recommendations for improving completeness */
  recommendations: string[];
  
  /** Estimated effort to achieve full completeness */
  estimatedEffort: 'low' | 'medium' | 'high' | 'very_high';
}

/**
 * Validation result with completeness indicators
 */
export interface ValidationResultWithCompleteness {
  /** Standard validation result */
  validationResult: any; // Base validation result
  
  /** Completeness metrics */
  completeness: ValidationCompletenessMetrics;
  
  /** Whether completeness is sufficient for the use case */
  completenessSufficient: boolean;
  
  /** Recommended actions to improve completeness */
  recommendedActions: ValidationCompletenessAction[];
}

/**
 * Recommended action for improving completeness
 */
export interface ValidationCompletenessAction {
  /** Action type */
  type: 'enable_aspect' | 'validate_field' | 'add_rule' | 'update_profile' | 'fix_configuration' | 'manual_review';
  
  /** Action description */
  description: string;
  
  /** Priority level */
  priority: 'low' | 'medium' | 'high' | 'critical';
  
  /** Expected impact on completeness */
  expectedCompletenessImprovement: number;
  
  /** Action cost/effort */
  effort: 'low' | 'medium' | 'high';
  
  /** Whether action can be automated */
  automatable: boolean;
  
  /** Related validation aspect */
  relatedAspect?: string;
  
  /** Implementation steps */
  implementationSteps?: string[];
}

// ============================================================================
// UI Component Types
// ============================================================================

/**
 * Enhanced validation badge props for UI components
 */
export interface EnhancedValidationBadgeProps {
  validationResult: any; // DetailedValidationResult from schema
  showDetails?: boolean;
  compact?: boolean;
  className?: string;
}

/**
 * Validation issue for UI display
 */
export interface ValidationIssue {
  id?: string;
  aspect: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  path?: string;
  code?: string;
  details?: string;
  suggestions?: string[];
  timestamp?: Date;
}

/**
 * Validation result for UI display
 */
export interface ValidationResult {
  resourceId: string;
  resourceType: string;
  isValid: boolean;
  issues: ValidationIssue[];
  aspects: any[]; // AspectValidationResult from schema
  validatedAt: Date;
  validationTime: number;
  overallScore?: number;
  confidence?: number;
}

/**
 * Enhanced validation summary for UI display
 */
export interface EnhancedValidationSummary {
  resourceId: string;
  resourceType: string;
  overallScore: number;
  confidence: number;
  status: 'valid' | 'warning' | 'invalid';
  aspectBreakdown: {
    structural: { score: number; confidence: number; issues: number };
    profile: { score: number; confidence: number; issues: number };
    terminology: { score: number; confidence: number; issues: number };
    reference: { score: number; confidence: number; issues: number };
    businessRule: { score: number; confidence: number; issues: number };
    metadata: { score: number; confidence: number; issues: number };
  };
  totalIssues: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  validatedAt: Date;
  validationTime: number;
}

// Note: ValidationProgress is already defined above in the main types section
