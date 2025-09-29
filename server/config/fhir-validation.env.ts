/**
 * FHIR Validation MVP Environment Configuration
 * 
 * This file contains the environment variables and configuration
 * for the FHIR validation system, including Ontoserver connections.
 */

export interface FHIRValidationConfig {
  // Server Configuration
  port: number;
  nodeEnv: string;
  
  // FHIR Ontoserver Configuration
  ontoserverR4Url: string;
  ontoserverR5Url: string;
  ontoserverR6Url: string;
  
  // FHIR Server Configuration (Firely Server public instance)
  firelyServerUrl: string;
  
  // Validation Configuration
  validationTimeout: number;
  retryAttempts: number;
  retryDelay: number;
  
  // Caching Configuration
  cacheTtlMs: number;
  cacheMaxSize: number;
}

export const fhirValidationConfig: FHIRValidationConfig = {
  // Server Configuration
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // FHIR Ontoserver Configuration
  ontoserverR4Url: process.env.FHIR_R4_ONTOSERVER_URL || 'https://r4.ontoserver.csiro.au/fhir',
  ontoserverR5Url: process.env.FHIR_R5_ONTOSERVER_URL || 'https://r5.ontoserver.csiro.au/fhir',
  ontoserverR6Url: process.env.FHIR_R6_ONTOSERVER_URL || 'https://r6.ontoserver.csiro.au/fhir',
  
  // FHIR Server Configuration (Firely Server public instance)
  firelyServerUrl: process.env.FHIR_FIRELY_SERVER_URL || 'https://server.fire.ly',
  
  // Validation Configuration
  validationTimeout: parseInt(process.env.FHIR_VALIDATION_TIMEOUT || '5000', 10),
  retryAttempts: parseInt(process.env.FHIR_VALIDATION_RETRY_ATTEMPTS || '3', 10),
  retryDelay: parseInt(process.env.FHIR_VALIDATION_RETRY_DELAY || '1000', 10),
  
  // Caching Configuration
  cacheTtlMs: parseInt(process.env.FHIR_CACHE_TTL_MS || '300000', 10), // 5 minutes
  cacheMaxSize: parseInt(process.env.FHIR_CACHE_MAX_SIZE || '1000', 10),
};

// Export individual configuration values for easy access
export const {
  port,
  nodeEnv,
  ontoserverR4Url,
  ontoserverR5Url,
  ontoserverR6Url,
  firelyServerUrl,
  validationTimeout,
  retryAttempts,
  retryDelay,
  cacheTtlMs,
  cacheMaxSize
} = fhirValidationConfig;

// Validation function to check if required configuration is present
export function validateFHIRConfig(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check required URLs
  if (!ontoserverR4Url) {
    errors.push('FHIR_R4_ONTOSERVER_URL is required');
  }
  
  if (!ontoserverR5Url) {
    errors.push('FHIR_R5_ONTOSERVER_URL is required');
  }
  
  if (!ontoserverR6Url) {
    errors.push('FHIR_R6_ONTOSERVER_URL is required');
  }
  
  if (!firelyServerUrl) {
    errors.push('FHIR_FIRELY_SERVER_URL is required');
  }
  
  // Check numeric values
  if (validationTimeout <= 0) {
    errors.push('FHIR_VALIDATION_TIMEOUT must be greater than 0');
  }
  
  if (retryAttempts < 0) {
    errors.push('FHIR_VALIDATION_RETRY_ATTEMPTS must be non-negative');
  }
  
  if (retryDelay < 0) {
    errors.push('FHIR_VALIDATION_RETRY_DELAY must be non-negative');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Log configuration on startup
export function logFHIRConfig(): void {
  console.log('[FHIR Validation Config] Configuration loaded:');
  console.log(`  - R4 Ontoserver: ${ontoserverR4Url}`);
  console.log(`  - R5 Ontoserver: ${ontoserverR5Url}`);
  console.log(`  - R6 Ontoserver: ${ontoserverR6Url}`);
  console.log(`  - Firely Server: ${firelyServerUrl}`);
  console.log(`  - Validation Timeout: ${validationTimeout}ms`);
  console.log(`  - Retry Attempts: ${retryAttempts}`);
  console.log(`  - Cache TTL: ${cacheTtlMs}ms`);
}
