/**
 * Ontoserver Client for FHIR Terminology Validation
 * 
 * This service provides connectivity to Ontoserver instances for
 * terminology validation and code system resolution.
 */

import { fhirValidationConfig, ontoserverR4Url, ontoserverR5Url, ontoserverR6Url } from '../../config/fhir-validation.env';
import { ValidationErrorHandler, ErrorContext } from '../validation/utils/error-handler';
import { PerformanceMeasurer } from '../validation/utils/performance-measurer';
import { terminologyCache, codeSystemCache, valueSetCache } from '../validation/utils/terminology-cache';

export interface OntoserverResponse {
  success: boolean;
  data?: any;
  error?: string;
  responseTime?: number;
}

export interface CodeValidationResult {
  isValid: boolean;
  code?: string;
  display?: string;
  system?: string;
  error?: string;
}

export class OntoserverClient {
  private r4Url: string;
  private r5Url: string;
  private r6Url: string;
  private timeout: number;

  constructor() {
    this.r4Url = ontoserverR4Url;
    this.r5Url = ontoserverR5Url;
    this.r6Url = ontoserverR6Url;
    this.timeout = 5000; // 5 seconds default timeout
  }

  /**
   * Test connectivity to R4 Ontoserver with comprehensive error handling
   */
  async testR4Connectivity(): Promise<OntoserverResponse> {
    const context: ErrorContext = {
      externalService: 'Ontoserver R4',
      operation: 'testR4Connectivity',
      validator: 'TerminologyValidator'
    };

    return ValidationErrorHandler.executeExternalServiceCall(
      'Ontoserver R4',
      async () => {
        console.log('[OntoserverClient] Testing R4 Ontoserver connectivity...');
        console.log('[OntoserverClient] R4 URL:', this.r4Url);
        
        const startTime = Date.now();
        
        const response = await fetch(`${this.r4Url}/metadata`, {
          method: 'GET',
          headers: {
            'Accept': 'application/fhir+json',
            'Content-Type': 'application/fhir+json'
          },
          signal: AbortSignal.timeout(this.timeout)
        });

        const responseTime = Date.now() - startTime;
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        console.log('[OntoserverClient] ✅ R4 Ontoserver connected successfully');
        console.log('[OntoserverClient] Response time:', responseTime + 'ms');
        console.log('[OntoserverClient] FHIR Version:', data.fhirVersion);
        console.log('[OntoserverClient] Software:', data.software?.name, data.software?.version);
        
        return {
          success: true,
          data,
          responseTime
        };
      },
      context,
      {
        retryConfig: {
          maxAttempts: 3,
          baseDelay: 1000,
          maxDelay: 5000,
          backoffMultiplier: 2,
          retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'HTTP_5XX', 'TIMEOUT']
        },
        fallback: async () => {
          console.warn('[OntoserverClient] Using fallback connectivity test...');
          return {
            success: false,
            error: 'Ontoserver R4 unavailable, using fallback validation',
            responseTime: 0
          };
        }
      }
    );
  }

  /**
   * Test connectivity to R5 Ontoserver
   */
  async testR5Connectivity(): Promise<OntoserverResponse> {
    const startTime = Date.now();
    
    try {
      console.log('[OntoserverClient] Testing R5 Ontoserver connectivity...');
      console.log('[OntoserverClient] R5 URL:', this.r5Url);
      
      const response = await fetch(`${this.r5Url}/metadata`, {
        method: 'GET',
        headers: {
          'Accept': 'application/fhir+json',
          'Content-Type': 'application/fhir+json'
        },
        signal: AbortSignal.timeout(this.timeout)
      });

      const responseTime = Date.now() - startTime;
      
      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          responseTime
        };
      }

      const data = await response.json();
      
      console.log('[OntoserverClient] ✅ R5 Ontoserver connected successfully');
      console.log('[OntoserverClient] Response time:', responseTime + 'ms');
      console.log('[OntoserverClient] FHIR Version:', data.fhirVersion);
      console.log('[OntoserverClient] Software:', data.software?.name, data.software?.version);
      
      return {
        success: true,
        data,
        responseTime
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.error('[OntoserverClient] ❌ R5 Ontoserver connection failed:', errorMessage);
      
      return {
        success: false,
        error: errorMessage,
        responseTime
      };
    }
  }

  /**
   * Test connectivity to R6 Ontoserver
   */
  async testR6Connectivity(): Promise<OntoserverResponse> {
    const context: ErrorContext = {
      externalService: 'Ontoserver R6',
      operation: 'testR6Connectivity',
      validator: 'TerminologyValidator'
    };

    return ValidationErrorHandler.executeExternalServiceCall(
      'Ontoserver R6',
      async () => {
        const startTime = Date.now();
        
        console.log('[OntoserverClient] Testing R6 Ontoserver connectivity...');
        console.log('[OntoserverClient] R6 URL:', this.r6Url);
        
        const response = await fetch(`${this.r6Url}/metadata`, {
          method: 'GET',
          headers: {
            'Accept': 'application/fhir+json',
            'Content-Type': 'application/fhir+json'
          },
          signal: AbortSignal.timeout(this.timeout)
        });

        const responseTime = Date.now() - startTime;
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        console.log('[OntoserverClient] ✅ R6 Ontoserver connected successfully');
        console.log('[OntoserverClient] Response time:', responseTime + 'ms');
        console.log('[OntoserverClient] FHIR Version:', data.fhirVersion);
        console.log('[OntoserverClient] Software:', data.software?.name, data.software?.version);
        
        return {
          success: true,
          data,
          responseTime
        };
      },
      context,
      {
        retryConfig: {
          maxAttempts: 3,
          baseDelay: 1000,
          maxDelay: 5000,
          backoffMultiplier: 2,
          retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'HTTP_5XX', 'TIMEOUT']
        },
        fallback: async () => {
          console.warn('[OntoserverClient] Using fallback connectivity test for R6...');
          return {
            success: false,
            error: 'Ontoserver R6 unavailable, using fallback validation',
            responseTime: 0
          };
        }
      }
    );
  }

  /**
   * Validate a code against R4 Ontoserver using ValueSet validation
   */
  async validateCodeR4(code: string, system: string, valueSet?: string): Promise<CodeValidationResult> {
    try {
      console.log(`[OntoserverClient] Validating R4 code: ${code} in system: ${system}`);
      
      // Use ValueSet validation with the administrative-gender value set
      const vsUrl = valueSet || 'http://hl7.org/fhir/ValueSet/administrative-gender';
      const url = `${this.r4Url}/ValueSet/$validate-code?code=${encodeURIComponent(code)}&system=${encodeURIComponent(system)}&url=${encodeURIComponent(vsUrl)}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/fhir+json',
          'Content-Type': 'application/fhir+json'
        },
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        return {
          isValid: false,
          code,
          system,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }

      const data = await response.json();
      
      // Check if the code is valid - look for parameter with name 'result'
      const resultParam = data.parameter?.find((p: any) => p.name === 'result');
      const isValid = resultParam?.valueBoolean === true;
      
      // Get display name if available
      const displayParam = data.parameter?.find((p: any) => p.name === 'display');
      const display = displayParam?.valueString;
      
      return {
        isValid,
        code,
        display,
        system
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[OntoserverClient] R4 code validation failed:', errorMessage);
      
      return {
        isValid: false,
        code,
        system,
        error: errorMessage
      };
    }
  }

  /**
   * Get server capabilities for R4 Ontoserver
   */
  async getR4Capabilities(): Promise<OntoserverResponse> {
    return this.testR4Connectivity();
  }

  /**
   * Get code system with caching
   */
  async getCodeSystemCached(system: string): Promise<any> {
    const context: ErrorContext = {
      externalService: 'Ontoserver R4',
      operation: 'getCodeSystemCached',
      validator: 'TerminologyValidator'
    };

    // Check cache first
    const cached = await codeSystemCache.get('getCodeSystem', { system });
    if (cached) {
      PerformanceMeasurer.recordExternalCall('cache-hit', 'CodeSystemCache', 0);
      return cached;
    }

    // Fetch from Ontoserver
    const operationId = `getCodeSystem-${Date.now()}`;
    PerformanceMeasurer.startTiming(operationId, 'getCodeSystem', { system });

    try {
      const result = await ValidationErrorHandler.executeExternalServiceCall(
        'Ontoserver R4',
        async () => {
          const url = `${this.r4Url}/CodeSystem?url=${encodeURIComponent(system)}`;
          
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'Accept': 'application/fhir+json',
              'Content-Type': 'application/fhir+json'
            },
            signal: AbortSignal.timeout(this.timeout)
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const data = await response.json();
          return data.entry?.[0]?.resource || null;
        },
        context,
        {
          retryConfig: {
            maxAttempts: 2,
            baseDelay: 1000,
            retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'HTTP_5XX']
          }
        }
      );

      // Cache the result
      if (result) {
        await codeSystemCache.set('getCodeSystem', { system }, result);
      }

      PerformanceMeasurer.endTiming(operationId);
      PerformanceMeasurer.recordExternalCall('ontoserver', 'Ontoserver R4', PerformanceMeasurer.endTiming(operationId) || 0);

      return result;
    } catch (error) {
      PerformanceMeasurer.endTiming(operationId);
      throw error;
    }
  }

  /**
   * Get value set with caching
   */
  async getValueSetCached(url: string): Promise<any> {
    const context: ErrorContext = {
      externalService: 'Ontoserver R4',
      operation: 'getValueSetCached',
      validator: 'TerminologyValidator'
    };

    // Check cache first
    const cached = await valueSetCache.get('getValueSet', { url });
    if (cached) {
      PerformanceMeasurer.recordExternalCall('cache-hit', 'ValueSetCache', 0);
      return cached;
    }

    // Fetch from Ontoserver
    const operationId = `getValueSet-${Date.now()}`;
    PerformanceMeasurer.startTiming(operationId, 'getValueSet', { url });

    try {
      const result = await ValidationErrorHandler.executeExternalServiceCall(
        'Ontoserver R4',
        async () => {
          const requestUrl = `${this.r4Url}/ValueSet?url=${encodeURIComponent(url)}`;
          
          const response = await fetch(requestUrl, {
            method: 'GET',
            headers: {
              'Accept': 'application/fhir+json',
              'Content-Type': 'application/fhir+json'
            },
            signal: AbortSignal.timeout(this.timeout)
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const data = await response.json();
          return data.entry?.[0]?.resource || null;
        },
        context,
        {
          retryConfig: {
            maxAttempts: 2,
            baseDelay: 1000,
            retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'HTTP_5XX']
          }
        }
      );

      // Cache the result
      if (result) {
        await valueSetCache.set('getValueSet', { url }, result);
      }

      PerformanceMeasurer.endTiming(operationId);
      PerformanceMeasurer.recordExternalCall('ontoserver', 'Ontoserver R4', PerformanceMeasurer.endTiming(operationId) || 0);

      return result;
    } catch (error) {
      PerformanceMeasurer.endTiming(operationId);
      throw error;
    }
  }

  /**
   * Validate a code against R5 Ontoserver using ValueSet validation
   */
  async validateCodeR5(code: string, system: string, valueSet?: string): Promise<CodeValidationResult> {
    try {
      console.log(`[OntoserverClient] Validating R5 code: ${code} in system: ${system}`);
      
      // Use ValueSet validation with the administrative-gender value set
      const vsUrl = valueSet || 'http://hl7.org/fhir/ValueSet/administrative-gender';
      const url = `${this.r5Url}/ValueSet/$validate-code?code=${encodeURIComponent(code)}&system=${encodeURIComponent(system)}&url=${encodeURIComponent(vsUrl)}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/fhir+json',
          'Content-Type': 'application/fhir+json'
        },
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        return {
          isValid: false,
          code,
          system,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }

      const data = await response.json();
      
      // Check if the code is valid - look for parameter with name 'result'
      const resultParam = data.parameter?.find((p: any) => p.name === 'result');
      const isValid = resultParam?.valueBoolean === true;
      
      // Get display name if available
      const displayParam = data.parameter?.find((p: any) => p.name === 'display');
      const display = displayParam?.valueString;
      
      return {
        isValid,
        code,
        display,
        system
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[OntoserverClient] R5 code validation failed:', errorMessage);
      
      return {
        isValid: false,
        code,
        system,
        error: errorMessage
      };
    }
  }

  /**
   * Get server capabilities for R5 Ontoserver
   */
  async getR5Capabilities(): Promise<OntoserverResponse> {
    return this.testR5Connectivity();
  }

  /**
   * Validate a code against R6 Ontoserver using ValueSet validation
   */
  async validateCodeR6(code: string, system: string, valueSet?: string): Promise<CodeValidationResult> {
    const context: ErrorContext = {
      externalService: 'Ontoserver R6',
      operation: 'validateCodeR6',
      validator: 'TerminologyValidator'
    };

    return ValidationErrorHandler.executeExternalServiceCall(
      'Ontoserver R6',
      async () => {
        console.log(`[OntoserverClient] Validating R6 code: ${code} in system: ${system}`);
        
        // Use ValueSet validation with the administrative-gender value set
        const vsUrl = valueSet || 'http://hl7.org/fhir/ValueSet/administrative-gender';
        const url = `${this.r6Url}/ValueSet/$validate-code?code=${encodeURIComponent(code)}&system=${encodeURIComponent(system)}&url=${encodeURIComponent(vsUrl)}`;
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/fhir+json',
            'Content-Type': 'application/fhir+json'
          },
          signal: AbortSignal.timeout(this.timeout)
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        // Parse validation result
        const isValid = data.parameter?.find((p: any) => p.name === 'result')?.valueBoolean;
        const display = data.parameter?.find((p: any) => p.name === 'display')?.valueString;
        
        console.log(`[OntoserverClient] R6 code validation result: ${isValid ? 'valid' : 'invalid'}`);
        
        return {
          isValid: isValid || false,
          code,
          system,
          display: display || undefined
        };
      },
      context,
      {
        retryConfig: {
          maxAttempts: 2,
          baseDelay: 1000,
          retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'HTTP_5XX']
        },
        fallback: async () => {
          console.warn('[OntoserverClient] R6 code validation failed, using fallback...');
          return {
            isValid: false,
            code,
            system,
            error: 'R6 Ontoserver unavailable for code validation'
          };
        }
      }
    );
  }

  /**
   * Get server capabilities for R6 Ontoserver
   */
  async getR6Capabilities(): Promise<OntoserverResponse> {
    return this.testR6Connectivity();
  }

  /**
   * Test basic terminology operations on R4 Ontoserver
   */
  async testR4TerminologyOperations(): Promise<OntoserverResponse> {
    try {
      console.log('[OntoserverClient] Testing R4 terminology operations...');
      
      // Test common gender codes
      const genderResult = await this.validateCodeR4('male', 'http://hl7.org/fhir/administrative-gender');
      
      if (!genderResult.isValid) {
        return {
          success: false,
          error: `Gender code validation failed: ${genderResult.error}`
        };
      }
      
      console.log('[OntoserverClient] ✅ R4 terminology operations working');
      
      return {
        success: true,
        data: {
          genderValidation: genderResult
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Test basic terminology operations on R5 Ontoserver
   */
  async testR5TerminologyOperations(): Promise<OntoserverResponse> {
    try {
      console.log('[OntoserverClient] Testing R5 terminology operations...');
      
      // Test SNOMED CT gender codes (R5 uses SNOMED CT instead of administrative-gender)
      const genderResult = await this.validateCodeR5('365873007', 'http://snomed.info/sct', 'http://snomed.info/sct?fhir_vs=isa/365873007');
      
      if (!genderResult.isValid) {
        return {
          success: false,
          error: `SNOMED CT gender code validation failed: ${genderResult.error}`
        };
      }
      
      console.log('[OntoserverClient] ✅ R5 terminology operations working');
      
      return {
        success: true,
        data: {
          genderValidation: genderResult
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Test basic terminology operations on R6 Ontoserver
   */
  async testR6TerminologyOperations(): Promise<OntoserverResponse> {
    try {
      console.log('[OntoserverClient] Testing R6 terminology operations...');
      
      // Test SNOMED CT gender codes (R6 uses SNOMED CT with enhanced validation)
      const genderResult = await this.validateCodeR6('365873007', 'http://snomed.info/sct', 'http://snomed.info/sct?fhir_vs=isa/365873007');
      
      if (!genderResult.isValid) {
        return {
          success: false,
          error: `SNOMED CT gender code validation failed: ${genderResult.error}`
        };
      }
      
      console.log('[OntoserverClient] ✅ R6 terminology operations working');
      
      return {
        success: true,
        data: {
          genderValidation: genderResult
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: errorMessage
      };
    }
  }
}
