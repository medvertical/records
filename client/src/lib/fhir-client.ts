import { apiRequest } from "./queryClient";

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
    severity: 'fatal' | 'error' | 'warning' | 'information';
    code: string;
    details?: {
      text: string;
    };
    diagnostics?: string;
    location?: string[];
    expression?: string[];
  }>;
}

export interface ConnectionStatus {
  connected: boolean;
  version?: string;
  error?: string;
}

export interface ResourceSearchParams {
  resourceType?: string;
  search?: string;
  page?: number;
  _count?: number;
  [key: string]: any;
}

export interface ResourcesResponse {
  resources: any[];
  total: number;
}

export class FhirClientError extends Error {
  constructor(message: string, public statusCode?: number, public details?: any) {
    super(message);
    this.name = 'FhirClientError';
  }
}

export class FhirClient {
  private baseUrl = '/api/fhir';

  async testConnection(): Promise<ConnectionStatus> {
    try {
      const response = await apiRequest('GET', `${this.baseUrl}/connection/test`);
      return await response.json();
    } catch (error: any) {
      throw new FhirClientError('Failed to test FHIR connection', error.status, error);
    }
  }

  async getResourceTypes(): Promise<string[]> {
    try {
      const response = await apiRequest('GET', `${this.baseUrl}/resource-types`);
      return await response.json();
    } catch (error: any) {
      throw new FhirClientError('Failed to fetch resource types', error.status, error);
    }
  }

  async getResourceCounts(): Promise<Record<string, number>> {
    try {
      const response = await apiRequest('GET', `${this.baseUrl}/resource-counts`);
      const data = await response.json();
      
      // Transform the API response format to the expected format
      const counts: Record<string, number> = {};
      if (data.resourceTypes && Array.isArray(data.resourceTypes)) {
        data.resourceTypes.forEach((item: { resourceType: string; count: number }) => {
          counts[item.resourceType] = item.count;
        });
      }
      
      return counts;
    } catch (error: any) {
      throw new FhirClientError('Failed to fetch resource counts', error.status, error);
    }
  }

