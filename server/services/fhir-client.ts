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
        { 
          headers: this.headers,
          timeout: 8000 // 8 second timeout for faster response
        }
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
      console.log(`[FhirClient] Getting count for ${resourceType}...`);
      
      // Try multiple approaches to get accurate counts
      
      // Approach 1: Use _summary=count with _total=accurate parameter  
      try {
        const countUrl = `${this.baseUrl}/${resourceType}?_summary=count&_total=accurate`;
        console.log(`[FhirClient] Trying count URL: ${countUrl}`);
        const countResponse = await axios.get(countUrl, { 
          headers: this.headers,
          timeout: 15000
        });
        
        console.log(`[FhirClient] Count response for ${resourceType}:`, JSON.stringify(countResponse.data, null, 2));
        
        if (countResponse.data?.total !== undefined) {
          console.log(`[FhirClient] Count for ${resourceType}: ${countResponse.data.total} (via _summary=count&_total=accurate)`);
          return countResponse.data.total;
        }
      } catch (summaryError) {
        console.log(`[FhirClient] _summary=count with _total=accurate failed for ${resourceType}:`, summaryError.message);
      }
      
      // Approach 1b: Try with _total=true instead
      try {
        const countUrl = `${this.baseUrl}/${resourceType}?_summary=count&_total=true`;
        console.log(`[FhirClient] Trying count URL with _total=true: ${countUrl}`);
        const countResponse = await axios.get(countUrl, { 
          headers: this.headers,
          timeout: 15000
        });
        
        console.log(`[FhirClient] Count response for ${resourceType} with _total=true:`, JSON.stringify(countResponse.data, null, 2));
        
        if (countResponse.data?.total !== undefined) {
          console.log(`[FhirClient] Count for ${resourceType}: ${countResponse.data.total} (via _summary=count&_total=true)`);
          return countResponse.data.total;
        }
      } catch (summaryError) {
        console.log(`[FhirClient] _summary=count with _total=true failed for ${resourceType}:`, summaryError.message);
      }
      
      // Approach 2: Use small _count with _total=accurate
      const response = await this.searchResources(resourceType, { _count: '1', _total: 'accurate' });
      
      // If the server provides a total, use it
      if (response.total !== undefined && response.total !== null) {
        console.log(`[FhirClient] Count for ${resourceType}: ${response.total} (via search total)`);
        return response.total;
      }

      // Approach 3: If no total available, try to estimate by fetching larger samples
      console.log(`[FhirClient] No total available for ${resourceType}, attempting sample-based estimation`);
      
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
            
            console.log(`[FhirClient] Estimated count for ${resourceType}: ${totalEstimate} (multi-page sampling)`);
            return totalEstimate;
          } else {
            console.log(`[FhirClient] Count for ${resourceType}: ${largerSample.entry.length} (complete sample)`);
            return largerSample.entry.length;
          }
        }
      } catch (sampleError) {
        console.log(`[FhirClient] Sample-based estimation failed for ${resourceType}`);
      }
      
      // If we have any entries from the original search, return at least 1
      if (response.entry && response.entry.length > 0) {
        console.log(`[FhirClient] Minimum count for ${resourceType}: 1 (has entries)`);
        return 1;
      }
      
      console.log(`[FhirClient] Count for ${resourceType}: 0 (no entries found)`);
      return 0;
      
    } catch (error) {
      console.warn(`[FhirClient] Failed to get count for ${resourceType}:`, error.message);
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

  private formatOperationOutcome(outcome: FhirOperationOutcome): string {
    return outcome.issue
      .map(issue => `${issue.severity}: ${issue.details?.text || issue.diagnostics || 'Unknown error'}`)
      .join('; ');
  }
}
