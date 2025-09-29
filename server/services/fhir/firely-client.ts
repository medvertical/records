/**
 * Firely Server Client for FHIR Reference Validation
 * 
 * This service provides connectivity to Firely FHIR server for
 * reference validation and resource existence checks.
 */

import { fhirValidationConfig } from '../../config/fhir-validation.env';
import { ValidationErrorHandler, ErrorContext } from '../validation/utils/error-handler';

export interface FirelyResponse {
  success: boolean;
  data?: any;
  error?: string;
  responseTime?: number;
}

export interface ReferenceValidationResult {
  isValid: boolean;
  reference?: string;
  resourceType?: string;
  resourceId?: string;
  exists?: boolean;
  error?: string;
}

export interface ResourceExistsResult {
  exists: boolean;
  resourceType?: string;
  resourceId?: string;
  lastModified?: string;
  error?: string;
}

export class FirelyClient {
  private baseUrl: string;
  private timeout: number;
  private retryAttempts: number;
  private retryDelay: number;

  constructor() {
    this.baseUrl = fhirValidationConfig.firelyServerUrl;
    this.timeout = fhirValidationConfig.validationTimeout;
    this.retryAttempts = fhirValidationConfig.retryAttempts;
    this.retryDelay = fhirValidationConfig.retryDelay;
  }

  /**
   * Test connectivity to Firely server with comprehensive error handling
   */
  async testConnectivity(): Promise<FirelyResponse> {
    const context: ErrorContext = {
      externalService: 'Firely Server',
      operation: 'testConnectivity',
      validator: 'ReferenceValidator'
    };

    return ValidationErrorHandler.executeExternalServiceCall(
      'Firely Server',
      async () => {
        console.log('[FirelyClient] Testing Firely server connectivity...');
        console.log('[FirelyClient] Firely URL:', this.baseUrl);
        
        const startTime = Date.now();
        
        const response = await fetch(`${this.baseUrl}/metadata`, {
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
        
        console.log('[FirelyClient] ✅ Firely server connected successfully');
        console.log('[FirelyClient] Response time:', responseTime + 'ms');
        console.log('[FirelyClient] FHIR Version:', data.fhirVersion);
        console.log('[FirelyClient] Software:', data.software?.name, data.software?.version);
        
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
          console.warn('[FirelyClient] Using fallback connectivity test...');
          return {
            success: false,
            error: 'Firely Server unavailable, using fallback validation',
            responseTime: 0
          };
        }
      }
    );
  }

  /**
   * Validate if a referenced resource exists in Firely server
   */
  async validateReference(reference: string): Promise<ReferenceValidationResult> {
    try {
      console.log(`[FirelyClient] Validating reference: ${reference}`);
      
      // Parse the reference to extract resource type and ID
      const referenceParts = reference.split('/');
      if (referenceParts.length < 2) {
        return {
          isValid: false,
          reference,
          error: 'Invalid reference format. Expected: ResourceType/id'
        };
      }

      const resourceType = referenceParts[referenceParts.length - 2];
      const resourceId = referenceParts[referenceParts.length - 1];
      
      // Check if the resource exists
      const existsResult = await this.checkResourceExists(resourceType, resourceId);
      
      return {
        isValid: existsResult.exists,
        reference,
        resourceType,
        resourceId,
        exists: existsResult.exists,
        error: existsResult.error
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[FirelyClient] Reference validation failed:', errorMessage);
      
      return {
        isValid: false,
        reference,
        error: errorMessage
      };
    }
  }

  /**
   * Check if a specific resource exists in Firely server
   */
  async checkResourceExists(resourceType: string, resourceId: string): Promise<ResourceExistsResult> {
    try {
      console.log(`[FirelyClient] Checking if ${resourceType}/${resourceId} exists...`);
      
      const url = `${this.baseUrl}/${resourceType}/${resourceId}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/fhir+json',
          'Content-Type': 'application/fhir+json'
        },
        signal: AbortSignal.timeout(this.timeout)
      });

      if (response.status === 404) {
        return {
          exists: false,
          resourceType,
          resourceId
        };
      }

      if (!response.ok) {
        return {
          exists: false,
          resourceType,
          resourceId,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }

      const data = await response.json();
      
      return {
        exists: true,
        resourceType,
        resourceId,
        lastModified: data.meta?.lastUpdated
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[FirelyClient] Resource existence check failed:', errorMessage);
      
      return {
        exists: false,
        resourceType,
        resourceId,
        error: errorMessage
      };
    }
  }

  /**
   * Get server capabilities for Firely server
   */
  async getCapabilities(): Promise<FirelyResponse> {
    return this.testConnectivity();
  }

  /**
   * Test basic reference validation operations
   */
  async testReferenceValidation(): Promise<FirelyResponse> {
    try {
      console.log('[FirelyClient] Testing reference validation operations...');
      
      // Test with a non-existent reference (should fail)
      const nonExistentRef = 'Patient/non-existent-patient-12345';
      const result = await this.validateReference(nonExistentRef);
      
      if (result.exists) {
        return {
          success: false,
          error: `Expected non-existent reference to return false, but got: ${result.exists}`
        };
      }
      
      console.log('[FirelyClient] ✅ Reference validation operations working');
      
      return {
        success: true,
        data: {
          nonExistentReferenceTest: result
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
   * Create a test Patient resource in Firely server for validation testing
   */
  async createTestPatient(): Promise<FirelyResponse> {
    try {
      console.log('[FirelyClient] Creating test Patient resource...');
      
      const testPatient = {
        resourceType: 'Patient',
        id: 'test-patient-validation',
        name: [{
          family: 'TestPatient',
          given: ['Validation']
        }],
        gender: 'male',
        birthDate: '1990-01-01'
      };
      
      const response = await fetch(`${this.baseUrl}/Patient/test-patient-validation`, {
        method: 'PUT',
        headers: {
          'Accept': 'application/fhir+json',
          'Content-Type': 'application/fhir+json'
        },
        body: JSON.stringify(testPatient),
        signal: AbortSignal.timeout(this.timeout)
      });

      const responseTime = Date.now();
      
      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          responseTime
        };
      }

      const data = await response.json();
      
      console.log('[FirelyClient] ✅ Test Patient created successfully');
      
      return {
        success: true,
        data,
        responseTime
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[FirelyClient] Test Patient creation failed:', errorMessage);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Test reference validation with the created test Patient
   */
  async testReferenceValidationWithTestPatient(): Promise<FirelyResponse> {
    try {
      console.log('[FirelyClient] Testing reference validation with test Patient...');
      
      // First create a test patient
      const createResult = await this.createTestPatient();
      if (!createResult.success) {
        return {
          success: false,
          error: `Failed to create test patient: ${createResult.error}`
        };
      }
      
      // Now test reference validation with the created patient
      const testRef = 'Patient/test-patient-validation';
      const validationResult = await this.validateReference(testRef);
      
      if (!validationResult.isValid || !validationResult.exists) {
        return {
          success: false,
          error: `Expected test patient reference to be valid, but got: ${validationResult.isValid}`
        };
      }
      
      console.log('[FirelyClient] ✅ Reference validation with test Patient working');
      
      return {
        success: true,
        data: {
          testPatientValidation: validationResult
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
