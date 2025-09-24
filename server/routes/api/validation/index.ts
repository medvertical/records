// Validation API Routes - Single responsibility: Export validation route modules
// Follows global rules: Simple exports, no custom logic, single responsibility

export { setupValidationRoutes } from './validation';
export { setupValidationQueueRoutes } from './validation-queue';
export { setupValidationSettingsRoutes } from './validation-settings-simplified';