  async searchResources(params: ResourceSearchParams = {}): Promise<ResourcesResponse> {
    try {
      const searchParams = new URLSearchParams();
      
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, String(value));
        }
      });

      const url = `${this.baseUrl}/resources${searchParams.toString() ? `?${searchParams}` : ''}`;
      const response = await apiRequest('GET', url);
      return await response.json();
    } catch (error: any) {
      throw new FhirClientError('Failed to search resources', error.status, error);
    }
  }

  async getResource(id: string): Promise<any> {
    try {
      const response = await apiRequest('GET', `${this.baseUrl}/resources/${id}`);
      return await response.json();
    } catch (error: any) {
      if (error.status === 404) {
        return null;
      }
      throw new FhirClientError(`Failed to fetch resource ${id}`, error.status, error);
    }
  }

  async validateResource(
    resource: any, 
    profileUrl?: string, 
    config: any = {}
  ): Promise<{
    isValid: boolean;
    errors: any[];
    warnings: any[];
  }> {
    try {
      const response = await apiRequest('POST', '/api/validation/validate-resource', {
        resource,
        profileUrl,
        config,
      });
      return await response.json();
    } catch (error: any) {
      throw new FhirClientError('Failed to validate resource', error.status, error);
    }
  }

  async getValidationProfiles(resourceType?: string): Promise<any[]> {
    try {
      const searchParams = new URLSearchParams();
      if (resourceType) {
        searchParams.append('resourceType', resourceType);
      }
      
      const url = `/api/validation/profiles${searchParams.toString() ? `?${searchParams}` : ''}`;
      const response = await apiRequest('GET', url);
      return await response.json();
    } catch (error: any) {
      throw new FhirClientError('Failed to fetch validation profiles', error.status, error);
    }
  }

  async getRecentValidationErrors(limit = 10): Promise<any[]> {
    try {
      const response = await apiRequest('GET', `/api/validation/errors/recent?limit=${limit}`);
      return await response.json();
    } catch (error: any) {
      throw new FhirClientError('Failed to fetch recent validation errors', error.status, error);
    }
  }

  async getDashboardStats(): Promise<any> {
    try {
      const response = await apiRequest('GET', '/api/dashboard/stats');
      return await response.json();
    } catch (error: any) {
      throw new FhirClientError('Failed to fetch dashboard statistics', error.status, error);
    }
  }

  async getDashboardCards(): Promise<any[]> {
    try {
      const response = await apiRequest('GET', '/api/dashboard/cards');
      return await response.json();
    } catch (error: any) {
      throw new FhirClientError('Failed to fetch dashboard cards', error.status, error);
    }
  }

  // Server management
  async getFhirServers(): Promise<any[]> {
    try {
      const response = await apiRequest('GET', `${this.baseUrl}/servers`);
      return await response.json();
    } catch (error: any) {
      throw new FhirClientError('Failed to fetch FHIR servers', error.status, error);
    }
  }

  async createFhirServer(server: { name: string; url: string; isActive?: boolean }): Promise<any> {
    try {
      const response = await apiRequest('POST', `${this.baseUrl}/servers`, server);
      return await response.json();
    } catch (error: any) {
      throw new FhirClientError('Failed to create FHIR server', error.status, error);
    }
  }

  async activateFhirServer(id: number): Promise<void> {
    try {
      await apiRequest('POST', `${this.baseUrl}/servers/${id}/activate`);
    } catch (error: any) {
      throw new FhirClientError(`Failed to activate FHIR server ${id}`, error.status, error);
    }
  }

  // Utility methods
  formatOperationOutcome(outcome: FhirOperationOutcome): string {
    return outcome.issue
      .map(issue => `${issue.severity}: ${issue.details?.text || issue.diagnostics || 'Unknown error'}`)
      .join('; ');
  }

  isValidFhirResource(resource: any): boolean {
    return resource && 
           typeof resource === 'object' && 
           typeof resource.resourceType === 'string' &&
           resource.resourceType.length > 0;
  }

  getResourceDisplayName(resource: any): string {
    if (!resource) return 'Unknown Resource';

    switch (resource.resourceType) {
      case 'Patient':
        if (resource.name && resource.name[0]) {
          const name = resource.name[0];
          const fullName = `${name.given?.[0] || ''} ${name.family || ''}`.trim();
          return fullName || 'Unnamed Patient';
        }
        return 'Unnamed Patient';
        
      case 'Observation':
        return resource.code?.text || 
               resource.code?.coding?.[0]?.display || 
               'Observation';
               
      case 'Encounter':
        return resource.type?.[0]?.text || 
               resource.type?.[0]?.coding?.[0]?.display || 
               'Encounter';
               
      case 'Condition':
        return resource.code?.text || 
               resource.code?.coding?.[0]?.display || 
               'Condition';
               
      case 'Procedure':
        return resource.code?.text || 
               resource.code?.coding?.[0]?.display || 
               'Procedure';
               
      case 'DiagnosticReport':
        return resource.code?.text || 
               resource.code?.coding?.[0]?.display || 
               'Diagnostic Report';
               
      default:
        return `${resource.resourceType} Resource`;
    }
  }

  getResourceSubtext(resource: any): string {
    if (!resource) return '';

    switch (resource.resourceType) {
      case 'Patient':
        const birthDate = resource.birthDate ? 
          new Date(resource.birthDate).toLocaleDateString() : null;
        const gender = resource.gender ? 
          resource.gender.charAt(0).toUpperCase() + resource.gender.slice(1) : null;
        return [birthDate && `DOB: ${birthDate}`, gender]
          .filter(Boolean)
          .join(' | ') || 'Patient';
          
      case 'Observation':
        const subject = resource.subject?.reference || '';
        const effectiveDate = resource.effectiveDateTime ? 
          new Date(resource.effectiveDateTime).toLocaleDateString() : 
          resource.effectivePeriod?.start ? 
            new Date(resource.effectivePeriod.start).toLocaleDateString() : '';
        return [subject, effectiveDate].filter(Boolean).join(' | ') || 'Observation';
        
      case 'Encounter':
        const encounterDate = resource.period?.start ? 
          new Date(resource.period.start).toLocaleDateString() : '';
        const status = resource.status ? 
          resource.status.charAt(0).toUpperCase() + resource.status.slice(1) : '';
        return [status, encounterDate].filter(Boolean).join(' | ') || 'Encounter';
        
      case 'Condition':
        const recordedDate = resource.recordedDate ? 
          new Date(resource.recordedDate).toLocaleDateString() : '';
        const conditionStatus = resource.clinicalStatus?.coding?.[0]?.code || '';
        return [conditionStatus, recordedDate].filter(Boolean).join(' | ') || 'Condition';
        
      default:
        return resource.id || 'Resource';
    }
  }
}

// Export singleton instance
export const fhirClient = new FhirClient();
