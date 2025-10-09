// Validation API Routes - Single responsibility: Export validation route modules
// Follows global rules: Simple exports, no custom logic, single responsibility

export { setupValidationRoutes } from './validation';
export { setupValidationSettingsRoutes } from './validation-settings';
export { setupResourceValidationRoutes } from './validation-resource';
export { setupValidationPipelineRoutes } from './validation-pipeline';
export { setupValidationProfilesRoutes } from './validation-profiles';
export { setupValidationBackupsRoutes } from './validation-backups';
