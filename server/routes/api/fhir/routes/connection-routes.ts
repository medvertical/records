import type { Express } from "express";
import type { FhirClient } from "../../../../services/fhir/fhir-client";
import { getCurrentFhirClient } from "../helpers/fhir-client-helper";

/**
 * Setup FHIR connection testing routes
 */
export function setupConnectionRoutes(app: Express, fhirClient: FhirClient | null) {
  // Test current FHIR connection
  app.get("/api/fhir/connection/test", async (req, res) => {
    try {
      const currentFhirClient = getCurrentFhirClient(fhirClient);
      if (!currentFhirClient) {
        return res.status(503).json({ message: "FHIR client not initialized" });
      }
      const result = await currentFhirClient.testConnection();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Test custom FHIR connection
  app.get("/api/fhir/connection/test-custom", async (req, res) => {
    try {
      const currentFhirClient = getCurrentFhirClient(fhirClient);
      if (!currentFhirClient) {
        return res.status(503).json({ message: "FHIR client not initialized" });
      }
      const result = await currentFhirClient.testConnection();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
}

