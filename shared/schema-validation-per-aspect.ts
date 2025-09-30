import { pgTable, text, serial, integer, boolean, jsonb, timestamp, varchar, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { fhirServers } from "./schema";

/**
 * Per-aspect validation results table
 * Stores validation results for each aspect (structural, profile, terminology, reference, businessRule, metadata)
 * Each resource can have multiple rows (one per aspect)
 */
export const validationResultsPerAspect = pgTable("validation_results_per_aspect", {
  id: serial("id").primaryKey(),
  
  // Resource identification (cross-server stable)
  serverId: integer("server_id").references(() => fhirServers.id).notNull(),
  resourceType: text("resource_type").notNull(),
  fhirId: text("fhir_id").notNull(), // The FHIR resource ID
  
  // Aspect identification
  aspect: varchar("aspect", { length: 50 }).notNull(), // 'structural' | 'profile' | 'terminology' | 'reference' | 'businessRule' | 'metadata'
  
  // Validation result
  isValid: boolean("is_valid").notNull(),
  
  // Severity counts
  errorCount: integer("error_count").default(0).notNull(),
  warningCount: integer("warning_count").default(0).notNull(),
  informationCount: integer("information_count").default(0).notNull(),
  
  // Score (0-100)
  score: integer("score").default(0).notNull(),
  
  // Settings snapshot for deterministic invalidation
  settingsSnapshotHash: varchar("settings_snapshot_hash", { length: 64 }).notNull(), // SHA-256 hash
  
  // Timestamps
  validatedAt: timestamp("validated_at").defaultNow().notNull(),
  
  // Metadata
  durationMs: integer("duration_ms").default(0),
  validationEngineVersion: varchar("validation_engine_version", { length: 20 }).default("1.0.0"),
  
  // Optional: Store detailed result for quick access
  detailedResult: jsonb("detailed_result").default({}),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  // Composite index for resource identity + aspect queries
  resourceAspectIdx: index("validation_results_resource_aspect_idx").on(
    table.serverId,
    table.resourceType,
    table.fhirId,
    table.aspect
  ),
  // Index for aspect + severity filtering
  aspectSeverityIdx: index("validation_results_aspect_severity_idx").on(
    table.serverId,
    table.aspect,
    table.errorCount,
    table.warningCount
  ),
  // Index for time-based queries
  validatedAtIdx: index("validation_results_validated_at_idx").on(table.validatedAt),
  // Unique constraint: one result per resource per aspect per settings snapshot
  uniqueResourceAspectSnapshot: uniqueIndex("validation_results_unique_resource_aspect").on(
    table.serverId,
    table.resourceType,
    table.fhirId,
    table.aspect,
    table.settingsSnapshotHash
  ),
}));

/**
 * Normalized validation messages with signatures for grouping
 * Stores individual validation messages with normalized paths and text
 */
export const validationMessages = pgTable("validation_messages", {
  id: serial("id").primaryKey(),
  
  // Link to validation result
  validationResultId: integer("validation_result_id")
    .references(() => validationResultsPerAspect.id, { onDelete: "cascade" })
    .notNull(),
  
  // Resource identification (denormalized for query performance)
  serverId: integer("server_id").references(() => fhirServers.id).notNull(),
  resourceType: text("resource_type").notNull(),
  fhirId: text("fhir_id").notNull(),
  aspect: varchar("aspect", { length: 50 }).notNull(),
  
  // Message content
  severity: varchar("severity", { length: 20 }).notNull(), // 'error' | 'warning' | 'information'
  code: varchar("code", { length: 100 }), // Optional error code
  canonicalPath: varchar("canonical_path", { length: 256 }).notNull(), // Normalized path (no array indices)
  text: text("text").notNull(), // Message text
  normalizedText: varchar("normalized_text", { length: 512 }).notNull(), // Normalized for grouping
  
  // Optional rule identification
  ruleId: varchar("rule_id", { length: 100 }),
  
  // Signature for grouping (SHA-256 of normalized components)
  signature: varchar("signature", { length: 64 }).notNull(), // SHA-256 hash
  signatureVersion: integer("signature_version").default(1).notNull(), // Version for signature algorithm changes
  
  // Truncation flags
  pathTruncated: boolean("path_truncated").default(false),
  textTruncated: boolean("text_truncated").default(false),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  // Index for signature-based grouping queries (most important)
  signatureIdx: index("validation_messages_signature_idx").on(
    table.serverId,
    table.signature
  ),
  // Index for aspect + severity filtering
  aspectSeverityIdx: index("validation_messages_aspect_severity_idx").on(
    table.serverId,
    table.aspect,
    table.severity
  ),
  // Index for resource messages queries
  resourceIdx: index("validation_messages_resource_idx").on(
    table.serverId,
    table.resourceType,
    table.fhirId
  ),
}));

