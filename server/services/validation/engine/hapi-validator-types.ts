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
  
  /** 
   * Priority-ordered list of terminology servers from ValidationSettings
   * If provided, first enabled server will be used. Falls back to terminologyServer or tx.fhir.org
   */
  terminologyServers?: string[];
  
  /** IG packages to load (e.g., ['hl7.fhir.r4.core@4.0.1']) */
  igPackages?: string[];
  
  /** Validation mode (online or offline) */
  mode?: 'online' | 'offline';
  
  /** Timeout in milliseconds (default: from config) */
  timeout?: number;
  
  /** Package cache directory (overrides default ~/.fhir/packages) */
  cacheDirectory?: string;
  
  /** Enable best-practice checks (default: true) */
  enableBestPractice?: boolean;
  
  /** Validation detail level (default: 'hints' to show all messages) */
  validationLevel?: 'errors' | 'warnings' | 'hints';
}

export interface HapiOperationOutcome {
  resourceType: 'OperationOutcome';
  issue: HapiIssue[];
}

export interface HapiIssue {
  severity: 'fatal' | 'error' | 'warning' | 'information' | 'hint';
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

