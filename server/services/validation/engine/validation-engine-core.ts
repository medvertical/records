/**
 * Validation Engine (Unified)
 *
 * Transitional wrapper around the existing engine to remove legacy naming
 * and provide a stable API while we incrementally split aspects.
 */
import {
  ValidationEngine as CoreValidationEngine,
  getValidationEngine as getCoreValidationEngine,
  type ValidationRequest,
  type ValidationResult,
} from "../core/validation-engine";

// Re-export the core engine with consistent naming
export class ValidationEngine extends CoreValidationEngine {}

// Re-export the factory with consistent naming
export function getValidationEngine(): ValidationEngine {
  return getCoreValidationEngine() as unknown as ValidationEngine;
}

export type { ValidationRequest, ValidationResult };


