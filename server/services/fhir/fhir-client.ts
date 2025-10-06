import axios, { AxiosResponse } from 'axios';
import { errorHandler } from '../../utils/error-handler.js';
import { logger } from '../../utils/logger.js';

export interface FhirBundle {
  resourceType: 'Bundle';
  id?: string;
  type: string;
  total?: number;
  entry?: Array<{
    resource: any;
    fullUrl?: string;
  }>;
  link?: Array<{
    relation: string;
    url: string;
  }>;
}

export interface FhirOperationOutcome {
  resourceType: 'OperationOutcome';
  issue: Array<{
    severity: 'fatal' | 'error' | 'warning' | 'info';
    code: string;
    details?: {
      text: string;
    };
    diagnostics?: string;
    location?: string[];
    expression?: string[];
  }>;
}

export interface AuthConfig {
  type: 'none' | 'basic' | 'bearer' | 'oauth2';
  username?: string;
  password?: string;
  token?: string;
  clientId?: string;
  clientSecret?: string;
  scope?: string;
  tokenUrl?: string;
}

export class FhirClient {
  private baseUrl: string;
  private headers: Record<string, string>;
  private authConfig?: AuthConfig;

  constructor(baseUrl: string, authConfig?: AuthConfig) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    this.authConfig = authConfig;
    this.headers = {
      'Accept': 'application/fhir+json',
      'Content-Type': 'application/fhir+json',
    };
    
