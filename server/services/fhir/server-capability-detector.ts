/**
 * Server Capability Detector
 * 
 * Detects which FHIR search modifiers a server supports by making test requests.
 * Different servers support different modifiers:
 * - HAPI FHIR: :missing modifier (FHIR R4 standard)
 * - Fire.ly: :exists modifier (custom extension)
 */

import { FhirClient } from './fhir-client.js';
import { logger } from '../../utils/logger.js';

export interface SearchModifierCapabilities {
  missing: boolean;      // :missing=true/false (FHIR R4 standard)
  exists: boolean;       // :exists=true/false (Fire.ly extension)
  contains: boolean;     // :contains (string search)
  exact: boolean;        // :exact (exact match)
  not: boolean;          // :not (negation - rare)
}

export interface ServerCapabilities {
  serverId: number;
  serverUrl: string;
  searchModifiers: SearchModifierCapabilities;
  detectedAt: Date;
  fhirVersion?: string;
}

export class ServerCapabilityDetector {
  private fhirClient: FhirClient;

  constructor(fhirClient: FhirClient) {
    this.fhirClient = fhirClient;
  }

  /**
   * Detect all search modifier capabilities for a server
   */
  async detectCapabilities(serverId: number, serverUrl?: string): Promise<ServerCapabilities> {
    logger.info(`[CapabilityDetector] Detecting capabilities for server ${serverId}`);

    const fhirVersion = await this.detectFhirVersion();

    // Test each modifier in parallel for speed
    const [missing, exists, contains, exact, not] = await Promise.all([
      this.testMissingModifier(),
      this.testExistsModifier(),
      this.testContainsModifier(),
      this.testExactModifier(),
      this.testNotModifier(),
    ]);

    const capabilities: ServerCapabilities = {
      serverId,
      serverUrl: serverUrl || 'unknown',
      searchModifiers: {
        missing,
        exists,
        contains,
        exact,
        not,
      },
      detectedAt: new Date(),
      fhirVersion,
    };

    logger.info(`[CapabilityDetector] Detection complete for server ${serverId}:`, {
      missing,
      exists,
      contains,
      exact,
      not,
    });

    return capabilities;
  }

  /**
   * Detect FHIR version from server
   */
  private async detectFhirVersion(): Promise<string | undefined> {
    try {
      const version = await this.fhirClient.getFhirVersion();
      return version || undefined;
    } catch (error) {
      logger.warn('[CapabilityDetector] Could not detect FHIR version');
      return undefined;
    }
  }

  /**
   * Test if server supports :missing modifier (FHIR R4 standard)
   * Example: Patient?gender:missing=true
   */
  private async testMissingModifier(): Promise<boolean> {
    try {
      logger.debug('[CapabilityDetector] Testing :missing modifier');
      
      // Test with a simple parameter that most servers have
      await this.fhirClient.searchResources('Patient', {
        'gender:missing': 'true',
        _count: 1,
      });
      
      logger.info('[CapabilityDetector] :missing modifier supported ✓');
      return true;
    } catch (error: any) {
      // Check if error is due to unsupported modifier (400, 422)
      if (error.response?.status === 400 || error.response?.status === 422) {
        logger.info('[CapabilityDetector] :missing modifier not supported ✗');
        return false;
      }
      
      // Other errors (500, network) - assume supported but server issue
      logger.warn('[CapabilityDetector] :missing modifier test inconclusive (server error)');
      return false;
    }
  }

  /**
   * Test if server supports :exists modifier (Fire.ly extension)
   * Example: Patient?gender:exists=true
   */
  private async testExistsModifier(): Promise<boolean> {
    try {
      logger.debug('[CapabilityDetector] Testing :exists modifier');
      
      await this.fhirClient.searchResources('Patient', {
        'gender:exists': 'true',
        _count: 1,
      });
      
      logger.info('[CapabilityDetector] :exists modifier supported ✓');
      return true;
    } catch (error: any) {
      if (error.response?.status === 400 || error.response?.status === 422) {
        logger.info('[CapabilityDetector] :exists modifier not supported ✗');
        return false;
      }
      
      logger.warn('[CapabilityDetector] :exists modifier test inconclusive');
      return false;
    }
  }

  /**
   * Test if server supports :contains modifier (string search)
   * Example: Patient?name:contains=John
   */
  private async testContainsModifier(): Promise<boolean> {
    try {
      logger.debug('[CapabilityDetector] Testing :contains modifier');
      
      await this.fhirClient.searchResources('Patient', {
        'name:contains': 'test',
        _count: 1,
      });
      
      logger.info('[CapabilityDetector] :contains modifier supported ✓');
      return true;
    } catch (error: any) {
      if (error.response?.status === 400 || error.response?.status === 422) {
        logger.info('[CapabilityDetector] :contains modifier not supported ✗');
        return false;
      }
      
      logger.warn('[CapabilityDetector] :contains modifier test inconclusive');
      return false;
    }
  }

  /**
   * Test if server supports :exact modifier (exact match)
   * Example: Patient?name:exact=John
   */
  private async testExactModifier(): Promise<boolean> {
    try {
      logger.debug('[CapabilityDetector] Testing :exact modifier');
      
      await this.fhirClient.searchResources('Patient', {
        'name:exact': 'test',
        _count: 1,
      });
      
      logger.info('[CapabilityDetector] :exact modifier supported ✓');
      return true;
    } catch (error: any) {
      if (error.response?.status === 400 || error.response?.status === 422) {
        logger.info('[CapabilityDetector] :exact modifier not supported ✗');
        return false;
      }
      
      logger.warn('[CapabilityDetector] :exact modifier test inconclusive');
      return false;
    }
  }

  /**
   * Test if server supports :not modifier (negation - rare)
   * Example: Patient?gender:not=male
   */
  private async testNotModifier(): Promise<boolean> {
    try {
      logger.debug('[CapabilityDetector] Testing :not modifier');
      
      await this.fhirClient.searchResources('Patient', {
        'gender:not': 'male',
        _count: 1,
      });
      
      logger.info('[CapabilityDetector] :not modifier supported ✓');
      return true;
    } catch (error: any) {
      if (error.response?.status === 400 || error.response?.status === 422) {
        logger.info('[CapabilityDetector] :not modifier not supported ✗');
        return false;
      }
      
      logger.warn('[CapabilityDetector] :not modifier test inconclusive');
      return false;
    }
  }
}

