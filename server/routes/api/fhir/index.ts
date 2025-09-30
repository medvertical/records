// FHIR API Routes - Single responsibility: Export FHIR route modules
// Follows global rules: Simple exports, no custom logic, single responsibility

export { setupFhirRoutes } from './fhir';
export { setupProfileRoutes } from './profiles';
export { default as resourceEditRoutes } from './resource-edit';
export { default as batchEditRoutes } from './batch-edit';
