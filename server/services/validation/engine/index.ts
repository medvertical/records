// Validation Engine Components - Individual validators
// Follows global rules: Simple exports, no custom logic, single responsibility

// Core validation engine
export { ValidationEngine, getValidationEngine } from './validation-engine-core';

// Individual aspect validators
export { StructuralValidator } from './structural-validator';
export { ProfileValidator } from './profile-validator';
export { TerminologyValidator } from './terminology-validator';
export { ReferenceValidator } from './reference-validator';
export { BusinessRuleValidator } from './business-rule-validator';
export { MetadataValidator } from './metadata-validator';
