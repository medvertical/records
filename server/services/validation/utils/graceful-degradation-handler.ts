/**
 * Graceful Degradation Handler
 * 
 * Manages fallback strategies when external services are unavailable.
 * Coordinates use of cached data, local resources, and degraded mode operations.
 * 
 * Features:
 * - Automatic cache fallback when servers unavailable
 * - Degraded mode validation (reduced feature set)
 * - Cached terminology lookups
 * - Offline profile resolution
 * - Stale data warnings
 * - Cache freshness tracking
 * 
 * Responsibilities: Fallback coordination ONLY
 * - Does not perform validation (handled by validators)
 * - Does not manage cache (handled by cache services)
 * 
 * File size: ~300 lines (adhering to global.mdc standards)
 */

import { EventEmitter } from 'events';
import type { ConnectivityMode } from './connectivity-detector';

// ============================================================================
// Types
// ============================================================================

export interface DegradationStrategy {
  /** Strategy name */
  name: string;
  
  /** When to use this strategy */
  condition: ConnectivityMode[];
  
  /** Features available in this strategy */
  features: {
    structuralValidation: boolean;
    profileValidation: boolean;
    terminologyValidation: boolean;
    referenceValidation: boolean;
    businessRules: boolean;
    metadataValidation: boolean;
    profileDownloads: boolean;
    packageDownloads: boolean;
  };
  
  /** Cache requirements */
  cacheRequired: {
    profiles: boolean;
    terminology: boolean;
    validationResults: boolean;
  };
  
  /** User warnings */
  warnings: string[];
}

export interface FallbackResult<T> {
  /** Whether data was found */
  success: boolean;
  
  /** The data (if found) */
  data?: T;
  
  /** Where data came from */
  source: 'cache' | 'fallback' | 'none';
  
  /** Whether data is stale */
  stale: boolean;
  
  /** Cache age in ms */
  cacheAge?: number;
  
  /** Warning message */
  warning?: string;
}

export interface CacheFreshnessPolicy {
  /** Max age for profiles (ms) */
  profileMaxAge: number;
  
  /** Max age for terminology (ms) */
  terminologyMaxAge: number;
  
  /** Max age for validation results (ms) */
  validationResultsMaxAge: number;
  
  /** Whether to use stale data as fallback */
  allowStaleData: boolean;
}

// ============================================================================
// Degradation Strategies
// ============================================================================

export const DEGRADATION_STRATEGIES: Record<string, DegradationStrategy> = {
  full: {
    name: 'Full Features',
    condition: ['online'],
    features: {
      structuralValidation: true,
      profileValidation: true,
      terminologyValidation: true,
      referenceValidation: true,
      businessRules: true,
      metadataValidation: true,
      profileDownloads: true,
      packageDownloads: true,
    },
    cacheRequired: {
      profiles: false,
      terminology: false,
      validationResults: false,
    },
    warnings: [],
  },
  
  degraded: {
    name: 'Degraded Mode',
    condition: ['degraded'],
    features: {
      structuralValidation: true,
      profileValidation: true, // Use cached profiles
      terminologyValidation: true, // Use cached terminology
      referenceValidation: false, // Requires external calls
      businessRules: true,
      metadataValidation: true,
      profileDownloads: false, // Downloads disabled
      packageDownloads: false,
    },
    cacheRequired: {
      profiles: true,
      terminology: true,
      validationResults: false,
    },
    warnings: [
      'Network connectivity degraded - some features limited',
      'Using cached profile and terminology data',
      'Reference validation disabled',
      'Profile downloads disabled',
    ],
  },
  
  offline: {
    name: 'Offline Mode',
    condition: ['offline'],
    features: {
      structuralValidation: true, // HAPI can work offline
      profileValidation: true, // Cached profiles only
      terminologyValidation: true, // Cached terminology only
      referenceValidation: false, // Requires network
      businessRules: true, // Local execution
      metadataValidation: true, // Local checking
      profileDownloads: false,
      packageDownloads: false,
    },
    cacheRequired: {
      profiles: true,
      terminology: true,
      validationResults: false,
    },
    warnings: [
      'Operating in offline mode',
      'Using cached data only - no external requests',
      'Profile and package downloads disabled',
      'Reference validation disabled',
      'Terminology validation limited to cached codes',
    ],
  },
};

// ============================================================================
// Graceful Degradation Handler
// ============================================================================

export class GracefulDegradationHandler extends EventEmitter {
  private currentMode: ConnectivityMode = 'online';
  private currentStrategy: DegradationStrategy = DEGRADATION_STRATEGIES.full;
  private freshnessPolicy: CacheFreshnessPolicy;

