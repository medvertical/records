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
   * 
   * We test by comparing results with :missing=true vs :missing=false
   */
  private async testMissingModifier(): Promise<boolean> {
    try {
      logger.debug('[CapabilityDetector] Testing :missing modifier');
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Test with :missing=true (should return resources without gender)
      const resultTrue = await this.fhirClient.searchResources('Patient', {
        'gender:missing': 'true',
        _count: 5,
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Test with :missing=false (should return resources with gender)
      const resultFalse = await this.fhirClient.searchResources('Patient', {
        'gender:missing': 'false',
        _count: 5,
      });
      
      const hasResultsTrue = resultTrue?.entry && resultTrue.entry.length > 0;
      const hasResultsFalse = resultFalse?.entry && resultFalse.entry.length > 0;
      
      // A working :missing modifier should return results for at least one query
      // If both return no results, the modifier isn't working
      if (!hasResultsTrue && !hasResultsFalse) {
        logger.info('[CapabilityDetector] :missing modifier not working correctly (no results for either query) ✗');
        return false;
      }
      
      // Verify that the results are actually filtered
      // missing=true should return resources WITHOUT the field
      // missing=false should return resources WITH the field
      if (hasResultsTrue && hasResultsFalse) {
        // Check if results are actually different
        const resourcesWithFieldTrue = resultTrue.entry.filter((e: any) => e.resource?.gender != null).length;
        const resourcesWithFieldFalse = resultFalse.entry.filter((e: any) => e.resource?.gender != null).length;
        
        // For missing=true, most resources should NOT have the field
        // For missing=false, most resources SHOULD have the field
        const trueRatioWithField = hasResultsTrue ? resourcesWithFieldTrue / resultTrue.entry.length : 0;
        const falseRatioWithField = hasResultsFalse ? resourcesWithFieldFalse / resultFalse.entry.length : 0;
        
        // If both queries return similar ratios, the filtering isn't working
        if (Math.abs(trueRatioWithField - falseRatioWithField) < 0.3) {
          logger.info('[CapabilityDetector] :missing modifier not filtering correctly (same field presence in both queries) ✗');
          return false;
        }
      }
      
      logger.info('[CapabilityDetector] :missing modifier supported ✓');
      return true;
    } catch (error: any) {
      // Check if error is due to unsupported modifier (400, 422)
      if (error.response?.status === 400 || error.response?.status === 422) {
        logger.info('[CapabilityDetector] :missing modifier not supported ✗');
        return false;
      }
      
      // Rate limiting - try to assume HAPI standards (most R4 servers support :missing)
      if (error.response?.status === 429) {
        logger.warn('[CapabilityDetector] :missing modifier test hit rate limit, assuming supported (FHIR R4 standard)');
        return true; // Default to true for standard FHIR R4 modifier
      }
      
      // Other errors (500, network) - assume supported for standard modifier
      logger.warn('[CapabilityDetector] :missing modifier test inconclusive, assuming supported (FHIR R4 standard)');
      return true; // Default to true for standard FHIR R4 modifier
    }
  }

  /**
   * Test if server supports :exists modifier (Fire.ly extension)
   * Example: Patient?gender:exists=true
   * 
   * Note: HAPI FHIR accepts :exists without error but doesn't filter correctly.
   * We test by comparing results with :exists=true vs :exists=false
   */
  private async testExistsModifier(): Promise<boolean> {
    try {
      logger.debug('[CapabilityDetector] Testing :exists modifier');
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Test with :exists=true (should return resources with gender)
      const resultTrue = await this.fhirClient.searchResources('Patient', {
        'gender:exists': 'true',
        _count: 5,
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Test with :exists=false (should return resources without gender)
      const resultFalse = await this.fhirClient.searchResources('Patient', {
        'gender:exists': 'false',
        _count: 5,
      });
      
      const hasResultsTrue = resultTrue?.entry && resultTrue.entry.length > 0;
      const hasResultsFalse = resultFalse?.entry && resultFalse.entry.length > 0;
      
      // If both return no results, the modifier isn't working
      if (!hasResultsTrue && !hasResultsFalse) {
        logger.info('[CapabilityDetector] :exists modifier not working correctly (no results for either query) ✗');
        return false;
      }
      
      // Verify that the results are actually filtered
      // exists=true should return resources WITH the field
      // exists=false should return resources WITHOUT the field
      if (hasResultsTrue && hasResultsFalse) {
        // Check if results are actually different
        const resourcesWithFieldTrue = resultTrue.entry.filter((e: any) => e.resource?.gender != null).length;
        const resourcesWithFieldFalse = resultFalse.entry.filter((e: any) => e.resource?.gender != null).length;
        
        // For exists=true, most resources SHOULD have the field
        // For exists=false, most resources should NOT have the field
        const trueRatioWithField = hasResultsTrue ? resourcesWithFieldTrue / resultTrue.entry.length : 0;
        const falseRatioWithField = hasResultsFalse ? resourcesWithFieldFalse / resultFalse.entry.length : 0;
        
        // If both queries return similar ratios, the filtering isn't working
        if (Math.abs(trueRatioWithField - falseRatioWithField) < 0.3) {
          logger.info('[CapabilityDetector] :exists modifier not filtering correctly (same field presence in both queries) ✗');
          return false;
        }
      }
      
      logger.info('[CapabilityDetector] :exists modifier supported ✓');
      return true;
    } catch (error: any) {
      if (error.response?.status === 400 || error.response?.status === 422) {
        logger.info('[CapabilityDetector] :exists modifier not supported ✗');
        return false;
      }
      
      // :exists is NOT a standard FHIR modifier, so default to false on errors
      logger.warn('[CapabilityDetector] :exists modifier test inconclusive, assuming not supported (non-standard)');
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

