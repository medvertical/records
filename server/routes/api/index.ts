// API Routes - Single responsibility: Export all API route modules
// Follows global rules: Simple exports, no custom logic, single responsibility

// Validation API routes
export * from './validation';

// FHIR API routes
export * from './fhir';

// Dashboard API routes
export * from './dashboard';

// Server management API routes
export * from './servers';