/**
 * Optional: Message groups for caching group counts
 * Incrementally updated during validation writes for fast groups API
 */
export const validationMessageGroups = pgTable("validation_message_groups", {
  id: serial("id").primaryKey(),
  
  serverId: integer("server_id").references(() => fhirServers.id).notNull(),
  
  // Group identification
  signature: varchar("signature", { length: 64 }).notNull(),
  signatureVersion: integer("signature_version").default(1).notNull(),
  
  // Group metadata
  aspect: varchar("aspect", { length: 50 }).notNull(),
  severity: varchar("severity", { length: 20 }).notNull(),
  code: varchar("code", { length: 100 }),
  canonicalPath: varchar("canonical_path", { length: 256 }).notNull(),
  sampleText: text("sample_text").notNull(), // First message text as sample
  
  // Counts (incrementally updated)
  totalResources: integer("total_resources").default(0).notNull(),
  
  // Timestamps
  firstSeenAt: timestamp("first_seen_at").defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  // Unique constraint: one group per signature per server
  uniqueServerSignature: uniqueIndex("validation_message_groups_unique_server_signature").on(
    table.serverId,
    table.signature
  ),
  // Index for filtering
  aspectSeverityIdx: index("validation_message_groups_aspect_severity_idx").on(
    table.serverId,
    table.aspect,
    table.severity
  ),
}));

// Insert schemas
export const insertValidationResultPerAspectSchema = createInsertSchema(validationResultsPerAspect).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertValidationMessageSchema = createInsertSchema(validationMessages).omit({
  id: true,
  createdAt: true,
});

export const insertValidationMessageGroupSchema = createInsertSchema(validationMessageGroups).omit({
  id: true,
  firstSeenAt: true,
  lastSeenAt: true,
  updatedAt: true,
});

// Types
export type ValidationResultPerAspect = typeof validationResultsPerAspect.$inferSelect;
export type InsertValidationResultPerAspect = z.infer<typeof insertValidationResultPerAspectSchema>;

export type ValidationMessage = typeof validationMessages.$inferSelect;
export type InsertValidationMessage = z.infer<typeof insertValidationMessageSchema>;

export type ValidationMessageGroup = typeof validationMessageGroups.$inferSelect;
export type InsertValidationMessageGroup = z.infer<typeof insertValidationMessageGroupSchema>;

// Validation aspects enum (for type safety)
export const ValidationAspect = {
  STRUCTURAL: 'structural',
  PROFILE: 'profile',
  TERMINOLOGY: 'terminology',
  REFERENCE: 'reference',
  BUSINESS_RULE: 'businessRule',
  METADATA: 'metadata',
} as const;

export type ValidationAspectType = typeof ValidationAspect[keyof typeof ValidationAspect];

// Severity enum
export const ValidationSeverity = {
  ERROR: 'error',
  WARNING: 'warning',
  INFORMATION: 'information',
} as const;

export type ValidationSeverityType = typeof ValidationSeverity[keyof typeof ValidationSeverity];
