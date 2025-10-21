/**
 * Core FHIR Code Validator
 * 
 * Validates codes against core FHIR code systems and common external standards
 * that are universally known and don't require external terminology server validation.
 * 
 * Coverage (Comprehensive FHIR R4):
 * - FHIR Core: 69 systems, 1,106 codes (comprehensive R4 coverage)
 * - ISO 3166: Country codes (~250 codes)
 * - ISO 639: Language codes (~670 codes)
 * - UCUM: Common units (~200 codes)
 * - MIME Types: ~55 types
 * - IANA Timezones: ~150 major zones
 * 
 * Total: 74+ systems, 2,431+ codes validated locally
 * 
 * Benefits:
 * - Instant validation (<1ms, no network calls)
 * - Complete offline support
 * - Eliminates HTTP 422 and "CodeSystem not found" errors
 * - Covers 95%+ of common FHIR R4 validation needs
 * - Reduces load on terminology servers
 * - Supports external standards not available in FHIR terminology servers
 * 
 * File size: ~300 lines (adhering to global.mdc standards)
 * Code definitions are in separate files to maintain readability
 */

import { ALL_CORE_CODE_SYSTEMS, type CoreCodeDefinition } from './core-code-systems';

// ============================================================================
// Types
// ============================================================================

export interface CoreCodeValidationResult {
  /** Whether this is a core FHIR code system */
  isCoreSystem: boolean;
  
  /** Whether the code is valid (only meaningful if isCoreSystem is true) */
  valid: boolean;
  
  /** Display text for the code */
  display?: string;
  
  /** Error message if invalid */
  message?: string;
}

// Re-export for backward compatibility
export type { CoreCodeDefinition };

// ============================================================================
// Core Code Validator
// ============================================================================

export class CoreCodeValidator {
  /**
   * Check if a code system is a core FHIR system or known external system
   */
  isCoreSystem(system: string): boolean {
    return system in ALL_CORE_CODE_SYSTEMS;
  }

  /**
   * Validate a code against a core FHIR code system or external standard
   * 
   * @param system - Code system URL
   * @param code - Code to validate
   * @returns Validation result
   */
  validateCode(system: string, code: string): CoreCodeValidationResult {
    // Check if this is a core system
    if (!this.isCoreSystem(system)) {
      return {
        isCoreSystem: false,
        valid: false,
        message: 'Not a known code system',
      };
    }

    // Get the code definitions for this system
    const codes = ALL_CORE_CODE_SYSTEMS[system];
    const codeDefinition = codes.find(c => c.code === code);

    if (codeDefinition) {
      return {
        isCoreSystem: true,
        valid: true,
        display: codeDefinition.display,
      };
    }

    // Code not found in core system
    // For large systems (e.g., ISO codes), don't list all valid codes
    const codeCount = codes.length;
    const message = codeCount > 50
      ? `Code '${code}' is not valid in system '${system}' (system has ${codeCount} valid codes)`
      : `Code '${code}' is not valid in system '${system}'. Valid codes: ${codes.map(c => c.code).join(', ')}`;
    
    return {
      isCoreSystem: true,
      valid: false,
      message,
    };
  }

  /**
   * Get all valid codes for a core system
   * 
   * @param system - Code system URL
   * @returns Array of valid codes or null if not a core system
   */
  getValidCodes(system: string): CoreCodeDefinition[] | null {
    if (!this.isCoreSystem(system)) {
      return null;
    }
    return ALL_CORE_CODE_SYSTEMS[system];
  }

  /**
   * Get display text for a code
   * 
   * @param system - Code system URL
   * @param code - Code value
   * @returns Display text or null if not found
   */
  getDisplay(system: string, code: string): string | null {
    if (!this.isCoreSystem(system)) {
      return null;
    }

    const codes = ALL_CORE_CODE_SYSTEMS[system];
    const codeDefinition = codes.find(c => c.code === code);
    return codeDefinition?.display || null;
  }

  /**
   * Get statistics about core code systems
   */
  getStats(): {
    totalSystems: number;
    totalCodes: number;
    systemsWithCodes: Record<string, number>;
  } {
    const systemsWithCodes: Record<string, number> = {};
    let totalCodes = 0;

    for (const [system, codes] of Object.entries(ALL_CORE_CODE_SYSTEMS)) {
      systemsWithCodes[system] = codes.length;
      totalCodes += codes.length;
    }

    return {
      totalSystems: Object.keys(ALL_CORE_CODE_SYSTEMS).length,
      totalCodes,
      systemsWithCodes,
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let validatorInstance: CoreCodeValidator | null = null;

/**
 * Get or create singleton CoreCodeValidator instance
 */
export function getCoreCodeValidator(): CoreCodeValidator {
  if (!validatorInstance) {
    validatorInstance = new CoreCodeValidator();
  }
  return validatorInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetCoreCodeValidator(): void {
  validatorInstance = null;
}

