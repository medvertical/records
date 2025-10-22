import axios, { AxiosResponse } from 'axios';
import { errorHandler } from '../../utils/error-handler.js';
import { logger } from '../../utils/logger.js';
import { getFhirValidateOperation, ValidateOperationOptions, ValidateOperationResult } from './fhir-validate-operation';
import { getRequestQueue } from './request-queue';
import { batchExecuteWithRetry } from './retry-handler';
import { getFhirCache, DEFAULT_TTLS } from './fhir-cache';

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
  private serverId: number;

  constructor(baseUrl: string, authConfig?: AuthConfig, serverId: number = 1) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    this.authConfig = authConfig;
    this.serverId = serverId;
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
      
      // Use 30s timeout for all queries to accommodate slower FHIR servers like Fire.ly
      const timeout = 30000; // 30s for all queries
      
      const response: AxiosResponse<FhirBundle> = await axios.get(
        url,
        { 
          headers: this.headers,
          timeout
        }
      );

      // Check if the response is an OperationOutcome (error response)
      if (response.data.resourceType === 'OperationOutcome') {
        const outcomeDetails = this.extractOperationOutcomeDetails(response.data);
        const error: any = new Error(`FHIR Error: ${this.formatOperationOutcome(response.data)}`);
        error.operationOutcome = response.data;
        error.outcomeDetails = outcomeDetails;
        throw error;
      }
      
      console.log(`[FhirClient] Response total: ${response.data.total}, entry count: ${response.data.entry?.length || 0}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.data?.resourceType === 'OperationOutcome') {
        const outcomeDetails = this.extractOperationOutcomeDetails(error.response.data);
        const fhirError: any = new Error(`FHIR Error: ${this.formatOperationOutcome(error.response.data)}`);
        fhirError.operationOutcome = error.response.data;
        fhirError.outcomeDetails = outcomeDetails;
        throw fhirError;
      }
      throw error;
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

  async getResourceHistory(resourceType: string, id: string, count: number = 10): Promise<{
    total: number;
    versions: Array<{
      versionId: string;
      lastModified: string;
      resource?: any;
    }>;
  }> {
    try {
      const url = `${this.baseUrl}/${resourceType}/${id}/_history?_count=${count}&_format=json`;
      console.log(`[FhirClient] Fetching version history: ${url}`);
      
      const response: AxiosResponse<FhirBundle> = await axios.get(url, {
        headers: this.headers,
        timeout: 10000,
      });

      const bundle = response.data;
      const versions: Array<{ versionId: string; lastModified: string; resource?: any }> = [];

      if (bundle.entry) {
        for (const entry of bundle.entry) {
          const resource = entry.resource;
          if (resource?.meta?.versionId) {
            versions.push({
              versionId: resource.meta.versionId,
              lastModified: resource.meta.lastUpdated || new Date().toISOString(),
              resource: resource,
            });
          }
        }
      }

      return {
        total: bundle.total || versions.length,
        versions,
      };
    } catch (error: any) {
      // If server doesn't support _history, return minimal data
      if (error.response?.status === 404 || error.response?.status === 501) {
        console.warn(`[FhirClient] Server does not support _history for ${resourceType}/${id}`);
        return { total: 1, versions: [] };
      }
      
      if (error.response?.data?.resourceType === 'OperationOutcome') {
        console.warn(`[FhirClient] History operation failed: ${this.formatOperationOutcome(error.response.data)}`);
        return { total: 1, versions: [] };
      }
      
      throw new Error(`Failed to get history for ${resourceType}/${id}: ${error.message}`);
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

  async validateResourceDirect(resource: any, profile?: string): Promise<FhirOperationOutcome> {
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

  /**
   * Detects and normalizes FHIR version from CapabilityStatement
   * @returns Normalized FHIR version (R4, R5, R6) or null if detection fails
   */
  async getFhirVersion(): Promise<string | null> {
    try {
      const capability = await this.getCapabilityStatement();
      
      if (!capability) {
        logger.warn('[FhirClient] Could not fetch CapabilityStatement for version detection');
        return null;
      }

      const version = capability.fhirVersion;
      
      if (!version) {
        logger.warn('[FhirClient] CapabilityStatement missing fhirVersion field');
        return null;
      }

      // Normalize FHIR version to Rx format
      const normalized = this.normalizeFhirVersion(version);
      logger.info(`[FhirClient] Detected FHIR version: ${version} → ${normalized}`);
      
      return normalized;
    } catch (error: any) {
      logger.error('[FhirClient] Failed to detect FHIR version:', error);
      return null;
    }
  }

  /**
   * Normalizes FHIR version string to standard Rx format
   * @param version - Raw FHIR version (e.g., "4.0.1", "5.0.0", "6.0.0-ballot1")
   * @returns Normalized version (R4, R5, R6) or R4 as fallback
   */
  private normalizeFhirVersion(version: string): string {
    if (!version) return 'R4';

    // Extract major version number
    const majorVersion = version.split('.')[0];

    switch (majorVersion) {
      case '4':
        return 'R4';
      case '5':
        return 'R5';
      case '6':
        return 'R6';
      default:
        // Check if version string already contains R4/R5/R6
        if (version.toUpperCase().includes('R4')) return 'R4';
        if (version.toUpperCase().includes('R5')) return 'R5';
        if (version.toUpperCase().includes('R6')) return 'R6';
        
        // Fallback to R4 for unknown versions
        logger.warn(`[FhirClient] Unknown FHIR version ${version}, defaulting to R4`);
        return 'R4';
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
  async getResourceCounts(resourceTypes?: string[]): Promise<Record<string, number>> {
    try {
      console.log('[FhirClient] Getting resource counts...');
      
      // If no resource types provided, get all from CapabilityStatement
      let typesToQuery: string[];
      if (resourceTypes && resourceTypes.length > 0) {
        typesToQuery = resourceTypes;
        console.log(`[FhirClient] Using provided ${typesToQuery.length} resource types`);
      } else {
        // Use getAllResourceTypes which reads from CapabilityStatement
        typesToQuery = await this.getAllResourceTypes();
        console.log(`[FhirClient] Using ${typesToQuery.length} resource types from CapabilityStatement`);
      }
      
      // Fetch all resource counts in parallel for better performance
      console.log(`[FhirClient] Fetching counts for ${typesToQuery.length} resource types in parallel...`);
      const countPromises = typesToQuery.map(async (resourceType) => {
        try {
          // Use the same approach as the working resource fetch
          const response = await this.searchResources(resourceType, { _count: '1', _total: 'accurate' });
          
          if (response.total !== undefined && response.total !== null) {
            console.log(`[FhirClient] ${resourceType}: ${response.total}`);
            return { resourceType, count: response.total };
          } else {
            console.warn(`[FhirClient] No total available for ${resourceType}`);
            return { resourceType, count: 0 };
          }
        } catch (error: any) {
          console.warn(`[FhirClient] Failed to get count for ${resourceType}:`, error.message);
          return { resourceType, count: 0 };
        }
      });
      
      // Wait for all promises to resolve
      const results = await Promise.all(countPromises);
      
      // Convert results array to counts object
      const counts: Record<string, number> = {};
      results.forEach(({ resourceType, count }) => {
        counts[resourceType] = count;
      });
      
      console.log(`[FhirClient] Completed resource counts for ${Object.keys(counts).length} resource types`);
      return counts;
    } catch (error) {
      console.error('[FhirClient] Failed to get resource counts:', error);
      return {};
    }
  }

  /**
   * Get resource counts sequentially with per-type timeout to avoid overloading slow FHIR servers
   * @param resourceTypes Optional array of resource types to query
   * @param timeoutPerType Timeout in ms for each resource type (default: 5000ms)
   */
  async getResourceCountsSequential(resourceTypes?: string[], timeoutPerType: number = 5000): Promise<Record<string, number>> {
    try {
      console.log('[FhirClient] Getting resource counts sequentially...');
      
      // If no resource types provided, get all from CapabilityStatement
      let typesToQuery: string[];
      if (resourceTypes && resourceTypes.length > 0) {
        typesToQuery = resourceTypes;
        console.log(`[FhirClient] Using provided ${typesToQuery.length} resource types`);
      } else {
        // Use getAllResourceTypes which reads from CapabilityStatement
        typesToQuery = await this.getAllResourceTypes();
        console.log(`[FhirClient] Using ${typesToQuery.length} resource types from CapabilityStatement`);
      }
      
      const counts: Record<string, number> = {};
      let successCount = 0;
      let failCount = 0;
      
      console.log(`[FhirClient] Fetching counts for ${typesToQuery.length} resource types sequentially (${timeoutPerType}ms timeout per type)...`);
      
      // Fetch counts one at a time
      for (const resourceType of typesToQuery) {
        try {
          // Race between the actual fetch and a timeout
          const count = await Promise.race([
            this.getResourceCount(resourceType),
            new Promise<number>((_, reject) => 
              setTimeout(() => reject(new Error(`Timeout after ${timeoutPerType}ms`)), timeoutPerType)
            )
          ]);
          
          counts[resourceType] = count;
          successCount++;
          
          // Log progress every 5 types or on last
          if (successCount % 5 === 0 || successCount + failCount === typesToQuery.length) {
            console.log(`[FhirClient] Progress: ${successCount + failCount}/${typesToQuery.length} (${successCount} succeeded, ${failCount} failed)`);
          }
        } catch (error: any) {
          console.warn(`[FhirClient] Failed to fetch ${resourceType} count:`, error.message);
          counts[resourceType] = 0; // Fallback to 0 on error
          failCount++;
        }
      }
      
      console.log(`[FhirClient] Sequential fetch complete: ${successCount} succeeded, ${failCount} failed, ${Object.keys(counts).length} total types`);
      return counts;
    } catch (error) {
      console.error('[FhirClient] Failed to get resource counts sequentially:', error);
      return {};
    }
  }

  /**
   * Get resource counts with batching, queuing, retry logic, and caching
   * This is the recommended method for HAPI and other servers that can be overwhelmed
   * @param resourceTypes Optional array of resource types to query
   * @param options Configuration options
   */
  async getResourceCountsBatched(
    resourceTypes?: string[],
    options: {
      batchSize?: number;
      batchDelay?: number;
      useCache?: boolean;
      cacheTtl?: number;
    } = {}
  ): Promise<Record<string, number>> {
    const {
      batchSize = 8,
      batchDelay = 100,
      useCache = true,
      cacheTtl = DEFAULT_TTLS.RESOURCE_COUNTS,
    } = options;

    try {
      console.log('[FhirClient] Getting resource counts with batching and retry...');
      
      // Get resource types to query
      let typesToQuery: string[];
      if (resourceTypes && resourceTypes.length > 0) {
        typesToQuery = resourceTypes;
        console.log(`[FhirClient] Using provided ${typesToQuery.length} resource types`);
      } else {
        typesToQuery = await this.getAllResourceTypes();
        console.log(`[FhirClient] Using ${typesToQuery.length} resource types from CapabilityStatement`);
      }

      const cache = getFhirCache();
      const queue = getRequestQueue();
      const counts: Record<string, number> = {};

      // Check cache first if enabled
      if (useCache) {
        const cacheKey = `resource-counts-all`;
        const cached = cache.get<Record<string, number>>(this.serverId, cacheKey, cacheTtl);
        if (cached) {
          console.log(`[FhirClient] Returning ${Object.keys(cached).length} cached resource counts`);
          return cached;
        }
      }

      // Batch execute with retry
      const { results, errors } = await batchExecuteWithRetry(
        typesToQuery,
        async (resourceType: string) => {
          // Use request queue for each count request
          return await queue.enqueue(
            `count-${this.serverId}-${resourceType}`,
            async () => {
              const count = await this.getResourceCount(resourceType);
              return { resourceType, count };
            },
            1 // Priority
          );
        },
        {
          batchSize,
          batchDelay,
          retryOptions: {
            requestId: `batch-counts-${this.serverId}`,
            onRetry: (attempt, error) => {
              console.log(`[FhirClient] Retrying resource count (attempt ${attempt})`);
            },
          },
          onProgress: (completed, total) => {
            if (completed % 10 === 0 || completed === total) {
              console.log(`[FhirClient] Progress: ${completed}/${total} resource types`);
            }
          },
        }
      );

      // Build counts object from successful results
      results.forEach(({ resourceType, count }) => {
        counts[resourceType] = count;
      });

      // For failed types, set count to 0
      if (errors.size > 0) {
        console.warn(`[FhirClient] Failed to get counts for ${errors.size} resource types`);
        errors.forEach((error, resourceType) => {
          counts[resourceType] = 0;
        });
      }

      // Cache the results if enabled
      if (useCache) {
        cache.set(this.serverId, `resource-counts-all`, counts);
      }

      console.log(`[FhirClient] Batched fetch complete: ${results.length} succeeded, ${errors.size} failed`);
      return counts;
    } catch (error) {
      console.error('[FhirClient] Failed to get resource counts with batching:', error);
      return {};
    }
  }

  /**
   * Get count for a single resource type
   * Throws errors for retryable status codes (429, 503, 504) to allow retry logic
   */
  private async getResourceCount(resourceType: string): Promise<number> {
    try {
      const response = await this.searchResources(resourceType, { _count: '1', _total: 'accurate' });
      
      if (response.total !== undefined && response.total !== null) {
        return response.total;
      } else {
        console.warn(`[FhirClient] No total available for ${resourceType}`);
        return 0;
      }
    } catch (error: any) {
      // Check if this is a retryable error (rate limiting, service unavailable, timeout)
      const statusCode = error.response?.status || error.statusCode;
      const isRetryable = statusCode === 429 || statusCode === 503 || statusCode === 504 ||
                         error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET';
      
      if (isRetryable) {
        // Throw retryable errors so the retry handler can catch them
        console.warn(`[FhirClient] Retryable error (${statusCode || error.code}) for ${resourceType}, throwing for retry`);
        throw error;
      }
      
      // For non-retryable errors, log and return 0
      console.warn(`[FhirClient] Non-retryable error fetching count for ${resourceType}:`, error.message);
      return 0;
    }
  }

  private formatOperationOutcome(outcome: FhirOperationOutcome): string {
    return outcome.issue
      .map(issue => `${issue.severity}: ${issue.details?.text || issue.diagnostics || 'Unknown error'}`)
      .join('; ');
  }

  private extractOperationOutcomeDetails(outcome: FhirOperationOutcome): { message: string; details: string; isUnsupportedParam: boolean } {
    const firstIssue = outcome.issue?.[0];
    const diagnostics = firstIssue?.diagnostics || '';
    const message = firstIssue?.details?.text || diagnostics || 'Unknown error';
    
    // Check if this is an unsupported parameter error
    const isUnsupportedParam = diagnostics.toLowerCase().includes('not supported') || 
                               diagnostics.toLowerCase().includes('not enabled') ||
                               diagnostics.toLowerCase().includes('unsupported') ||
                               diagnostics.toLowerCase().includes('parameter');
    
    return {
      message,
      details: diagnostics,
      isUnsupportedParam
    };
  }

  // ==========================================================================
  // Task 8.3: FHIR $validate Operation Integration
  // ==========================================================================

  /**
   * Validate a resource using the FHIR server's $validate operation
   * 
   * @param resourceType - Type of FHIR resource
   * @param resource - FHIR resource to validate
   * @param profileUrl - Optional profile URL to validate against
   * @param mode - Validation mode ('create' | 'update' | 'delete')
   * @returns ValidateOperationResult
   */
  async validateResource(
    resourceType: string,
    resource: any,
    profileUrl?: string,
    mode?: 'create' | 'update' | 'delete'
  ): Promise<ValidateOperationResult> {
    const validator = getFhirValidateOperation();

    const options: ValidateOperationOptions = {
      resourceType,
      resource,
      profileUrl,
      mode,
      timeout: 10000 // 10 seconds
    };

    return await validator.validate(this.baseUrl, options, this.headers);
  }

  /**
   * Check if the FHIR server supports the $validate operation
   * 
   * @returns boolean indicating support
   */
  async supportsValidateOperation(): Promise<boolean> {
    const validator = getFhirValidateOperation();
    
    try {
      const capabilityUrl = `${this.baseUrl}/metadata`;
      const response = await axios.get(capabilityUrl, {
        headers: this.headers,
        timeout: 5000
      });

      const capability = response.data;

      // Check for $validate operation
      if (capability.rest && Array.isArray(capability.rest)) {
        for (const rest of capability.rest) {
          if (rest.resource && Array.isArray(rest.resource)) {
            for (const resource of rest.resource) {
              if (resource.operation && Array.isArray(resource.operation)) {
                const hasValidate = resource.operation.some((op: any) => 
                  op.name === 'validate' || op.definition?.includes('validate')
                );
                if (hasValidate) return true;
              }
            }
          }
        }
      }

      return false;
    } catch (error) {
      console.error('[FhirClient] Failed to check $validate support:', error);
      return false;
    }
  }
}
