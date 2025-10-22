import type { Express } from "express";
import type { FhirClient } from "../../../../services/fhir/fhir-client";
import { getCurrentFhirClient } from "../helpers/fhir-client-helper";

/**
 * Operator mappings for FHIR search parameter types
 */
const OPERATOR_MAP: Record<string, string[]> = {
  string: ["contains", "exact", "missing"],
  token: ["equals", "notEquals", "missing"],
  date: ["eq", "gt", "lt", "ge", "le", "missing"],
  number: ["eq", "gt", "lt", "ge", "le", "missing"],
  quantity: ["eq", "gt", "lt", "ge", "le", "missing"],
  reference: ["equals", "missing"],
  uri: ["equals", "contains", "missing"],
  composite: ["equals"],
  special: ["equals"],
};

/**
 * Setup FHIR capability and search parameter routes
 */
export function setupCapabilityRoutes(app: Express, fhirClient: FhirClient | null) {
  // Get search parameters from CapabilityStatement
  app.get("/api/fhir/capability/search-params/:resourceType", async (req, res) => {
    try {
      const { resourceType } = req.params;
      const currentFhirClient = getCurrentFhirClient(fhirClient);
      if (!currentFhirClient) {
        return res.status(503).json({ message: "FHIR client not initialized" });
      }

      const capability = await currentFhirClient.getCapabilityStatement();
      if (!capability?.rest?.[0]?.resource) {
        return res.json({ resourceType, searchParameters: [] });
      }

      const resourceDef = capability.rest[0].resource.find((r: any) => r.type === resourceType);
      const params: any[] = resourceDef?.searchParam || [];

      const searchParameters = params.map((p: any) => {
        const operators = OPERATOR_MAP[p.type] || ["equals", "missing"];
        
        return {
          name: p.name,
          type: p.type,
          documentation: p.documentation || "",
          operators: operators,
        };
      });

      res.json({ resourceType, searchParameters });
    } catch (error: any) {
      console.error('[FHIR API] Error getting capability search params:', error);
      res.status(500).json({ message: error.message || 'Failed to get search parameters' });
    }
  });
}

