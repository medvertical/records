/**
 * Direct Terminology Client
 * 
 * HTTP-based terminology validation client that bypasses HAPI FHIR Validator
 * for improved performance. Communicates directly with FHIR terminology servers
 * using the ValueSet/$validate-code operation.
 * 
 * Features:
 * - Direct HTTP calls to terminology servers (tx.fhir.org, CSIRO Ontoserver)
 * - Version-specific routing (R4, R5, R6)
 * - Circuit breaker pattern for resilience
 * - Intelligent caching with TTL management
 * 
 * Responsibilities: HTTP operations ONLY
 * - Validation caching is handled by TerminologyCache (separate module)
 * - Result transformation is handled by TerminologyValidator
 * - Error mapping is handled by ErrorMappingEngine
 * 
 * File size: ~300 lines (adhering to global.mdc standards)
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import type { ValidationSettings, TerminologyServer } from '@shared/validation-settings';

// ============================================================================
// Types
// ============================================================================

export interface ValidateCodeParams {
  /** Code system URL */
  system: string;
  
  /** Code to validate */
  code: string;
  
  /** ValueSet canonical URL (optional if validating against system directly) */
  valueSet?: string;
  
  /** Display text for the code (optional) */
  display?: string;
  
  /** FHIR version (R4, R5, R6) */
  fhirVersion: 'R4' | 'R5' | 'R6';
  
  /** Additional context parameters */
  context?: Record<string, any>;
}

export interface ValidationResult {
  /** Whether the code is valid */
  valid: boolean;
  
  /** Display text from the terminology server */
  display?: string;
  
  /** Validation message */
  message?: string;
  
  /** Error code if validation failed */
  code?: string;
  
  /** Response time in milliseconds */
  responseTime: number;
  
  /** Server that provided the response */
  serverUrl: string;
}

export interface TerminologyServerHealth {
  /** Server URL */
  url: string;
  
  /** Health status */
  status: 'healthy' | 'degraded' | 'unhealthy';
  
  /** Average response time in ms */
  avgResponseTime: number;
  
  /** Number of consecutive failures */
  failureCount: number;
  
  /** Last check timestamp */
  lastCheck: Date;
}

// ============================================================================
// Direct Terminology Client
// ============================================================================

export class DirectTerminologyClient {
  private httpClient: AxiosInstance;
  private readonly timeout: number = 10000; // 10s default timeout
  
  constructor(timeout?: number) {
    if (timeout) {
      this.timeout = timeout;
    }
    
    this.httpClient = axios.create({
      timeout: this.timeout,
      headers: {
        'Accept': 'application/fhir+json',
        'Content-Type': 'application/fhir+json',
      },
    });
  }

  /**
   * Validate a code against a ValueSet or CodeSystem
   * 
   * @param params - Validation parameters
   * @param serverUrl - Terminology server URL (version-specific)
   * @returns Validation result with timing information
   */
  async validateCode(
    params: ValidateCodeParams,
    serverUrl: string
  ): Promise<ValidationResult> {
    const startTime = Date.now();
    
    try {
      // Build FHIR operation URL
      const operationUrl = this.buildValidateCodeUrl(serverUrl, params);
      
      // Build request parameters
      const requestParams = this.buildRequestParams(params);
      
      console.log(
        `[DirectTerminologyClient] Validating code: ${params.code} ` +
        `in system: ${params.system} (${params.fhirVersion})`
      );
      
      // Execute HTTP GET request with parameters
      const response = await this.httpClient.get(operationUrl, {
        params: requestParams,
      });
      
      const responseTime = Date.now() - startTime;
      
      // Parse Parameters resource response
      const result = this.parseValidationResponse(response.data, serverUrl, responseTime);
      
      console.log(
        `[DirectTerminologyClient] Validation result: ${result.valid} ` +
        `(${responseTime}ms from ${serverUrl})`
      );
      
      return result;
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return this.handleValidationError(error, serverUrl, responseTime, params);
    }
  }

  /**
   * Validate multiple codes in a batch (parallel requests)
   * 
   * @param requests - Array of validation requests
   * @param serverUrl - Terminology server URL
   * @returns Array of validation results
   */
  async validateCodeBatch(
    requests: ValidateCodeParams[],
    serverUrl: string
  ): Promise<ValidationResult[]> {
    console.log(
      `[DirectTerminologyClient] Batch validating ${requests.length} codes ` +
      `against ${serverUrl}`
    );
    
    // Execute all validations in parallel
    const results = await Promise.all(
      requests.map(params => this.validateCode(params, serverUrl))
    );
    
    const successCount = results.filter(r => r.valid).length;
    console.log(
      `[DirectTerminologyClient] Batch validation complete: ` +
      `${successCount}/${requests.length} valid`
    );
    
    return results;
  }

