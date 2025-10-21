/**
 * Business Rules Database Schema
 * Task 9.8: Implement rule storage in database with versioning
 */

import { pgTable, text, timestamp, boolean, integer, jsonb, index } from 'drizzle-orm/pg-core';

/**
 * Business rules table
 * Stores custom FHIRPath validation rules with versioning
 */
export const businessRules = pgTable(
  'business_rules',
  {
    // Primary key
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    
    // Rule identifier
    ruleId: text('rule_id').notNull().unique(),

    // Rule metadata
    name: text('name').notNull(),
    description: text('description'),
    category: text('category'),

    // FHIRPath expression
    expression: text('expression').notNull(),

    // Target configuration
    resourceTypes: text('resource_types').array().notNull(),
    fhirVersions: text('fhir_versions').array(),
    
    // Severity and status
    severity: text('severity').notNull().default('error'),
    enabled: boolean('enabled').default(true),

    // Versioning
    version: text('version').notNull().default('1.0.0'),
    previousVersionId: text('previous_version_id'),

    // Audit fields
    createdAt: timestamp('created_at').defaultNow(),
    createdBy: text('created_by'),
    updatedAt: timestamp('updated_at').defaultNow(),
    updatedBy: text('updated_by'),

    // Validation message and suggestions
    validationMessage: text('validation_message'),
    suggestions: text('suggestions').array(),

    // Execution metrics
    executionCount: integer('execution_count').default(0),
    lastExecutedAt: timestamp('last_executed_at'),
    avgExecutionTimeMs: integer('avg_execution_time_ms'),

    // Additional metadata
    tags: text('tags').array(),
    
    // Soft delete
    deletedAt: timestamp('deleted_at'),
  },
  (table) => ({
    // Indexes for efficient querying
    ruleIdIdx: index('idx_business_rules_rule_id').on(table.ruleId),
    categoryIdx: index('idx_business_rules_category').on(table.category),
    enabledIdx: index('idx_business_rules_enabled').on(table.enabled),
    deletedAtIdx: index('idx_business_rules_deleted_at').on(table.deletedAt),
  })
);

/**
 * Rule execution history table
 * Tracks when rules are executed and their performance
 */
export const ruleExecutionHistory = pgTable(
  'rule_execution_history',
  {
    id: text('id').primaryKey(),
    ruleId: text('rule_id').notNull().references(() => businessRules.id),
    
    // Execution details
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id'),
    
    // Result
    passed: boolean('passed').notNull(),
    result: jsonb('result').$type<any>(),
    errorMessage: text('error_message'),
    
    // Performance
    executionTimeMs: integer('execution_time_ms'),
    
    // Timestamp
    executedAt: timestamp('executed_at').notNull().defaultNow(),
  },
  (table) => ({
    ruleIdIdx: index('rule_execution_history_rule_id_idx').on(table.ruleId),
    executedAtIdx: index('rule_execution_history_executed_at_idx').on(table.executedAt),
    resourceTypeIdx: index('rule_execution_history_resource_type_idx').on(table.resourceType),
  })
);

/**
 * Rule version history table
 * Maintains complete version history of rule changes
 */
export const ruleVersionHistory = pgTable(
  'rule_version_history',
  {
    id: text('id').primaryKey(),
    ruleId: text('rule_id').notNull(),
    
    // Snapshot of rule at this version
    version: text('version').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    fhirPathExpression: text('fhirpath_expression').notNull(),
    resourceTypes: jsonb('resource_types').notNull().$type<string[]>(),
    severity: text('severity').notNull(),
    category: text('category').notNull(),
    
    // Change tracking
    changeDescription: text('change_description'),
    changedBy: text('changed_by'),
    changedAt: timestamp('changed_at').notNull().defaultNow(),
    
    // Snapshot metadata
    snapshot: jsonb('snapshot').$type<Record<string, any>>(),
  },
  (table) => ({
    ruleIdIdx: index('rule_version_history_rule_id_idx').on(table.ruleId),
    versionIdx: index('rule_version_history_version_idx').on(table.version),
    changedAtIdx: index('rule_version_history_changed_at_idx').on(table.changedAt),
  })
);

/**
 * Type exports for use in application
 */
export type BusinessRule = typeof businessRules.$inferSelect;
export type NewBusinessRule = typeof businessRules.$inferInsert;
export type RuleExecutionHistory = typeof ruleExecutionHistory.$inferSelect;
export type NewRuleExecutionHistory = typeof ruleExecutionHistory.$inferInsert;
export type RuleVersionHistory = typeof ruleVersionHistory.$inferSelect;
export type NewRuleVersionHistory = typeof ruleVersionHistory.$inferInsert;


