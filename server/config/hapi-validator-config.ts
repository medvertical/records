/**
 * HAPI FHIR Validator Configuration
 * 
 * Centralized configuration for HAPI FHIR Validator CLI integration
 * including paths, timeouts, version support, and terminology server settings.
 */

import { resolve } from 'path';

export interface HapiValidatorConfig {
  // Paths
  jarPath: string;
  igCachePath: string;
  terminologyCachePath: string;

  // Performance
  timeout: number;
  maxParallel: number;

  // Version Support
  defaultVersion: 'R4' | 'R5' | 'R6';
  supportR5: boolean;
  supportR6: boolean;

  // Terminology Servers
  terminologyServers: {
    online: {
      r4: string;
      r5: string;
      r6: string;
    };
    offline: {
      r4: string;
      r5: string;
      r6: string;
    };
  };
}

/**
 * Load HAPI validator configuration from environment variables
 */
export function loadHapiValidatorConfig(): HapiValidatorConfig {
  const jarPath = process.env.HAPI_JAR_PATH || 'server/lib/validator_cli.jar';
  
  return {
    // Paths
    jarPath: resolve(process.cwd(), jarPath),
    igCachePath: resolve(process.cwd(), process.env.HAPI_IG_CACHE_PATH || 'server/storage/igs'),
    terminologyCachePath: resolve(process.cwd(), process.env.HAPI_TERMINOLOGY_CACHE_PATH || 'server/storage/terminology'),

    // Performance
    timeout: parseInt(process.env.HAPI_TIMEOUT || '30000', 10),
    maxParallel: parseInt(process.env.HAPI_MAX_PARALLEL || '4', 10),

    // Version Support
    defaultVersion: (process.env.HAPI_DEFAULT_VERSION as 'R4' | 'R5' | 'R6') || 'R4',
    supportR5: process.env.HAPI_SUPPORT_R5 !== 'false',
    supportR6: process.env.HAPI_SUPPORT_R6 !== 'false',

    // Terminology Servers
    terminologyServers: {
      online: {
        r4: process.env.HAPI_TX_ONLINE_R4 || 'https://tx.fhir.org/r4',
        r5: process.env.HAPI_TX_ONLINE_R5 || 'https://tx.fhir.org/r5',
        r6: process.env.HAPI_TX_ONLINE_R6 || 'https://tx.fhir.org/r6',
      },
      offline: {
        r4: process.env.HAPI_TX_OFFLINE_R4 || 'http://localhost:8081/fhir',
        r5: process.env.HAPI_TX_OFFLINE_R5 || 'http://localhost:8082/fhir',
        r6: process.env.HAPI_TX_OFFLINE_R6 || 'http://localhost:8083/fhir',
      },
    },
  };
}

/**
 * Get terminology server URL based on FHIR version and mode
 */
export function getTerminologyServerUrl(
  version: 'R4' | 'R5' | 'R6',
  mode: 'online' | 'offline',
  config: HapiValidatorConfig
): string {
  const versionKey = version.toLowerCase() as 'r4' | 'r5' | 'r6';
  return config.terminologyServers[mode][versionKey];
}

/**
 * FHIR Version to IG Core Package mapping
 */
export const FHIR_VERSION_IG_MAP = {
  R4: {
    version: '4.0',
    corePackage: 'hl7.fhir.r4.core@4.0.1',
  },
  R5: {
    version: '5.0',
    corePackage: 'hl7.fhir.r5.core@5.0.0',
  },
  R6: {
    version: '6.0',
    corePackage: 'hl7.fhir.r6.core@6.0.0-ballot2',
  },
} as const;

/**
 * Validation timeout configuration
 */
export const VALIDATION_TIMEOUTS = {
  structural: 10000,  // 10s
  profile: 15000,     // 15s
  terminology: 20000, // 20s
  full: 30000,        // 30s
} as const;

/**
 * Default HAPI CLI arguments
 */
export const DEFAULT_HAPI_ARGS = [
  '-output', 'json',
  '-locale', 'en',
] as const;

// Export singleton config instance
export const hapiValidatorConfig = loadHapiValidatorConfig();