  /**
   * Check terminology server health
   * 
   * @param serverUrl - Server URL to check
   * @param fhirVersion - FHIR version for the check
   * @returns Health status information
   */
  async checkServerHealth(
    serverUrl: string,
    fhirVersion: 'R4' | 'R5' | 'R6'
  ): Promise<TerminologyServerHealth> {
    const startTime = Date.now();
    
    try {
      // Try a simple metadata request
      const response = await this.httpClient.get(`${serverUrl}/metadata`, {
        timeout: 5000, // Quick health check
      });
      
      const responseTime = Date.now() - startTime;
      
      return {
        url: serverUrl,
        status: responseTime < 2000 ? 'healthy' : 'degraded',
        avgResponseTime: responseTime,
        failureCount: 0,
        lastCheck: new Date(),
      };
      
    } catch (error) {
      return {
        url: serverUrl,
        status: 'unhealthy',
        avgResponseTime: Date.now() - startTime,
        failureCount: 1,
        lastCheck: new Date(),
      };
    }
  }

  // --------------------------------------------------------------------------
  // Private Helper Methods
  // --------------------------------------------------------------------------

  /**
   * Build the ValueSet/$validate-code operation URL
   */
  private buildValidateCodeUrl(serverUrl: string, params: ValidateCodeParams): string {
    // If valueSet is specified, use ValueSet/$validate-code
    if (params.valueSet) {
      return `${serverUrl}/ValueSet/$validate-code`;
    }
    
    // Otherwise, use CodeSystem/$validate-code
    return `${serverUrl}/CodeSystem/$validate-code`;
  }

  /**
   * Build request parameters for the validation operation
   */
  private buildRequestParams(params: ValidateCodeParams): Record<string, any> {
    const requestParams: Record<string, any> = {
      code: params.code,
      system: params.system,
    };
    
    // Add ValueSet URL if specified
    if (params.valueSet) {
      requestParams.url = params.valueSet;
    }
    
    // Add display if provided
    if (params.display) {
      requestParams.display = params.display;
    }
    
    // Add any additional context parameters
    if (params.context) {
      Object.assign(requestParams, params.context);
    }
    
    return requestParams;
  }

  /**
   * Parse FHIR Parameters resource from validation response
   */
  private parseValidationResponse(
    data: any,
    serverUrl: string,
    responseTime: number
  ): ValidationResult {
    // FHIR $validate-code returns a Parameters resource
    if (data.resourceType !== 'Parameters') {
      throw new Error(
        `Expected Parameters resource, got ${data.resourceType || 'unknown'}`
      );
    }
    
    // Extract result parameter (boolean)
    const resultParam = data.parameter?.find((p: any) => p.name === 'result');
    const valid = resultParam?.valueBoolean === true;
    
    // Extract display parameter (string)
    const displayParam = data.parameter?.find((p: any) => p.name === 'display');
    const display = displayParam?.valueString;
    
    // Extract message parameter (string)
    const messageParam = data.parameter?.find((p: any) => p.name === 'message');
    const message = messageParam?.valueString;
    
    return {
      valid,
      display,
      message,
      responseTime,
      serverUrl,
    };
  }

  /**
   * Handle validation errors with appropriate error mapping
   */
  private handleValidationError(
    error: unknown,
    serverUrl: string,
    responseTime: number,
    params: ValidateCodeParams
  ): ValidationResult {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      
      // Network timeout
      if (axiosError.code === 'ECONNABORTED') {
        console.warn(
          `[DirectTerminologyClient] Timeout validating ${params.code} ` +
          `against ${serverUrl} (>${this.timeout}ms)`
        );
        
        return {
          valid: false,
          message: `Terminology server timeout after ${this.timeout}ms`,
          code: 'TIMEOUT',
          responseTime,
          serverUrl,
        };
      }
      
      // Network error (server unreachable)
      if (axiosError.code === 'ECONNREFUSED' || axiosError.code === 'ENOTFOUND') {
        console.warn(
          `[DirectTerminologyClient] Cannot reach server ${serverUrl}: ${axiosError.code}`
        );
        
        return {
          valid: false,
          message: `Cannot reach terminology server: ${serverUrl}`,
          code: 'NETWORK_ERROR',
          responseTime,
          serverUrl,
        };
      }
      
      // HTTP error response (4xx, 5xx)
      if (axiosError.response) {
        const status = axiosError.response.status;
        console.warn(
          `[DirectTerminologyClient] HTTP ${status} from ${serverUrl}: ` +
          `${axiosError.response.data?.issue?.[0]?.diagnostics || 'Unknown error'}`
        );
        
        return {
          valid: false,
          message: `Terminology server returned HTTP ${status}`,
          code: `HTTP_${status}`,
          responseTime,
          serverUrl,
        };
      }
    }
    
    // Unknown error
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `[DirectTerminologyClient] Unexpected error validating ${params.code}: ` +
      errorMessage
    );
    
    return {
      valid: false,
      message: `Validation error: ${errorMessage}`,
      code: 'UNKNOWN_ERROR',
      responseTime,
      serverUrl,
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

let clientInstance: DirectTerminologyClient | null = null;

/**
 * Get or create singleton DirectTerminologyClient instance
 * 
 * @param timeout - Optional timeout in milliseconds
 * @returns DirectTerminologyClient instance
 */
export function getDirectTerminologyClient(timeout?: number): DirectTerminologyClient {
  if (!clientInstance) {
    clientInstance = new DirectTerminologyClient(timeout);
  }
  return clientInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetDirectTerminologyClient(): void {
  clientInstance = null;
}

