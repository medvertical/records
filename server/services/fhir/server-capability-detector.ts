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
   * Example: Patient?_profile:missing=true
   * 
   * We test by comparing results with :missing=true vs :missing=false
   * IMPORTANT: Test with _profile specifically, as some servers (like HAPI) support
   * :missing for some fields (gender) but not others (_profile)
   */
  private async testMissingModifier(): Promise<boolean> {
    try {
      logger.debug('[CapabilityDetector] Testing :missing modifier on _profile parameter');
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Test with _profile:missing=true (should return resources without profile)
      const resultTrue = await this.fhirClient.searchResources('Patient', {
        '_profile:missing': 'true',
        _count: 10,
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Test with _profile:missing=false (should return resources with profile)
      const resultFalse = await this.fhirClient.searchResources('Patient', {
        '_profile:missing': 'false',
        _count: 10,
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
      // missing=true should return resources WITHOUT _profile
      // missing=false should return resources WITH _profile
      if (hasResultsTrue && hasResultsFalse) {
        // Check if results are actually different
        const resourcesWithProfileTrue = resultTrue.entry.filter((e: any) => 
          e.resource?.meta?.profile && Array.isArray(e.resource.meta.profile) && e.resource.meta.profile.length > 0
        ).length;
        const resourcesWithProfileFalse = resultFalse.entry.filter((e: any) => 
          e.resource?.meta?.profile && Array.isArray(e.resource.meta.profile) && e.resource.meta.profile.length > 0
        ).length;
        
        // For missing=true, most resources should NOT have profiles
        // For missing=false, most resources SHOULD have profiles
        const trueRatioWithProfile = hasResultsTrue ? resourcesWithProfileTrue / resultTrue.entry.length : 0;
        const falseRatioWithProfile = hasResultsFalse ? resourcesWithProfileFalse / resultFalse.entry.length : 0;
        
        logger.debug(`[CapabilityDetector] :missing=true profile ratio: ${trueRatioWithProfile.toFixed(2)}, :missing=false profile ratio: ${falseRatioWithProfile.toFixed(2)}`);
        
        // If both queries return similar ratios, the filtering isn't working
        if (Math.abs(trueRatioWithProfile - falseRatioWithProfile) < 0.3) {
          logger.info(`[CapabilityDetector] :missing modifier not filtering correctly (profiles in both: true=${trueRatioWithProfile.toFixed(2)}, false=${falseRatioWithProfile.toFixed(2)}) ✗`);
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
      
      // Rate limiting or errors - be conservative and assume NOT supported for _profile
      // While :missing is a FHIR R4 standard, not all servers implement it correctly for all fields
      if (error.response?.status === 429) {
        logger.warn('[CapabilityDetector] :missing modifier test hit rate limit, assuming NOT supported to be safe');
        return false; // Conservative: don't assume it works if we can't test it
      }
      
      // Other errors (500, network) - be conservative
      logger.warn('[CapabilityDetector] :missing modifier test inconclusive, assuming NOT supported to be safe');
      return false; // Conservative: don't assume it works if we can't test it
    }
  }

  /**
   * Test if server supports :exists modifier (Fire.ly extension)
   * Example: Patient?_profile:exists=true
   * 
   * Note: HAPI FHIR accepts :exists without error but doesn't filter correctly.
   * We test by comparing results with :exists=true vs :exists=false
   * IMPORTANT: Test with _profile specifically, as some servers support
   * :exists for some fields but not others
   */
  private async testExistsModifier(): Promise<boolean> {
    try {
      logger.debug('[CapabilityDetector] Testing :exists modifier on _profile parameter');
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Test with _profile:exists=true (should return resources with profile)
      const resultTrue = await this.fhirClient.searchResources('Patient', {
        '_profile:exists': 'true',
        _count: 10,
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Test with _profile:exists=false (should return resources without profile)
      const resultFalse = await this.fhirClient.searchResources('Patient', {
        '_profile:exists': 'false',
        _count: 10,
      });
      
      const hasResultsTrue = resultTrue?.entry && resultTrue.entry.length > 0;
      const hasResultsFalse = resultFalse?.entry && resultFalse.entry.length > 0;
      
      // If both return no results, the modifier isn't working
      if (!hasResultsTrue && !hasResultsFalse) {
        logger.info('[CapabilityDetector] :exists modifier not working correctly (no results for either query) ✗');
        return false;
      }
      
      // Verify that the results are actually filtered
      // exists=true should return resources WITH _profile
      // exists=false should return resources WITHOUT _profile
      if (hasResultsTrue && hasResultsFalse) {
        // Check if results are actually different
        const resourcesWithProfileTrue = resultTrue.entry.filter((e: any) => 
          e.resource?.meta?.profile && Array.isArray(e.resource.meta.profile) && e.resource.meta.profile.length > 0
        ).length;
        const resourcesWithProfileFalse = resultFalse.entry.filter((e: any) => 
          e.resource?.meta?.profile && Array.isArray(e.resource.meta.profile) && e.resource.meta.profile.length > 0
        ).length;
        
        // For exists=true, most resources SHOULD have profiles
        // For exists=false, most resources should NOT have profiles
        const trueRatioWithProfile = hasResultsTrue ? resourcesWithProfileTrue / resultTrue.entry.length : 0;
        const falseRatioWithProfile = hasResultsFalse ? resourcesWithProfileFalse / resultFalse.entry.length : 0;
        
        logger.debug(`[CapabilityDetector] :exists=true profile ratio: ${trueRatioWithProfile.toFixed(2)}, :exists=false profile ratio: ${falseRatioWithProfile.toFixed(2)}`);
        
        // If both queries return similar ratios, the filtering isn't working
        if (Math.abs(trueRatioWithProfile - falseRatioWithProfile) < 0.3) {
          logger.info(`[CapabilityDetector] :exists modifier not filtering correctly (profiles in both: true=${trueRatioWithProfile.toFixed(2)}, false=${falseRatioWithProfile.toFixed(2)}) ✗`);
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

