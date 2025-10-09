/**
 * Core Validation Services - Main Entry Point
 * 
 * This module provides the core validation functionality:
 * - ConsolidatedValidationService: Main service for all validation operations
 * - ValidationEngine: Core validation logic
 * - ValidationPipeline: Pipeline orchestration
 * 
 * Follows global rules: Simple exports, no custom logic, single responsibility
 */

// Main validation services - Primary exports
export { 
  ConsolidatedValidationService, 
  getConsolidatedValidationService, 
  resetConsolidatedValidationService 
} from './consolidated-validation-service';

export { 
  ValidationEngine, 
  getValidationEngine 
} from './validation-engine';

export { 
  ValidationPipeline, 
  getValidationPipeline 
} from './validation-pipeline';

// Engine components - Individual validators
export * from '../engine/validation-engine-core';
export * from '../engine/structural-validator';
export * from '../engine/profile-validator';
export * from '../engine/terminology-validator';
export * from '../engine/reference-validator';
export * from '../engine/business-rule-validator';
export * from '../engine/metadata-validator';

// Pipeline components - Orchestration and processing
export * from '../pipeline/pipeline-orchestrator';
export * from '../pipeline/batch-processor';
export * from '../pipeline/pipeline-config';
export * from '../pipeline/pipeline-calculator';
export * from '../pipeline/pipeline-types';

// Types - Re-export for convenience
export type {
  ValidationPipelineRequest,
  ValidationPipelineConfig,
  ValidationPipelineResult
} from '../pipeline/pipeline-types';

export type {
  ValidationEngineConfig,
  ValidationEngineResult
} from './validation-engine';