    // Apply authentication headers
    this.applyAuthentication();
  }

  private applyAuthentication(): void {
    if (!this.authConfig || this.authConfig.type === 'none') {
      return;
    }

    switch (this.authConfig.type) {
      case 'basic':
        if (this.authConfig.username && this.authConfig.password) {
          const credentials = Buffer.from(`${this.authConfig.username}:${this.authConfig.password}`).toString('base64');
          this.headers['Authorization'] = `Basic ${credentials}`;
        }
        break;
      
      case 'bearer':
        if (this.authConfig.token) {
          this.headers['Authorization'] = `Bearer ${this.authConfig.token}`;
        }
        break;
      
      case 'oauth2':
        if (this.authConfig.token) {
          this.headers['Authorization'] = `Bearer ${this.authConfig.token}`;
        }
        break;
    }
  }

  // Method to update authentication configuration
  updateAuthConfig(authConfig: AuthConfig): void {
    this.authConfig = authConfig;
    // Remove existing auth headers
    delete this.headers['Authorization'];
    // Apply new authentication
    this.applyAuthentication();
  }

  async testConnection(): Promise<{ 
    connected: boolean; 
    version?: string; 
    error?: string;
    errorType?: string;
    statusCode?: number;
    responseTime?: number;
  }> {
    const startTime = Date.now();
    
    try {
      const response = await axios.get(`${this.baseUrl}/metadata`, {
        headers: this.headers,
        timeout: 10000,
        validateStatus: (status) => status < 500, // Accept 4xx as valid responses
      });

      const responseTime = Date.now() - startTime;

      if (response.status === 200 && response.data.resourceType === 'CapabilityStatement') {
        return {
          connected: true,
          version: response.data.fhirVersion || 'Unknown',
          responseTime,
        };
      }

      // Handle different HTTP status codes
      if (response.status === 401) {
        return {
          connected: false,
          error: 'Authentication required - server requires credentials',
          errorType: 'authentication_required',
          statusCode: response.status,
          responseTime,
        };
      }

      if (response.status === 403) {
        return {
          connected: false,
          error: 'Access forbidden - insufficient permissions',
          errorType: 'access_forbidden',
          statusCode: response.status,
          responseTime,
        };
      }

      if (response.status === 404) {
        return {
          connected: false,
          error: 'FHIR metadata endpoint not found - server may not support FHIR',
          errorType: 'endpoint_not_found',
          statusCode: response.status,
          responseTime,
        };
      }

      if (response.status >= 400 && response.status < 500) {
        return {
          connected: false,
          error: `Client error: ${response.status} ${response.statusText}`,
          errorType: 'client_error',
          statusCode: response.status,
          responseTime,
        };
      }

      if (response.status >= 500) {
        return {
          connected: false,
          error: `Server error: ${response.status} ${response.statusText}`,
          errorType: 'server_error',
          statusCode: response.status,
          responseTime,
        };
      }

      return {
        connected: false,
        error: 'Invalid FHIR server response - not a valid CapabilityStatement',
        errorType: 'invalid_response',
        statusCode: response.status,
        responseTime,
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      // Handle different types of network errors
      if (error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN') {
        return {
          connected: false,
          error: 'DNS resolution failed - server hostname not found',
          errorType: 'dns_error',
          responseTime,
        };
      }

      if (error.code === 'ECONNREFUSED') {
        return {
          connected: false,
          error: 'Connection refused - server is not running or not accepting connections',
          errorType: 'connection_refused',
          responseTime,
        };
      }

      if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
        return {
          connected: false,
          error: 'Connection timeout - server did not respond within 10 seconds',
          errorType: 'timeout',
          responseTime,
        };
      }

      if (error.code === 'ECONNRESET') {
        return {
          connected: false,
          error: 'Connection reset by server',
          errorType: 'connection_reset',
          responseTime,
        };
      }

      if (error.code === 'CERT_HAS_EXPIRED' || error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
        return {
          connected: false,
          error: 'SSL certificate error - server certificate is invalid or expired',
          errorType: 'ssl_error',
          responseTime,
        };
      }

      // Generic error handling
      return {
        connected: false,
        error: error.message || 'Unknown connection error',
        errorType: 'unknown_error',
        responseTime,
      };
    }
  }

  async searchResources(
    resourceType: string,
    params: Record<string, string | number> = {},
    count = 20
  ): Promise<FhirBundle> {
    try {
      const searchParams = new URLSearchParams();
      
      // Add all parameters from params first
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.set(key, value.toString());
        }
      });
      
      // Only set _count if not already provided in params
      if (!params._count && count !== undefined) {
        searchParams.set('_count', count.toString());
      }
      
      // Always set format to json
      searchParams.set('_format', 'json');

      const url = `${this.baseUrl}/${resourceType}?${searchParams.toString()}`;
      console.log(`[FhirClient] Calling URL: ${url}`);
      
      const response: AxiosResponse<FhirBundle> = await axios.get(
        url,
        { 
          headers: this.headers,
          timeout: 8000 // 8 second timeout for faster response
        }
      );

      console.log(`[FhirClient] Response total: ${response.data.total}, entry count: ${response.data.entry?.length || 0}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.data?.resourceType === 'OperationOutcome') {
        throw new Error(`FHIR Error: ${this.formatOperationOutcome(error.response.data)}`);
      }
      throw new Error(`Failed to search ${resourceType}: ${error.message}`);
    }
  }

  async searchAllResources(
    resourceType: string,
    params: Record<string, string | number> = {},
    maxResources?: number
  ): Promise<any[]> {
    try {
      console.log(`[FhirClient] Starting paginated search for ${resourceType}`);
      
      const allResources: any[] = [];
      let nextUrl: string | null = null;
      let pageCount = 0;
      const maxPages = 20; // Safety limit to prevent infinite loops
      
      // Start with initial search
      const searchParams = new URLSearchParams();
      
      // Add all parameters from params first
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.set(key, value.toString());
        }
      });
      
      // Set a reasonable page size for pagination
      searchParams.set('_count', '500'); // Most FHIR servers limit to 500-1000 per page
      searchParams.set('_format', 'json');

      let url = `${this.baseUrl}/${resourceType}?${searchParams.toString()}`;
      
      while (url && pageCount < maxPages) {
        pageCount++;
        console.log(`[FhirClient] Fetching page ${pageCount} for ${resourceType}: ${url}`);
        
        const response: AxiosResponse<FhirBundle> = await axios.get(
          url,
          { 
            headers: this.headers,
            timeout: 15000 // Longer timeout for pagination
          }
        );

        const bundle = response.data;
        const pageResources = bundle.entry?.map(entry => entry.resource) || [];
        allResources.push(...pageResources);
        
        console.log(`[FhirClient] Page ${pageCount}: Found ${pageResources.length} resources, total so far: ${allResources.length}`);
        
        // Check if we've hit the max resources limit
        if (maxResources && allResources.length >= maxResources) {
          console.log(`[FhirClient] Reached max resources limit: ${maxResources}`);
          break;
        }
        
        // Look for next page link
        nextUrl = null;
        if (bundle.link) {
          const nextLink = bundle.link.find(link => link.relation === 'next');
          if (nextLink) {
            nextUrl = nextLink.url;
          }
        }
        
        url = nextUrl;
        
        // Small delay between requests to be respectful to the server
        if (url) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      console.log(`[FhirClient] Completed paginated search for ${resourceType}: ${allResources.length} total resources across ${pageCount} pages`);
      return allResources;
      
    } catch (error: any) {
      if (error.response?.data?.resourceType === 'OperationOutcome') {
        throw new Error(`FHIR Error: ${this.formatOperationOutcome(error.response.data)}`);
      }
      throw new Error(`Failed to search all ${resourceType}: ${error.message}`);
    }
  }

  async getResource(resourceType: string, id: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/${resourceType}/${id}`,
        { headers: this.headers }
      );

      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      if (error.response?.data?.resourceType === 'OperationOutcome') {
        throw new Error(`FHIR Error: ${this.formatOperationOutcome(error.response.data)}`);
      }
      throw new Error(`Failed to get ${resourceType}/${id}: ${error.message}`);
    }
  }

  async getAllResourceTypes(): Promise<string[]> {
    try {
      console.log('[FhirClient] Fetching CapabilityStatement to determine supported resource types...');
      const response = await axios.get(`${this.baseUrl}/metadata`, {
        headers: this.headers,
        timeout: 15000,
      });

      const capabilityStatement = response.data;
      const fhirVersion = capabilityStatement.fhirVersion;
      console.log(`[FhirClient] Server FHIR version: ${fhirVersion}`);
      
      // First try to get resource types from server's CapabilityStatement
      if (capabilityStatement.rest && capabilityStatement.rest[0]?.resource) {
        const serverResourceTypes = capabilityStatement.rest[0].resource.map((r: any) => r.type);
        console.log(`[FhirClient] Server declares support for ${serverResourceTypes.length} resource types`);
        return serverResourceTypes;
      }

      // Fallback to FHIR version-specific resource types based on official specification
      console.log('[FhirClient] Server CapabilityStatement incomplete, using FHIR version-specific fallback');
      
      if (fhirVersion && fhirVersion.startsWith('5.')) {
        // FHIR R5 resource types
        console.log('[FhirClient] Using FHIR R5 resource types');
        return this.getFhirR5ResourceTypes();
      } else {
        // FHIR R4 resource types (default)
        console.log('[FhirClient] Using FHIR R4 resource types');
        return this.getFhirR4ResourceTypes();
      }
    } catch (error) {
      console.warn('[FhirClient] Failed to fetch CapabilityStatement, using FHIR R4 fallback');
      return this.getFhirR4ResourceTypes();
    }
  }

  private getFhirR4ResourceTypes(): string[] {
    // Official FHIR R4 resource types from http://hl7.org/fhir/R4/resourcelist.html
    return [
      'Account', 'ActivityDefinition', 'AdverseEvent', 'AllergyIntolerance', 'Appointment', 
      'AppointmentResponse', 'AuditEvent', 'Basic', 'Binary', 'BiologicallyDerivedProduct',
      'BodyStructure', 'Bundle', 'CapabilityStatement', 'CarePlan', 'CareTeam', 'CatalogEntry',
      'ChargeItem', 'ChargeItemDefinition', 'Claim', 'ClaimResponse', 'ClinicalImpression',
      'CodeSystem', 'Communication', 'CommunicationRequest', 'CompartmentDefinition',
      'Composition', 'ConceptMap', 'Condition', 'Consent', 'Contract', 'Coverage',
      'CoverageEligibilityRequest', 'CoverageEligibilityResponse', 'DetectedIssue', 'Device',
      'DeviceDefinition', 'DeviceMetric', 'DeviceRequest', 'DeviceUseStatement',
      'DiagnosticReport', 'DocumentManifest', 'DocumentReference', 'DomainResource',
      'EffectEvidenceSynthesis', 'Encounter', 'Endpoint', 'EnrollmentRequest',
      'EnrollmentResponse', 'EpisodeOfCare', 'EventDefinition', 'Evidence', 'EvidenceVariable',
      'ExampleScenario', 'ExplanationOfBenefit', 'FamilyMemberHistory', 'Flag', 'Goal',
      'GraphDefinition', 'Group', 'GuidanceResponse', 'HealthcareService', 'ImagingStudy',
      'Immunization', 'ImmunizationEvaluation', 'ImmunizationRecommendation',
      'ImplementationGuide', 'InsurancePlan', 'Invoice', 'Library', 'Linkage', 'List',
      'Location', 'Measure', 'MeasureReport', 'Media', 'Medication', 'MedicationAdministration',
      'MedicationDispense', 'MedicationKnowledge', 'MedicationRequest', 'MedicationStatement',
      'MedicinalProduct', 'MedicinalProductAuthorization', 'MedicinalProductContraindication',
      'MedicinalProductIndication', 'MedicinalProductIngredient', 'MedicinalProductInteraction',
      'MedicinalProductManufactured', 'MedicinalProductPackaged', 'MedicinalProductPharmaceutical',
      'MedicinalProductUndesirableEffect', 'MessageDefinition', 'MessageHeader', 'MolecularSequence',
      'NamingSystem', 'NutritionOrder', 'Observation', 'ObservationDefinition', 'OperationDefinition',
      'OperationOutcome', 'Organization', 'OrganizationAffiliation', 'Parameters', 'Patient',
      'PaymentNotice', 'PaymentReconciliation', 'Person', 'PlanDefinition', 'Practitioner',
      'PractitionerRole', 'Procedure', 'Provenance', 'Questionnaire', 'QuestionnaireResponse',
      'RelatedPerson', 'RequestGroup', 'ResearchDefinition', 'ResearchElementDefinition',
      'ResearchStudy', 'ResearchSubject', 'Resource', 'RiskAssessment', 'RiskEvidenceSynthesis',
      'Schedule', 'SearchParameter', 'ServiceRequest', 'Slot', 'Specimen', 'SpecimenDefinition',
      'StructureDefinition', 'StructureMap', 'Subscription', 'Substance', 'SubstanceNucleicAcid',
      'SubstancePolymer', 'SubstanceProtein', 'SubstanceReferenceInformation', 'SubstanceSourceMaterial',
      'SubstanceSpecification', 'SupplyDelivery', 'SupplyRequest', 'Task', 'TerminologyCapabilities',
      'TestReport', 'TestScript', 'ValueSet', 'VerificationResult', 'VisionPrescription'
    ];
  }

  private getFhirR5ResourceTypes(): string[] {
    // Official FHIR R5 resource types from http://hl7.org/fhir/R5/resourcelist.html
    return [
      'Account', 'ActivityDefinition', 'ActorDefinition', 'AdministrableProductDefinition',
      'AdverseEvent', 'AllergyIntolerance', 'Appointment', 'AppointmentResponse', 'ArtifactAssessment',
      'AuditEvent', 'Basic', 'Binary', 'BiologicallyDerivedProduct', 'BiologicallyDerivedProductDispense',
      'BodyStructure', 'Bundle', 'CapabilityStatement', 'CarePlan', 'CareTeam', 'ChargeItem',
      'ChargeItemDefinition', 'Citation', 'Claim', 'ClaimResponse', 'ClinicalImpression',
      'ClinicalUseDefinition', 'CodeSystem', 'Communication', 'CommunicationRequest',
      'CompartmentDefinition', 'Composition', 'ConceptMap', 'Condition', 'ConditionDefinition',
      'Consent', 'Contract', 'Coverage', 'CoverageEligibilityRequest', 'CoverageEligibilityResponse',
      'DetectedIssue', 'Device', 'DeviceAssociation', 'DeviceDefinition', 'DeviceDispense',
      'DeviceMetric', 'DeviceRequest', 'DeviceUsage', 'DiagnosticReport', 'DocumentReference',
      'Encounter', 'EncounterHistory', 'Endpoint', 'EnrollmentRequest', 'EnrollmentResponse',
      'EpisodeOfCare', 'EventDefinition', 'Evidence', 'EvidenceReport', 'EvidenceVariable',
      'ExampleScenario', 'ExplanationOfBenefit', 'FamilyMemberHistory', 'Flag', 'FormularyItem',
      'GenomicStudy', 'Goal', 'GraphDefinition', 'Group', 'GuidanceResponse', 'HealthcareService',
      'ImagingSelection', 'ImagingStudy', 'Immunization', 'ImmunizationEvaluation',
      'ImmunizationRecommendation', 'ImplementationGuide', 'Ingredient', 'InsurancePlan',
      'InventoryItem', 'InventoryReport', 'Invoice', 'Library', 'Linkage', 'List', 'Location',
      'ManufacturedItemDefinition', 'Measure', 'MeasureReport', 'Medication', 'MedicationAdministration',
      'MedicationDispense', 'MedicationKnowledge', 'MedicationRequest', 'MedicationStatement',
      'MedicinalProductDefinition', 'MessageDefinition', 'MessageHeader', 'MolecularSequence',
      'NamingSystem', 'NutritionIntake', 'NutritionOrder', 'NutritionProduct', 'Observation',
      'ObservationDefinition', 'OperationDefinition', 'OperationOutcome', 'Organization',
      'OrganizationAffiliation', 'PackagedProductDefinition', 'Parameters', 'Patient',
      'PaymentNotice', 'PaymentReconciliation', 'Permission', 'Person', 'PlanDefinition',
      'Practitioner', 'PractitionerRole', 'Procedure', 'Provenance', 'Questionnaire',
      'QuestionnaireResponse', 'RegulatedAuthorization', 'RelatedPerson', 'RequestOrchestration',
      'Requirements', 'ResearchStudy', 'ResearchSubject', 'RiskAssessment', 'Schedule',
      'SearchParameter', 'ServiceRequest', 'Slot', 'Specimen', 'SpecimenDefinition',
      'StructureDefinition', 'StructureMap', 'Subscription', 'SubscriptionStatus',
      'SubscriptionTopic', 'Substance', 'SubstanceDefinition', 'SubstanceNucleicAcid',
      'SubstancePolymer', 'SubstanceProtein', 'SubstanceReferenceInformation', 'SubstanceSourceMaterial',
      'SupplyDelivery', 'SupplyRequest', 'Task', 'TerminologyCapabilities', 'TestPlan',
      'TestReport', 'TestScript', 'Transport', 'ValueSet', 'VerificationResult', 'VisionPrescription'
    ];
  }

  async getResourceCount(resourceType: string): Promise<number> {
    try {
      console.log(`[FhirClient] Getting count for ${resourceType}...`);
      
      // Try multiple approaches to get accurate counts
      
      // Approach 1: Use _summary=count with _total=accurate parameter  
      try {
        const countUrl = `${this.baseUrl}/${resourceType}?_summary=count&_total=accurate`;
        logger.fhir(logger.getLogLevel() >= 3 ? 3 : 2, `Getting count for ${resourceType}`, 'getResourceCount', { url: countUrl });
        const countResponse = await axios.get(countUrl, { 
          headers: this.headers,
          timeout: 15000
        });
        
        logger.fhir(4, `Count response received`, 'getResourceCount', { resourceType, total: countResponse.data.total });
        
        if (countResponse.data?.total !== undefined) {
          logger.fhir(2, `Count for ${resourceType}: ${countResponse.data.total}`, 'getResourceCount', { method: '_summary=count&_total=accurate' });
          return countResponse.data.total;
        }
      } catch (summaryError) {
        logger.fhir(3, `_summary=count with _total=accurate failed`, 'getResourceCount', { resourceType, error: summaryError.message });
      }
      
      // Approach 1b: Try with _total=true instead
      try {
        const countUrl = `${this.baseUrl}/${resourceType}?_summary=count&_total=true`;
        logger.fhir(3, `Trying count URL with _total=true`, 'getResourceCount', { url: countUrl });
        const countResponse = await axios.get(countUrl, { 
          headers: this.headers,
          timeout: 15000
        });
        
        logger.fhir(4, `Count response with _total=true received`, 'getResourceCount', { resourceType, total: countResponse.data.total });
        
        if (countResponse.data?.total !== undefined) {
          logger.fhir(2, `Count for ${resourceType}: ${countResponse.data.total}`, 'getResourceCount', { method: '_summary=count&_total=true' });
          return countResponse.data.total;
        }
      } catch (summaryError) {
        logger.fhir(3, `_summary=count with _total=true failed`, 'getResourceCount', { resourceType, error: summaryError.message });
      }
      
      // Approach 2: Use small _count with _total=accurate
      const response = await this.searchResources(resourceType, { _count: '1', _total: 'accurate' });
      
      // If the server provides a total, use it
      if (response.total !== undefined && response.total !== null) {
        logger.fhir(2, `Count for ${resourceType}: ${response.total}`, 'getResourceCount', { method: 'search total' });
        return response.total;
      }

      // Approach 3: If no total available, try to estimate by fetching larger samples
      logger.fhir(3, `No total available, attempting sample-based estimation`, 'getResourceCount', { resourceType });
      
      try {
        const largerSample = await this.searchResources(resourceType, { _count: '100', _total: 'accurate' });
        if (largerSample.entry && largerSample.entry.length > 0) {
          // If we got exactly 100, there are likely more - try to get better estimate
          if (largerSample.entry.length === 100) {
            // Try to get multiple pages to estimate total
            let totalEstimate = 100;
            let hasMorePages = true;
            let pageOffset = 100;
            
            // Try to sample up to 5 pages to get better estimate
            for (let page = 2; page <= 5 && hasMorePages; page++) {
              try {
                const nextSample = await this.searchResources(resourceType, { 
                  _count: '100', 
                  _offset: pageOffset.toString(),
                  _total: 'accurate'
                });
                
                if (nextSample.entry && nextSample.entry.length > 0) {
                  totalEstimate += nextSample.entry.length;
                  pageOffset += 100;
                  
                  // If we got less than 100, we've reached the end
                  if (nextSample.entry.length < 100) {
                    hasMorePages = false;
                  }
                } else {
                  hasMorePages = false;
                }
              } catch (offsetError) {
                console.log(`[FhirClient] Offset query failed at page ${page}, stopping estimation`);
                hasMorePages = false;
              }
            }
            
            // If we sampled 5 pages and still have 100 per page, extrapolate
            if (hasMorePages && totalEstimate >= 500) {
              const averagePerPage = totalEstimate / 5;
              // Conservative extrapolation: assume at least 10 more pages
              totalEstimate = Math.round(averagePerPage * 15);
            }
            
            logger.fhir(2, `Estimated count for ${resourceType}: ${totalEstimate}`, 'getResourceCount', { method: 'multi-page sampling' });
            return totalEstimate;
          } else {
            logger.fhir(2, `Count for ${resourceType}: ${largerSample.entry.length}`, 'getResourceCount', { method: 'complete sample' });
            return largerSample.entry.length;
          }
        }
      } catch (sampleError) {
        logger.fhir(3, `Sample-based estimation failed`, 'getResourceCount', { resourceType, error: sampleError.message });
      }
      
      // If we have any entries from the original search, return at least 1
      if (response.entry && response.entry.length > 0) {
        logger.fhir(2, `Minimum count for ${resourceType}: 1`, 'getResourceCount', { method: 'has entries' });
        return 1;
      }
      
      logger.fhir(2, `Count for ${resourceType}: 0`, 'getResourceCount', { method: 'no entries found' });
      return 0;
      
    } catch (error) {
      logger.fhir(1, `Failed to get count`, 'getResourceCount', { resourceType, error: error.message });
      return 0; // Return 0 instead of hardcoded values when server fails
    }
  }

  async validateResource(resource: any, profile?: string): Promise<FhirOperationOutcome> {
    try {
      const validateUrl = `${this.baseUrl}/${resource.resourceType}/$validate`;
      const params: Record<string, string> = {};
      
      if (profile) {
        params.profile = profile;
      }

      const searchParams = new URLSearchParams(params);
      const url = searchParams.toString() ? `${validateUrl}?${searchParams}` : validateUrl;

      const response: AxiosResponse<FhirOperationOutcome> = await axios.post(
        url,
        resource,
        { headers: this.headers }
      );

      return response.data;
    } catch (error: any) {
      if (error.response?.data?.resourceType === 'OperationOutcome') {
        return error.response.data;
      }
      
      // Create a synthetic OperationOutcome for network/other errors
      return {
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'processing',
          details: { text: error.message || 'Validation failed' },
        }],
      };
    }
  }

  async getImplementationGuides(): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/ImplementationGuide`, {
        headers: this.headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch implementation guides: ${response.statusText}`);
      }

      const bundle = await response.json();
      return bundle.entry?.map((entry: any) => entry.resource) || [];
    } catch (error: any) {
      console.warn('Failed to fetch implementation guides:', error);
      return [];
    }
  }

  async getStructureDefinitions(): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/StructureDefinition`, {
        headers: this.headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch structure definitions: ${response.statusText}`);
      }

      const bundle = await response.json();
      return bundle.entry?.map((entry: any) => entry.resource) || [];
    } catch (error: any) {
      console.warn('Failed to fetch structure definitions:', error);
      return [];
    }
  }

  async getCapabilityStatement(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/metadata`, {
        headers: this.headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch capability statement: ${response.statusText}`);
      }

      return await response.json();
    } catch (error: any) {
      console.warn('Failed to fetch capability statement:', error);
      return null;
    }
  }

  async scanInstalledPackages(): Promise<any[]> {
    try {
      const packages: any[] = [];
      
      // Get Implementation Guides
      const implementationGuides = await this.getImplementationGuides();
      
      // Get Structure Definitions to understand profiles
      const structureDefinitions = await this.getStructureDefinitions();
      
      // Get Capability Statement for server information
      const capabilityStatement = await this.getCapabilityStatement();
      
      // Process Implementation Guides as packages
      for (const ig of implementationGuides) {
        const packageInfo = {
          id: ig.id || ig.url,
          name: ig.name || ig.title,
          title: ig.title || ig.name,
          version: ig.version || '1.0.0',
          status: ig.status || 'active',
          publisher: ig.publisher || 'Unknown',
          description: ig.description || '',
          url: ig.url,
          fhirVersion: ig.fhirVersion?.[0] || capabilityStatement?.fhirVersion || '4.0.1',
          type: 'ImplementationGuide',
          profileCount: structureDefinitions.filter(sd => 
            sd.url?.includes(ig.url?.replace(/\/ImplementationGuide\/.*/, '')) ||
            sd.publisher === ig.publisher
          ).length,
          lastModified: ig.meta?.lastUpdated || new Date().toISOString()
        };
        packages.push(packageInfo);
      }
      
      // Group standalone profiles by publisher/package
      const standaloneSDs = structureDefinitions.filter(sd => 
        !implementationGuides.some(ig => 
          sd.url?.includes(ig.url?.replace(/\/ImplementationGuide\/.*/, '')) ||
          sd.publisher === ig.publisher
        )
      );
      
      const groupedByPublisher = standaloneSDs.reduce((groups: any, sd: any) => {
        const publisher = sd.publisher || 'Unknown Publisher';
        if (!groups[publisher]) {
          groups[publisher] = [];
        }
        groups[publisher].push(sd);
        return groups;
      }, {});
      
      // Create packages for grouped standalone profiles
      for (const [publisher, profiles] of Object.entries(groupedByPublisher)) {
        const packageInfo = {
          id: `standalone-${publisher.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          name: `${publisher} Profiles`,
          title: `${publisher} Structure Definitions`,
          version: '1.0.0',
          status: 'active',
          publisher: publisher,
          description: `Standalone structure definitions from ${publisher}`,
          url: `http://fhir.server/packages/${publisher}`,
          fhirVersion: capabilityStatement?.fhirVersion || '4.0.1',
          type: 'ProfilePackage',
          profileCount: (profiles as any[]).length,
          lastModified: new Date().toISOString()
        };
        packages.push(packageInfo);
      }
      
      return packages;
    } catch (error: any) {
      console.warn('Failed to scan installed packages:', error);
      return [];
    }
  }

  // Alias for getAllResourceTypes to match API expectations
  async getResourceTypes(): Promise<string[]> {
    return this.getAllResourceTypes();
  }

  // Get resource counts for multiple resource types (optimized for performance)
  async getResourceCounts(): Promise<Record<string, number>> {
    try {
      console.log('[FhirClient] Getting resource counts for common resource types...');
      
      // Only get counts for the most common resource types to avoid timeouts
      const commonResourceTypes = [
        'Patient', 'Observation', 'Encounter', 'Condition', 'DiagnosticReport',
        'Medication', 'MedicationRequest', 'Procedure', 'AllergyIntolerance',
        'Immunization', 'DocumentReference', 'Organization', 'Practitioner'
      ];
      
      const counts: Record<string, number> = {};
      
      // Use simpler approach - just get counts directly without complex batching
      for (const resourceType of commonResourceTypes) {
        try {
          console.log(`[FhirClient] Getting count for ${resourceType}...`);
          
          // Use the same approach as the working resource fetch
          const response = await this.searchResources(resourceType, { _count: '1', _total: 'accurate' });
          
          if (response.total !== undefined && response.total !== null) {
            counts[resourceType] = response.total;
            console.log(`[FhirClient] ${resourceType}: ${response.total}`);
          } else {
            console.warn(`[FhirClient] No total available for ${resourceType}`);
            counts[resourceType] = 0;
          }
        } catch (error) {
          console.warn(`[FhirClient] Failed to get count for ${resourceType}:`, error.message);
          counts[resourceType] = 0;
        }
      }
      
      console.log(`[FhirClient] Completed resource counts for ${Object.keys(counts).length} resource types`);
      return counts;
    } catch (error) {
      console.error('[FhirClient] Failed to get resource counts:', error);
      return {};
    }
  }

  private formatOperationOutcome(outcome: FhirOperationOutcome): string {
    return outcome.issue
      .map(issue => `${issue.severity}: ${issue.details?.text || issue.diagnostics || 'Unknown error'}`)
      .join('; ');
  }
}