  constructor(freshnessPolicy?: Partial<CacheFreshnessPolicy>) {
    super();
    
    this.freshnessPolicy = {
      profileMaxAge: freshnessPolicy?.profileMaxAge ?? 86400000, // 24 hours
      terminologyMaxAge: freshnessPolicy?.terminologyMaxAge ?? 3600000, // 1 hour
      validationResultsMaxAge: freshnessPolicy?.validationResultsMaxAge ?? 300000, // 5 minutes
      allowStaleData: freshnessPolicy?.allowStaleData ?? true,
    };

    console.log('[GracefulDegradationHandler] Initialized');
  }

  /**
   * Update connectivity mode and adjust strategy
   */
  setConnectivityMode(mode: ConnectivityMode): void {
    const oldMode = this.currentMode;
    const oldStrategy = this.currentStrategy;

    this.currentMode = mode;
    this.currentStrategy = this.selectStrategy(mode);

    if (oldMode !== mode) {
      console.log(
        `[GracefulDegradationHandler] Mode changed: ${oldMode} → ${mode}, ` +
        `strategy: ${oldStrategy.name} → ${this.currentStrategy.name}`
      );

      this.emit('strategy-changed', {
        oldMode,
        newMode: mode,
        oldStrategy,
        newStrategy: this.currentStrategy,
        warnings: this.currentStrategy.warnings,
      });

      // Log warnings
      if (this.currentStrategy.warnings.length > 0) {
        console.warn('[GracefulDegradationHandler] Warnings:');
        this.currentStrategy.warnings.forEach(w => console.warn(`  - ${w}`));
      }
    }
  }

  /**
   * Select degradation strategy for mode
   */
  private selectStrategy(mode: ConnectivityMode): DegradationStrategy {
    for (const strategy of Object.values(DEGRADATION_STRATEGIES)) {
      if (strategy.condition.includes(mode)) {
        return strategy;
      }
    }
    return DEGRADATION_STRATEGIES.offline; // Safest fallback
  }

  /**
   * Check if a feature is available in current mode
   */
  isFeatureAvailable(feature: keyof DegradationStrategy['features']): boolean {
    return this.currentStrategy.features[feature];
  }

  /**
   * Get current strategy
   */
  getCurrentStrategy(): DegradationStrategy {
    return this.currentStrategy;
  }

  /**
   * Get current warnings
   */
  getCurrentWarnings(): string[] {
    return this.currentStrategy.warnings;
  }

  /**
   * Attempt operation with fallback to cache
   */
  async withFallback<T>(
    primaryOperation: () => Promise<T>,
    cacheOperation: () => Promise<T | null>,
    cacheTimestamp?: Date
  ): Promise<FallbackResult<T>> {
    // Try primary operation if online
    if (this.currentMode === 'online') {
      try {
        const data = await primaryOperation();
        return {
          success: true,
          data,
          source: 'cache', // Using live source
          stale: false,
        };
      } catch (error) {
        console.warn('[GracefulDegradationHandler] Primary operation failed, trying cache');
      }
    }

    // Try cache operation
    try {
      const data = await cacheOperation();
      
      if (data === null) {
        return {
          success: false,
          source: 'none',
          stale: false,
          warning: 'No cached data available and servers unreachable',
        };
      }

      // Check cache freshness
      const cacheAge = cacheTimestamp ? Date.now() - cacheTimestamp.getTime() : undefined;
      const maxAge = this.freshnessPolicy.terminologyMaxAge; // Default to terminology max age
      const stale = cacheAge !== undefined && cacheAge > maxAge;

      return {
        success: true,
        data,
        source: 'cache',
        stale,
        cacheAge,
        warning: stale ? 'Using stale cached data - servers unavailable' : undefined,
      };

    } catch (error) {
      return {
        success: false,
        source: 'none',
        stale: false,
        warning: `Cache operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Check if cache data is fresh enough
   */
  isCacheFresh(cacheTimestamp: Date, dataType: 'profile' | 'terminology' | 'validation'): boolean {
    const age = Date.now() - cacheTimestamp.getTime();
    
    switch (dataType) {
      case 'profile':
        return age < this.freshnessPolicy.profileMaxAge;
      case 'terminology':
        return age < this.freshnessPolicy.terminologyMaxAge;
      case 'validation':
        return age < this.freshnessPolicy.validationResultsMaxAge;
      default:
        return false;
    }
  }

  /**
   * Get recommended action for current mode
   */
  getRecommendedAction(): string {
    switch (this.currentMode) {
      case 'online':
        return 'All systems operational - full validation available';
      case 'degraded':
        return 'Using cached data for degraded connectivity - some features limited';
      case 'offline':
        return 'Offline mode - validation limited to cached data';
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let handlerInstance: GracefulDegradationHandler | null = null;

/**
 * Get or create singleton GracefulDegradationHandler
 */
export function getGracefulDegradationHandler(
  policy?: Partial<CacheFreshnessPolicy>
): GracefulDegradationHandler {
  if (!handlerInstance) {
    handlerInstance = new GracefulDegradationHandler(policy);
  }
  return handlerInstance;
}

/**
 * Reset singleton (useful for testing)
 */
export function resetGracefulDegradationHandler(): void {
  handlerInstance = null;
}


