/**
 * Centralized Validation Timeout Configuration
 * 
 * All timeout values in milliseconds.
 * 
 * Timeout Cascade:
 * clientHttp > validationEngine > hapiProcess > profileResolution
 * 
 * This ensures:
 * - Client waits longer than server to prevent premature cancellation
 * - Server validation engine has time to complete before client gives up
 * - HAPI process completes before validation engine times out
 * - Profile resolution completes before HAPI validation starts
 */

/**
 * Validation timeout configuration interface
 */
export interface ValidationTimeouts {
  /** Client HTTP request timeout (longest) */
  clientHttp: number;
  
  /** Validation engine per-aspect timeout */
  validationEngine: {
    structural: number;
    profile: number;
    terminology: number;
    reference: number;
    businessRules: number;
    metadata: number;
  };
  
  /** HAPI FHIR Validator process timeout */
  hapiProcess: number;
  
  /** Profile resolution timeout (downloading StructureDefinitions) */
  profileResolution: number;
  
  /** Terminology server lookup timeout */
  terminologyLookup: number;
  
  /** Reference validation timeout */
  referenceCheck: number;
}

/**
 * Default timeout values (in milliseconds)
 * 
 * These values are optimized for:
 * - German FHIR profiles (KBV, MII, ISiK)
 * - First-time profile downloads (no cache)
 * - Slow network connections
 * - Complex resources with many extensions
 */
const DEFAULT_TIMEOUTS: ValidationTimeouts = {
  // Client timeout must be longest to allow server to complete
  clientHttp: 120000, // 2 minutes
  
  // Validation engine timeouts per aspect
  validationEngine: {
    structural: 20000,   // 20s - basic FHIR structure validation
    profile: 90000,      // 90s - profile resolution + HAPI validation
    terminology: 30000,  // 30s - code validation against value sets
    reference: 15000,    // 15s - reference resolution
    businessRules: 15000, // 15s - custom business logic
    metadata: 5000,      // 5s - metadata validation
  },
  
  // HAPI process timeout (must be less than validation engine profile timeout)
  hapiProcess: 75000, // 75s - HAPI Java process execution
  
  // Profile resolution timeout (must be less than HAPI process timeout)
  profileResolution: 30000, // 30s - download and parse StructureDefinitions
  
  // Other timeouts
  terminologyLookup: 10000, // 10s - single terminology server call
  referenceCheck: 5000,     // 5s - single reference resolution
};

/**
 * Load timeout configuration from environment variables
 */
function loadTimeoutsFromEnv(): ValidationTimeouts {
  const getEnvNumber = (key: string, defaultValue: number): number => {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  };

  return {
    clientHttp: getEnvNumber('VALIDATION_TIMEOUT_CLIENT', DEFAULT_TIMEOUTS.clientHttp),
    
    validationEngine: {
      structural: getEnvNumber('VALIDATION_TIMEOUT_STRUCTURAL', DEFAULT_TIMEOUTS.validationEngine.structural),
      profile: getEnvNumber('VALIDATION_TIMEOUT_PROFILE', DEFAULT_TIMEOUTS.validationEngine.profile),
      terminology: getEnvNumber('VALIDATION_TIMEOUT_TERMINOLOGY', DEFAULT_TIMEOUTS.validationEngine.terminology),
      reference: getEnvNumber('VALIDATION_TIMEOUT_REFERENCE', DEFAULT_TIMEOUTS.validationEngine.reference),
      businessRules: getEnvNumber('VALIDATION_TIMEOUT_BUSINESS_RULES', DEFAULT_TIMEOUTS.validationEngine.businessRules),
      metadata: getEnvNumber('VALIDATION_TIMEOUT_METADATA', DEFAULT_TIMEOUTS.validationEngine.metadata),
    },
    
    hapiProcess: getEnvNumber('VALIDATION_TIMEOUT_HAPI', DEFAULT_TIMEOUTS.hapiProcess),
    profileResolution: getEnvNumber('VALIDATION_TIMEOUT_PROFILE_RESOLUTION', DEFAULT_TIMEOUTS.profileResolution),
    terminologyLookup: getEnvNumber('VALIDATION_TIMEOUT_TERMINOLOGY_LOOKUP', DEFAULT_TIMEOUTS.terminologyLookup),
    referenceCheck: getEnvNumber('VALIDATION_TIMEOUT_REFERENCE_CHECK', DEFAULT_TIMEOUTS.referenceCheck),
  };
}

/**
 * Validate timeout cascade
 * Ensures: clientHttp > profile > hapiProcess > profileResolution
 */
