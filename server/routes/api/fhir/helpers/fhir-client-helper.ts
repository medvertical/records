import type { FhirClient } from "../../../../services/fhir/fhir-client";
import { serverActivationService } from "../../../../services/server-activation-service";

/**
 * Helper function to get the current FHIR client from server activation service
 * Falls back to the provided fhirClient if no active client is available
 */
export function getCurrentFhirClient(fhirClient: FhirClient | null): FhirClient | null {
  const currentClient = serverActivationService.getFhirClient();
  return currentClient || fhirClient;
}

