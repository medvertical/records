import { pgTable, text, serial, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const fhirServers = pgTable("fhir_servers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  isActive: boolean("is_active").default(false),
  authConfig: jsonb("auth_config"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const fhirResources = pgTable("fhir_resources", {
  id: serial("id").primaryKey(),
  serverId: integer("server_id").references(() => fhirServers.id),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id").notNull(),
  versionId: text("version_id"),
  data: jsonb("data").notNull(),
  resourceHash: text("resource_hash"),
  lastValidated: timestamp("last_validated"),
  lastModified: timestamp("last_modified").defaultNow(),
});

export const validationProfiles = pgTable("validation_profiles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  title: text("title"),
  description: text("description"),
  version: text("version"),
  url: text("url").notNull(),
  resourceType: text("resource_type").notNull(),
  packageId: text("package_id"),
  packageVersion: text("package_version"),
  status: text("status").default("active"),
  profileData: jsonb("profile_data"),
  config: jsonb("config"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const validationResults = pgTable("validation_results", {
  id: serial("id").primaryKey(),
  resourceId: integer("resource_id").references(() => fhirResources.id), // Keep for backward compatibility
  // FHIR identity fields for stable resource identification
  serverId: integer("server_id").references(() => fhirServers.id),
  resourceType: text("resource_type").notNull(),
  fhirResourceId: text("fhir_resource_id").notNull(),
  profileId: integer("profile_id").references(() => validationProfiles.id),
  isValid: boolean("is_valid").notNull(),
  errors: jsonb("errors").default([]),
  warnings: jsonb("warnings").default([]),
  issues: jsonb("issues").default([]),
  profileUrl: text("profile_url"),
  errorCount: integer("error_count").default(0),
  warningCount: integer("warning_count").default(0),
  validationScore: integer("validation_score").default(0),
  validatedAt: timestamp("validated_at").defaultNow(),
  // Enhanced caching and persistence fields
  settingsHash: text("settings_hash"),
  settingsVersion: integer("settings_version").default(1),
  resourceHash: text("resource_hash"),
  validationEngineVersion: text("validation_engine_version").default("1.0.0"),
  performanceMetrics: jsonb("performance_metrics").default({}),
  aspectBreakdown: jsonb("aspect_breakdown").default({}),
  validationDurationMs: integer("validation_duration_ms").default(0),
  // Retry tracking fields
  retryAttemptCount: integer("retry_attempt_count").default(0),
  maxRetryAttempts: integer("max_retry_attempts").default(1),
  isRetry: boolean("is_retry").default(false),
  retryInfo: jsonb("retry_info").default({}),
  canRetry: boolean("can_retry").default(true),
  retryReason: text("retry_reason"),
  totalRetryDurationMs: integer("total_retry_duration_ms").default(0),
  // Confidence scoring fields
  confidenceScore: integer("confidence_score").default(0), // 0-100 confidence level
  confidenceFactors: jsonb("confidence_factors").default({}), // Factors affecting confidence
  confidenceLevel: text("confidence_level").default("unknown"), // low, medium, high, very_high
  confidenceIssues: jsonb("confidence_issues").default([]), // Issues that reduce confidence
  validationCertainty: integer("validation_certainty").default(0), // Certainty of validation result
  // Validation completeness fields
  completenessScore: integer("completeness_score").default(0), // Overall completeness score (0-100)
  completenessFactors: jsonb("completeness_factors").default({}), // Individual completeness factors
  coverageMetrics: jsonb("coverage_metrics").default({}), // Coverage metrics by aspect and field
  missingValidationAreas: jsonb("missing_validation_areas").default([]), // Areas not validated
  validationGaps: jsonb("validation_gaps").default([]), // Specific validation gaps identified
  // Consolidated service fields
  validationRequestId: text("validation_request_id"),
  validationBatchId: text("validation_batch_id"),
  validationPriority: text("validation_priority").default("normal"), // 'low', 'normal', 'high', 'urgent'
  validationStatus: text("validation_status").default("completed"), // 'pending', 'running', 'completed', 'failed', 'cancelled'
  validationStartedAt: timestamp("validation_started_at"),
  validationCompletedAt: timestamp("validation_completed_at"),
  validationCancelledAt: timestamp("validation_cancelled_at"),
  validationErrorMessage: text("validation_error_message"),
  validationErrorDetails: jsonb("validation_error_details").default({}),
  // Detailed aspect results
  structuralValidationResult: jsonb("structural_validation_result").default({}),
  profileValidationResult: jsonb("profile_validation_result").default({}),
  terminologyValidationResult: jsonb("terminology_validation_result").default({}),
  referenceValidationResult: jsonb("reference_validation_result").default({}),
  businessRuleValidationResult: jsonb("business_rule_validation_result").default({}),
  metadataValidationResult: jsonb("metadata_validation_result").default({}),
  // Validation settings reference
  validationSettingsId: integer("validation_settings_id").references(() => validationSettings.id),
  validationSettingsSnapshot: jsonb("validation_settings_snapshot").default({}),
  // Resource metadata
  resourceVersion: text("resource_version"),
  resourceSizeBytes: integer("resource_size_bytes"),
  resourceComplexityScore: integer("resource_complexity_score").default(0),
  // Validation context
  validationContext: jsonb("validation_context").default({}),
  validationEnvironment: text("validation_environment").default("production"), // 'development', 'testing', 'production'
  validationSource: text("validation_source").default("api"), // 'api', 'batch', 'scheduled', 'manual'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const dashboardCards = pgTable("dashboard_cards", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  type: text("type").notNull(), // 'chart', 'table', 'stat'
  config: jsonb("config").notNull(),
  position: integer("position").notNull(),
  isVisible: boolean("is_visible").default(true),
});

export const validationSettings = pgTable("validation_settings", {
  id: serial("id").primaryKey(),
  version: integer("version").notNull().default(1),
  settings: jsonb("settings").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
});

export const validationSettingsAuditTrail = pgTable("validation_settings_audit_trail", {
  id: serial("id").primaryKey(),
  settingsId: integer("settings_id").references(() => validationSettings.id),
  version: integer("version").notNull(),
  action: text("action").notNull(), // 'created', 'updated', 'activated', 'deactivated', 'deleted', 'migrated', 'rolled_back'
  performedBy: text("performed_by"),
  performedAt: timestamp("performed_at").defaultNow(),
  changeReason: text("change_reason"),
  changes: jsonb("changes").notNull(), // Detailed change information
  metadata: jsonb("metadata"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
});

// Legacy validation settings table for migration
export const legacyValidationSettings = pgTable("legacy_validation_settings", {
  id: serial("id").primaryKey(),
  enableStructuralValidation: boolean("enable_structural_validation").default(true),
  enableProfileValidation: boolean("enable_profile_validation").default(true),
  enableTerminologyValidation: boolean("enable_terminology_validation").default(true),
  enableReferenceValidation: boolean("enable_reference_validation").default(true),
  enableBusinessRuleValidation: boolean("enable_business_rule_validation").default(true),
  enableMetadataValidation: boolean("enable_metadata_validation").default(true),
  strictMode: boolean("strict_mode").default(false),
  validationProfiles: jsonb("validation_profiles").default([]),
  terminologyServers: jsonb("terminology_servers").default([]),
  profileResolutionServers: jsonb("profile_resolution_servers").default([]),
  config: jsonb("config").default({}),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas
export const insertFhirServerSchema = createInsertSchema(fhirServers).omit({
  id: true,
  createdAt: true,
});

export const insertFhirResourceSchema = createInsertSchema(fhirResources).omit({
  id: true,
});

export const insertValidationProfileSchema = createInsertSchema(validationProfiles).omit({
  id: true,
  createdAt: true,
});

export const insertValidationResultSchema = createInsertSchema(validationResults).omit({
  id: true,
});

export const insertValidationSettingsSchema = createInsertSchema(validationSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertValidationSettingsAuditTrailSchema = createInsertSchema(validationSettingsAuditTrail).omit({
  id: true,
  performedAt: true,
});

export const insertDashboardCardSchema = createInsertSchema(dashboardCards).omit({
  id: true,
});



// Types
export type FhirServer = typeof fhirServers.$inferSelect;
export type InsertFhirServer = z.infer<typeof insertFhirServerSchema>;

export type FhirResource = typeof fhirResources.$inferSelect;
export type InsertFhirResource = z.infer<typeof insertFhirResourceSchema>;

export type ValidationProfile = typeof validationProfiles.$inferSelect;
export type InsertValidationProfile = z.infer<typeof insertValidationProfileSchema>;

export type ValidationResult = typeof validationResults.$inferSelect;
export type InsertValidationResult = z.infer<typeof insertValidationResultSchema>;

export type DashboardCard = typeof dashboardCards.$inferSelect;
export type InsertDashboardCard = z.infer<typeof insertDashboardCardSchema>;

export type ValidationSettings = typeof validationSettings.$inferSelect;
export type InsertValidationSettings = z.infer<typeof insertValidationSettingsSchema>;

export type ValidationSettingsAuditTrail = typeof validationSettingsAuditTrail.$inferSelect;
export type InsertValidationSettingsAuditTrail = z.infer<typeof insertValidationSettingsAuditTrailSchema>;

// Additional types for FHIR resources
export interface FhirResourceWithValidation extends FhirResource {
  validationResults?: ValidationResult[];
}

export interface ValidationError {
  severity: 'error' | 'warning' | 'information';
  message: string;
  path: string;
  expression?: string;
  code?: string;
  category?: 'structural' | 'profile' | 'terminology' | 'reference' | 'businessRule' | 'metadata';
  resolutionStatus?: 'unresolved' | 'acknowledged' | 'resolved' | 'ignored';
  resolutionNotes?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

export interface ResourceStats {
  totalResources: number;
  validResources: number;
  errorResources: number;
  warningResources: number;
  unvalidatedResources: number;
  activeProfiles: number;
  resourceBreakdown: Record<string, {
    total: number;
    valid: number;
    validPercent: number;
  }>;
  aspectBreakdown: Record<string, {
    enabled: boolean;
    issueCount: number;
    errorCount: number;
    warningCount: number;
    informationCount: number;
    score: number;
  }>;
}

// Additional types for consolidated validation service
export interface ValidationRequest {
  id: string;
  batchId?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  resourceIds: number[];
  settingsId?: number;
  settingsSnapshot?: any;
  context?: any;
  environment: 'development' | 'testing' | 'production';
  source: 'api' | 'batch' | 'scheduled' | 'manual';
  startedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  errorMessage?: string;
  errorDetails?: any;
}

export interface ValidationBatch {
  id: string;
  name?: string;
  description?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  totalResources: number;
  completedResources: number;
  failedResources: number;
  cancelledResources: number;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  settingsId?: number;
  context?: any;
  environment: 'development' | 'testing' | 'production';
  source: 'api' | 'batch' | 'scheduled' | 'manual';
  startedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  errorMessage?: string;
  errorDetails?: any;
}

export interface AspectValidationResult {
  isValid: boolean;
  issues: ValidationError[];
  durationMs: number;
  score: number;
  confidence: number;
  completeness: number;
  details?: any;
}

export interface DetailedValidationResult {
  isValid: boolean;
  overallScore: number;
  overallConfidence: number;
  overallCompleteness: number;
  totalDurationMs: number;
  aspectResults: {
    structural: AspectValidationResult;
    profile: AspectValidationResult;
    terminology: AspectValidationResult;
    reference: AspectValidationResult;
    businessRule: AspectValidationResult;
    metadata: AspectValidationResult;
  };
  summary: {
    totalIssues: number;
    errorCount: number;
    warningCount: number;
    informationCount: number;
    issueCountByAspect: Record<string, number>;
  };
  performance: {
    totalDurationMs: number;
    durationByAspect: Record<string, number>;
    resourceSizeBytes?: number;
    complexityScore?: number;
  };
  context?: any;
}
