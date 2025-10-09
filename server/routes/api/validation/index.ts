// Validation API Routes - Single responsibility: Export validation route modules
// Follows global rules: Simple exports, no custom logic, single responsibility

export { setupValidationRoutes } from './validation';
export { setupValidationSettingsRoutes } from './validation-settings';
export { setupResourceValidationRoutes } from './validation-resource';
export { setupValidationPipelineRoutes } from './validation-pipeline';
export { setupValidationProfilesRoutes } from './validation-profiles';
export { setupValidationBackupsRoutes } from './validation-backups';

// Export new validation groups and resource messages routes
export { default as validationGroupsRoutes } from './groups';
export { default as resourceMessagesRoutes } from './resource-messages';
export { default as validationProgressRoutes } from './progress';
