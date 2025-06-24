import axios, { AxiosResponse } from 'axios';

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

export class FhirClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    this.headers = {
      'Accept': 'application/fhir+json',
      'Content-Type': 'application/fhir+json',
    };
  }

  async testConnection(): Promise<{ connected: boolean; version?: string; error?: string }> {
    try {
      const response = await axios.get(`${this.baseUrl}/metadata`, {
        headers: this.headers,
        timeout: 10000,
      });

      if (response.status === 200 && response.data.resourceType === 'CapabilityStatement') {
        return {
          connected: true,
          version: response.data.fhirVersion || 'Unknown',
        };
      }

      return {
        connected: false,
        error: 'Invalid FHIR server response',
      };
    } catch (error: any) {
      return {
        connected: false,
        error: error.message || 'Connection failed',
      };
    }
  }

  async searchResources(
    resourceType: string,
    params: Record<string, string> = {},
    count = 20
  ): Promise<FhirBundle> {
    try {
      const searchParams = new URLSearchParams({
        ...params,
        _count: count.toString(),
        _format: 'json',
      });

      const response: AxiosResponse<FhirBundle> = await axios.get(
        `${this.baseUrl}/${resourceType}?${searchParams.toString()}`,
        { headers: this.headers }
      );

      return response.data;
    } catch (error: any) {
      if (error.response?.data?.resourceType === 'OperationOutcome') {
        throw new Error(`FHIR Error: ${this.formatOperationOutcome(error.response.data)}`);
      }
      throw new Error(`Failed to search ${resourceType}: ${error.message}`);
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
      const response = await axios.get(`${this.baseUrl}/metadata`, {
        headers: this.headers,
      });

      const capabilityStatement = response.data;
      if (capabilityStatement.rest && capabilityStatement.rest[0]?.resource) {
        return capabilityStatement.rest[0].resource.map((r: any) => r.type);
      }

      // Fallback to common FHIR resource types
      return [
        'Patient', 'Observation', 'Encounter', 'Condition', 'Procedure',
        'DiagnosticReport', 'MedicationRequest', 'AllergyIntolerance',
        'Immunization', 'Organization', 'Practitioner', 'Location'
      ];
    } catch (error) {
      // Return default resource types if metadata fetch fails
      return [
        'Patient', 'Observation', 'Encounter', 'Condition', 'Procedure',
        'DiagnosticReport', 'MedicationRequest', 'AllergyIntolerance',
        'Immunization', 'Organization', 'Practitioner', 'Location'
      ];
    }
  }

  async getResourceCount(resourceType: string): Promise<number> {
    try {
      const response = await this.searchResources(resourceType, { _summary: 'count' }, 0);
      return response.total || 0;
    } catch {
      return 0;
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

  private formatOperationOutcome(outcome: FhirOperationOutcome): string {
    return outcome.issue
      .map(issue => `${issue.severity}: ${issue.details?.text || issue.diagnostics || 'Unknown error'}`)
      .join('; ');
  }
}
