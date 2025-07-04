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
      // First try to get total count with a summary request
      const response = await this.searchResources(resourceType, { _count: '0', _summary: 'count' });
      
      if (response.total !== undefined && response.total !== null) {
        return response.total;
      }
      
      // If summary count doesn't work, try with small count and _total parameter
      const responseWithTotal = await this.searchResources(resourceType, { _count: '1', _total: 'accurate' });
      
      if (responseWithTotal.total !== undefined && responseWithTotal.total !== null) {
        return responseWithTotal.total;
      }
      
      // If no total is provided by server, fetch a larger sample to get better estimate
      const sampleResponse = await this.searchResources(resourceType, {}, 50);
      
      if (sampleResponse.entry && sampleResponse.entry.length > 0) {
        // If we got fewer results than requested and no next link, this is the total
        if (sampleResponse.entry.length < 50 && !sampleResponse.link?.some(link => link.relation === 'next')) {
          return sampleResponse.entry.length;
        }
        
        // If there are entries and a next link, make a more conservative estimate
        if (sampleResponse.link?.some(link => link.relation === 'next')) {
          // For better estimates, try to extrapolate from the actual data
          return Math.floor(sampleResponse.entry.length * 2.5); // More conservative estimate
        }
        
        // If entries but no next link, return the actual count
        return sampleResponse.entry.length;
      }
      
      return 0;
    } catch (error) {
      console.warn(`Failed to get count for ${resourceType}:`, error);
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

  private formatOperationOutcome(outcome: FhirOperationOutcome): string {
    return outcome.issue
      .map(issue => `${issue.severity}: ${issue.details?.text || issue.diagnostics || 'Unknown error'}`)
      .join('; ');
  }
}
