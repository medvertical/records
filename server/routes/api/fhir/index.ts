import type { Express } from "express";
import type { FhirClient } from "../../../services/fhir/fhir-client";
import { setupConnectionRoutes } from "./routes/connection-routes";
import { setupCapabilityRoutes } from "./routes/capability-routes";
import { setupResourceFilterRoutes } from "./routes/resource-filter-routes";
import { setupResourceRoutes } from "./routes/resource-routes";
import { setupResourceListRoutes } from "./routes/resource-list-routes";
import { setupVersionHistoryRoutes } from "./routes/version-history-routes";
import { setupGenericFhirRoutes } from "./routes/generic-fhir-routes";

// Re-export profile routes
export { setupProfileRoutes } from "./profiles";

/**
 * Setup all FHIR routes
 * Orchestrates the setup of all FHIR-related API endpoints
 * 
 * Route organization:
 * - Connection routes: FHIR server connection testing
 * - Capability routes: CapabilityStatement and search parameters
 * - Resource filter routes: Complex filtered resource queries with validation
 * - Resource routes: Individual resource CRUD operations
 * - Resource list routes: Resource listing and counting
 * - Version history routes: Resource version history
 * - Generic FHIR routes: Parameterized FHIR endpoints
 */
export function setupFhirRoutes(app: Express, fhirClient: FhirClient | null) {
  console.log('[FHIR Routes] Setting up FHIR routes...');
  console.log('[FHIR Routes] fhirClient is:', fhirClient ? 'initialized' : 'NULL');

  // NOTE: Server management endpoints have been moved to /api/servers
  // See server/routes/api/servers.ts for the canonical server management API

  // Setup route modules in order of specificity (most specific first)
  // This is important because Express matches routes in order

  // 1. Connection testing routes
  setupConnectionRoutes(app, fhirClient);

  // 2. Capability and search parameter routes
  setupCapabilityRoutes(app, fhirClient);

  // 3. Version history routes (must come before generic /api/fhir/resources/:id)
  setupVersionHistoryRoutes(app, fhirClient);

  // 4. Filtered resources routes (must come before generic /api/fhir/resources/:id)
  setupResourceFilterRoutes(app, fhirClient);

  // 5. Resource CRUD routes (must come after filtered routes)
  setupResourceRoutes(app, fhirClient);

  // 6. Resource listing and counting routes
  setupResourceListRoutes(app, fhirClient);

  // 7. Generic parameterized routes (least specific, must come last)
  setupGenericFhirRoutes(app, fhirClient);

  console.log('[FHIR Routes] All FHIR routes setup complete');
}
