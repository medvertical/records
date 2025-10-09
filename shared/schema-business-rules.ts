/**
 * Business Rules Schema
 * 
 * Task 6.4: Drizzle schema for business_rules table
 * 
 * Database schema for custom FHIRPath business rules
 */

import { pgTable, serial, varchar, text, boolean, timestamp, integer, numeric } from 'drizzle-orm/pg-core';
import { InferSelectModel, InferInsertModel } from 'drizzle-orm';

// ============================================================================
// Business Rules Table
// ============================================================================

export const businessRules = pgTable('business_rules', {
  id: serial('id').primaryKey(),
  
  // Rule Identification
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  ruleId: varchar('rule_id', { length: 100 }).notNull().unique(),
  
  // FHIRPath Expression
  expression: text('expression').notNull(),
  
  // Configuration
  severity: varchar('severity', { length: 20 }).notNull().default('error'),
  enabled: boolean('enabled').default(true),
  
  // Resource Targeting (stored as JSON arrays in PostgreSQL)
  resourceTypes: text('resource_types').array().notNull(),
  fhirVersions: text('fhir_versions').array().default(['R4']),
  
  // Metadata
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  createdBy: varchar('created_by', { length: 100 }),
  updatedBy: varchar('updated_by', { length: 100 }),
  
  // Validation metadata
  validationMessage: text('validation_message'),
  suggestions: text('suggestions').array(),
  
  // Performance & Stats
  executionCount: integer('execution_count').default(0),
  lastExecutedAt: timestamp('last_executed_at'),
  avgExecutionTimeMs: numeric('avg_execution_time_ms', { precision: 10, scale: 2 }),
  
  // Categorization
  category: varchar('category', { length: 50 }),
  tags: text('tags').array().default([])
});

// ============================================================================
// Business Rule Executions Table (Audit Trail)
// ============================================================================

export const businessRuleExecutions = pgTable('business_rule_executions', {
  id: serial('id').primaryKey(),
  businessRuleId: integer('business_rule_id').notNull().references(() => businessRules.id, { onDelete: 'cascade' }),
  
  // Execution context
  resourceId: integer('resource_id'),
  resourceType: varchar('resource_type', { length: 50 }),
  fhirVersion: varchar('fhir_version', { length: 10 }),
  
  // Execution result
  passed: boolean('passed').notNull(),
  resultValue: text('result_value'), // JSON string of FHIRPath result
  executionTimeMs: numeric('execution_time_ms', { precision: 10, scale: 2 }),
  
  // Error tracking
  errorMessage: text('error_message'),
  
  // Timestamps
  executedAt: timestamp('executed_at').defaultNow()
});

// ============================================================================
// TypeScript Types
// ============================================================================

export type BusinessRule = InferSelectModel<typeof businessRules>;
export type InsertBusinessRule = InferInsertModel<typeof businessRules>;

export type BusinessRuleExecution = InferSelectModel<typeof businessRuleExecutions>;
export type InsertBusinessRuleExecution = InferInsertModel<typeof businessRuleExecutions>;

// ============================================================================
// Business Rule Schema for API/UI
// ============================================================================

export interface BusinessRuleSchema {
  id?: number;
  name: string;
  description?: string;
  ruleId: string;
  expression: string;
  severity: 'error' | 'warning' | 'information';
  enabled?: boolean;
  resourceTypes: string[];
  fhirVersions?: string[];
  validationMessage?: string;
  suggestions?: string[];
  category?: string;
  tags?: string[];
}

export interface BusinessRuleValidationResult {
  ruleId: string;
  passed: boolean;
  message?: string;
  suggestions?: string[];
  executionTimeMs: number;
  error?: string;
}

