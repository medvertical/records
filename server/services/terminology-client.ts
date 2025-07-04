import axios, { AxiosResponse } from 'axios';

export interface TerminologyServerConfig {
  enabled: boolean;
  url: string;
  type: string;
  description: string;
}

export interface StructureDefinition {
  resourceType: 'StructureDefinition';
  id: string;
  url: string;
  name: string;
  title?: string;
  status: 'draft' | 'active' | 'retired';
  kind: 'primitive-type' | 'complex-type' | 'resource' | 'logical';
  abstract: boolean;
  type: string;
  baseDefinition?: string;
  derivation?: 'specialization' | 'constraint';
  differential?: any;
  snapshot?: any;
}

export class TerminologyClient {
  private config: TerminologyServerConfig;
  private cache: Map<string, StructureDefinition> = new Map();

  constructor(config: TerminologyServerConfig) {
    this.config = config;
  }

  async isServerAvailable(): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    try {
      const response = await axios.get(`${this.config.url}/metadata`, {
        timeout: 5000,
        headers: {
          'Accept': 'application/fhir+json'
        }
      });
      return response.status === 200;
    } catch (error) {
      console.warn('Terminology server not available:', error);
      return false;
    }
  }

  async resolveExtension(extensionUrl: string): Promise<StructureDefinition | null> {
    if (!this.config.enabled) {
      return null;
    }

    // Check cache first
    if (this.cache.has(extensionUrl)) {
      return this.cache.get(extensionUrl)!;
    }

    try {
      // Handle different URL patterns for HL7 FHIR extensions
      let searchUrl = extensionUrl;
      
      // Convert extension URL to canonical form if needed
      if (extensionUrl.startsWith('http://hl7.org/fhir/StructureDefinition/')) {
        const extensionName = extensionUrl.split('/').pop();
        // Try different URL patterns for common extensions
        if (extensionName === 'birthPlace') {
          searchUrl = 'http://hl7.org/fhir/StructureDefinition/patient-birthPlace';
        }
      }

      // Try to fetch the StructureDefinition by URL search
      const response: AxiosResponse = await axios.get(
        `${this.config.url}/StructureDefinition`,
        {
          params: {
            url: searchUrl,
            _format: 'json'
          },
          timeout: 10000,
          headers: {
            'Accept': 'application/fhir+json'
          }
        }
      );

      if (response.data?.entry && response.data.entry.length > 0) {
        const structureDefinition = response.data.entry[0].resource as StructureDefinition;
        this.cache.set(extensionUrl, structureDefinition);
        console.log(`Successfully resolved extension: ${extensionUrl}`);
        return structureDefinition;
      }

      // If direct search fails, try searching by name pattern
      if (extensionUrl.includes('hl7.org/fhir')) {
        const extensionName = extensionUrl.split('/').pop();
        const nameResponse: AxiosResponse = await axios.get(
          `${this.config.url}/StructureDefinition`,
          {
            params: {
              name: extensionName,
              _format: 'json'
            },
            timeout: 10000,
            headers: {
              'Accept': 'application/fhir+json'
            }
          }
        );

        if (nameResponse.data?.entry && nameResponse.data.entry.length > 0) {
          const structureDefinition = nameResponse.data.entry[0].resource as StructureDefinition;
          this.cache.set(extensionUrl, structureDefinition);
          console.log(`Successfully resolved extension by name: ${extensionUrl}`);
          return structureDefinition;
        }
      }

      console.log(`Extension not found in terminology server: ${extensionUrl}`);
      return null;
    } catch (error) {
      console.error(`Error resolving extension ${extensionUrl}:`, error);
      return null;
    }
  }

  async validateCoding(system: string, code: string, display?: string): Promise<{
    isValid: boolean;
    display?: string;
    issues?: string[];
  }> {
    if (!this.config.enabled) {
      return { isValid: true }; // Assume valid if terminology server is disabled
    }

    try {
      const response: AxiosResponse = await axios.get(
        `${this.config.url}/CodeSystem/$validate-code`,
        {
          params: {
            system,
            code,
            display,
            _format: 'json'
          },
          timeout: 5000,
          headers: {
            'Accept': 'application/fhir+json'
          }
        }
      );

      if (response.data?.parameter) {
        const resultParam = response.data.parameter.find((p: any) => p.name === 'result');
        const displayParam = response.data.parameter.find((p: any) => p.name === 'display');
        
        return {
          isValid: resultParam?.valueBoolean === true,
          display: displayParam?.valueString,
          issues: []
        };
      }

      return { isValid: true };
    } catch (error) {
      console.warn(`Error validating coding ${system}|${code}:`, error);
      return { isValid: true }; // Assume valid on error to avoid blocking validation
    }
  }

  async searchStructureDefinitions(query: string): Promise<StructureDefinition[]> {
    if (!this.config.enabled) {
      return [];
    }

    try {
      const response: AxiosResponse = await axios.get(
        `${this.config.url}/StructureDefinition`,
        {
          params: {
            '_text': query,
            '_count': 20,
            _format: 'json'
          },
          timeout: 10000,
          headers: {
            'Accept': 'application/fhir+json'
          }
        }
      );

      if (response.data?.entry) {
        return response.data.entry.map((entry: any) => entry.resource as StructureDefinition);
      }

      return [];
    } catch (error) {
      console.error(`Error searching StructureDefinitions: ${error}`);
      return [];
    }
  }

  getConfig(): TerminologyServerConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: TerminologyServerConfig): void {
    this.config = newConfig;
    // Clear cache when config changes
    this.cache.clear();
  }

  clearCache(): void {
    this.cache.clear();
  }
}

// Default configuration for HL7 FHIR terminology server (hosts US Core profiles)
export const defaultTerminologyConfig: TerminologyServerConfig = {
  enabled: true,
  url: 'https://tx.fhir.org/r4',
  type: 'hapi-fhir',
  description: 'HL7 FHIR Terminology Server - Hosts US Core and international profiles'
};

export const terminologyClient = new TerminologyClient(defaultTerminologyConfig);