function validateTimeoutCascade(timeouts: ValidationTimeouts): void {
  const errors: string[] = [];

  // Client must wait longer than server
  if (timeouts.clientHttp <= timeouts.validationEngine.profile) {
    errors.push(
      `Client timeout (${timeouts.clientHttp}ms) must be greater than profile validation timeout (${timeouts.validationEngine.profile}ms)`
    );
  }

  // Validation engine must wait longer than HAPI process
  if (timeouts.validationEngine.profile <= timeouts.hapiProcess) {
    errors.push(
      `Profile validation timeout (${timeouts.validationEngine.profile}ms) must be greater than HAPI process timeout (${timeouts.hapiProcess}ms)`
    );
  }

  // HAPI process must wait longer than profile resolution
  if (timeouts.hapiProcess <= timeouts.profileResolution) {
    errors.push(
      `HAPI process timeout (${timeouts.hapiProcess}ms) must be greater than profile resolution timeout (${timeouts.profileResolution}ms)`
    );
  }

  // Profile resolution should be reasonable
  if (timeouts.profileResolution < 10000) {
    console.warn(
      `[ValidationTimeouts] Profile resolution timeout (${timeouts.profileResolution}ms) is very short. ` +
      `Consider increasing to at least 10 seconds for German profiles.`
    );
  }

  // Client timeout should be reasonable
  if (timeouts.clientHttp < 60000) {
    console.warn(
      `[ValidationTimeouts] Client timeout (${timeouts.clientHttp}ms) is less than 60 seconds. ` +
      `This may cause timeouts for profile validation.`
    );
  }

  if (errors.length > 0) {
    throw new Error(
      `Invalid timeout configuration:\n${errors.map(e => `  - ${e}`).join('\n')}`
    );
  }
}

/**
 * Get configured validation timeouts
 */
export function getValidationTimeouts(): ValidationTimeouts {
  const timeouts = loadTimeoutsFromEnv();
  
  try {
    validateTimeoutCascade(timeouts);
  } catch (error) {
    console.error('[ValidationTimeouts] Configuration error:', error);
    console.warn('[ValidationTimeouts] Falling back to default timeout values');
    return DEFAULT_TIMEOUTS;
  }
  
  return timeouts;
}

/**
 * Log configured timeout values
 */
export function logTimeoutConfiguration(): void {
  const timeouts = getValidationTimeouts();
  
  console.log('⏱️  Validation Timeout Configuration:');
  console.log(`   Client HTTP: ${timeouts.clientHttp}ms (${(timeouts.clientHttp / 1000).toFixed(1)}s)`);
  console.log(`   Validation Engine:`);
  console.log(`     - Structural: ${timeouts.validationEngine.structural}ms`);
  console.log(`     - Profile: ${timeouts.validationEngine.profile}ms`);
  console.log(`     - Terminology: ${timeouts.validationEngine.terminology}ms`);
  console.log(`     - Reference: ${timeouts.validationEngine.reference}ms`);
  console.log(`     - Business Rules: ${timeouts.validationEngine.businessRules}ms`);
  console.log(`     - Metadata: ${timeouts.validationEngine.metadata}ms`);
  console.log(`   HAPI Process: ${timeouts.hapiProcess}ms (${(timeouts.hapiProcess / 1000).toFixed(1)}s)`);
  console.log(`   Profile Resolution: ${timeouts.profileResolution}ms (${(timeouts.profileResolution / 1000).toFixed(1)}s)`);
  
  // Validate cascade
  const cascade = 
    timeouts.clientHttp > timeouts.validationEngine.profile &&
    timeouts.validationEngine.profile > timeouts.hapiProcess &&
    timeouts.hapiProcess > timeouts.profileResolution;
  
  if (cascade) {
    console.log('   ✅ Timeout cascade is correctly configured');
  } else {
    console.warn('   ⚠️  Timeout cascade may not be optimal');
  }
}

/**
 * Get timeout for specific aspect
 */
export function getAspectTimeout(aspect: keyof ValidationTimeouts['validationEngine']): number {
  const timeouts = getValidationTimeouts();
  return timeouts.validationEngine[aspect];
}

/**
 * Get HAPI process timeout
 */
export function getHapiTimeout(): number {
  return getValidationTimeouts().hapiProcess;
}

/**
 * Get profile resolution timeout
 */
export function getProfileResolutionTimeout(): number {
  return getValidationTimeouts().profileResolution;
}

/**
 * Get client HTTP timeout
 */
export function getClientTimeout(): number {
  return getValidationTimeouts().clientHttp;
}

// Export singleton instance
export const ValidationTimeoutsConfig = getValidationTimeouts();

// Export defaults for testing
export { DEFAULT_TIMEOUTS };

