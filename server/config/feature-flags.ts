/**
 * Feature Flags & Environment Configuration
 * 
 * This module provides centralized feature flag management and environment configuration.
 * All flags default to production-safe values (disabled/false).
 */

import { logTimeoutConfiguration } from './validation-timeouts';

/**
 * Environment variable getter with type safety
 */
function getEnvVar(key: string, defaultValue: string = ''): string {
  return process.env[key] || defaultValue;
}

function getEnvBoolean(key: string, defaultValue: boolean = false): boolean {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

function getEnvNumber(key: string, defaultValue: number = 0): number {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Feature Flags Configuration
 */
export const FeatureFlags = {
  /**
   * DEMO_MOCKS: Enable mock data for demo/development purposes
   * 
   * When enabled:
   * - Mock FHIR servers are returned if database is unavailable
   * - Mock validation progress is returned if queue is not running
   * - Mock dashboard stats are returned if services are unavailable
   * 
   * CRITICAL: This should NEVER be enabled in production!
   * Default: false (disabled)
   * 
   * Usage: DEMO_MOCKS=true npm run dev
   */
  DEMO_MOCKS: getEnvBoolean('DEMO_MOCKS', false),

  /**
   * ENABLE_EXPERIMENTAL_FEATURES: Enable experimental/beta features
   * 
   * When enabled:
   * - Advanced validation aspects (experimental)
   * - Beta UI components
   * - Performance optimizations under testing
   * 
   * Default: false (disabled)
   */
  ENABLE_EXPERIMENTAL_FEATURES: getEnvBoolean('ENABLE_EXPERIMENTAL_FEATURES', false),

  /**
   * ENABLE_PERFORMANCE_TRACKING: Enable detailed performance metrics
   * 
   * When enabled:
   * - Request timing logs
   * - Validation duration tracking
   * - Cache hit rate monitoring
   * 
   * Default: true (enabled - low overhead)
   */
  ENABLE_PERFORMANCE_TRACKING: getEnvBoolean('ENABLE_PERFORMANCE_TRACKING', true),

  /**
   * ENABLE_AUDIT_TRAIL: Enable audit logging for resource edits
   * 
   * When enabled:
   * - Resource edit history is logged
   * - User actions are tracked
   * - Changes are stored in audit table
   * 
   * Default: true (enabled - recommended for production)
   */
  ENABLE_AUDIT_TRAIL: getEnvBoolean('ENABLE_AUDIT_TRAIL', true),

  /**
   * STRICT_VALIDATION_MODE: Enforce strict FHIR validation
   * 
   * When enabled:
   * - All validation aspects are required
   * - Warnings are treated as errors
   * - Strict reference checking
   * 
   * Default: false (disabled - too strict for most use cases)
   */
  STRICT_VALIDATION_MODE: getEnvBoolean('STRICT_VALIDATION_MODE', false),
} as const;

/**
 * Environment Configuration
 */
export const Environment = {
  NODE_ENV: getEnvVar('NODE_ENV', 'development'),
  IS_PRODUCTION: getEnvVar('NODE_ENV') === 'production',
  IS_DEVELOPMENT: getEnvVar('NODE_ENV') === 'development',
  IS_TEST: getEnvVar('NODE_ENV') === 'test',
  
  // Database
  DATABASE_URL: getEnvVar('DATABASE_URL'),
  
  // Server
  PORT: getEnvNumber('PORT', 5000),
  HOST: getEnvVar('HOST', '0.0.0.0'),
  
  // FHIR
  DEFAULT_FHIR_VERSION: getEnvVar('DEFAULT_FHIR_VERSION', 'R4'),
  
  // Validation - use centralized timeout configuration
  // Note: This is deprecated, use validation-timeouts.ts instead
  VALIDATION_TIMEOUT_MS: getEnvNumber('VALIDATION_TIMEOUT_MS', 90000),  // Default to profile validation timeout
  VALIDATION_BATCH_SIZE: getEnvNumber('VALIDATION_BATCH_SIZE', 10),
  
  // Cache
  CACHE_TTL_SECONDS: getEnvNumber('CACHE_TTL_SECONDS', 30),
  
  // Polling
  POLLING_INTERVAL_MS: getEnvNumber('POLLING_INTERVAL_MS', 30000),
} as const;

/**
 * Validation helper: Ensure production safety
 */
export function assertProductionSafety(): void {
  if (Environment.IS_PRODUCTION) {
    if (FeatureFlags.DEMO_MOCKS) {
      throw new Error(
        'CRITICAL: DEMO_MOCKS is enabled in production! ' +
        'This is a security risk. Set DEMO_MOCKS=false or remove the environment variable.'
      );
    }
    
    if (!Environment.DATABASE_URL) {
      throw new Error(
        'CRITICAL: DATABASE_URL is not set in production! ' +
        'A database connection is required for production deployments.'
      );
    }
  }
}

/**
 * Log feature flags on startup
 */
export function logFeatureFlags(): void {
  console.log('🚀 Feature Flags Configuration:');
  console.log(`   NODE_ENV: ${Environment.NODE_ENV}`);
  console.log(`   DEMO_MOCKS: ${FeatureFlags.DEMO_MOCKS ? '⚠️  ENABLED (NOT FOR PRODUCTION!)' : '✅ Disabled'}`);
  console.log(`   EXPERIMENTAL_FEATURES: ${FeatureFlags.ENABLE_EXPERIMENTAL_FEATURES ? '🧪 Enabled' : 'Disabled'}`);
  console.log(`   PERFORMANCE_TRACKING: ${FeatureFlags.ENABLE_PERFORMANCE_TRACKING ? '📊 Enabled' : 'Disabled'}`);
  console.log(`   AUDIT_TRAIL: ${FeatureFlags.ENABLE_AUDIT_TRAIL ? '📝 Enabled' : 'Disabled'}`);
  console.log(`   STRICT_VALIDATION: ${FeatureFlags.STRICT_VALIDATION_MODE ? '🔒 Enabled' : 'Disabled'}`);
  
  // Log validation timeout configuration
  try {
    logTimeoutConfiguration();
  } catch (error) {
    console.warn('Failed to log timeout configuration:', error);
  }
}
