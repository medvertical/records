/**
 * HAPI FHIR Validator Types
 * 
 * Type definitions for HAPI validator integration.
 * Extracted from hapi-validator-client.ts to maintain file size limits.
 */

export interface HapiValidationOptions {
  /** FHIR version (R4, R5, or R6) */
  fhirVersion: 'R4' | 'R5' | 'R6';
  
  /** Profile URL for validation */
  profile?: string;
  
  /** Terminology server URL (auto-selected based on mode if not provided) */
  terminologyServer?: string;
  
  /** IG packages to load (e.g., ['hl7.fhir.r4.core@4.0.1']) */
  igPackages?: string[];
  
  /** Validation mode (online or offline) */
  mode?: 'online' | 'offline';
  
  /** Timeout in milliseconds (default: from config) */
  timeout?: number;
}

export interface HapiOperationOutcome {
  resourceType: 'OperationOutcome';
  issue: HapiIssue[];
}

export interface HapiIssue {
  severity: 'fatal' | 'error' | 'warning' | 'information';
  code: string;
  details?: {
    text?: string;
  };
  diagnostics: string;
  location?: string[];
  expression?: string[];
}

export interface HapiValidatorSetupResult {
  success: boolean;
  message: string;
  version?: string;
}

