// FHIR API Routes - Single responsibility: Export FHIR route modules
// Follows global rules: Simple exports, no custom logic, single responsibility

export { setupFhirRoutes } from './fhir';
export { setupProfileRoutes } from './profiles';
