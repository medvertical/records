/**
 * Terminology Server Router
 * 
 * Handles version-specific routing to terminology servers based on FHIR version.
 * Maps R4, R5, R6 versions to appropriate terminology server endpoints with
 * priority-based fallback chains.
 * 
 * Responsibilities: URL routing and server selection ONLY
 * - Does not perform HTTP operations (handled by DirectTerminologyClient)
 * - Does not manage caching (handled by TerminologyCache)
 * - Does not track health (handled by ConnectivityDetector)
 * 
 * File size: ~150 lines (adhering to global.mdc standards)
 */

import type { ValidationSettings, TerminologyServer } from '@shared/validation-settings';

// ============================================================================
// Types
// ============================================================================

export interface ServerSelectionResult {
  /** Selected server URL */
  url: string;
  
  /** Server ID */
  serverId: string;
  
  /** Server name for logging */
  name: string;
  
  /** FHIR versions supported by this server */
  supportedVersions: ('R4' | 'R5' | 'R6')[];
  
  /** Whether this is the primary server or a fallback */
  isPrimary: boolean;
}

// ============================================================================
// Terminology Server Router
// ============================================================================

export class TerminologyServerRouter {
  /**
   * Get terminology server URL for a specific FHIR version
   * 
   * @param fhirVersion - FHIR version (R4, R5, R6)
   * @param settings - Validation settings containing server configuration
   * @returns Server selection result with URL and metadata
   */
  getServerForVersion(
    fhirVersion: 'R4' | 'R5' | 'R6',
    settings?: ValidationSettings
  ): ServerSelectionResult {
    // If settings provided with terminology servers, use priority-based selection
    if (settings?.terminologyServers && settings.terminologyServers.length > 0) {
      return this.selectFromConfiguredServers(fhirVersion, settings.terminologyServers);
    }
    
    // Fallback to default version-specific endpoints
    return this.getDefaultServerForVersion(fhirVersion);
  }

  /**
   * Get all available servers for a FHIR version (for fallback scenarios)
   * 
   * @param fhirVersion - FHIR version
   * @param settings - Validation settings
   * @returns Array of servers ordered by priority
   */
  getServersForVersion(
    fhirVersion: 'R4' | 'R5' | 'R6',
    settings?: ValidationSettings
  ): ServerSelectionResult[] {
    const servers: ServerSelectionResult[] = [];
    
    // Add configured servers that support this version
    if (settings?.terminologyServers) {
      const configuredServers = settings.terminologyServers
        .filter(server => 
          server.enabled && 
          server.fhirVersions.includes(fhirVersion) &&
          !server.circuitOpen
        )
        .map((server, index) => this.mapServerToResult(server, index === 0));
      
      servers.push(...configuredServers);
    }
    
    // Add default server as final fallback
    const defaultServer = this.getDefaultServerForVersion(fhirVersion);
    const hasDefault = servers.some(s => s.url === defaultServer.url);
    if (!hasDefault) {
      servers.push(defaultServer);
    }
    
    return servers;
  }

  /**
   * Build version-specific terminology server URL
   * 
   * @param baseUrl - Base server URL (e.g., 'https://tx.fhir.org')
   * @param fhirVersion - FHIR version
   * @returns Version-specific URL (e.g., 'https://tx.fhir.org/r4')
   */
  buildVersionSpecificUrl(baseUrl: string, fhirVersion: 'R4' | 'R5' | 'R6'): string {
    const versionPath = fhirVersion.toLowerCase();
    const cleanBase = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    
    // Check if URL already includes version path
    if (cleanBase.endsWith(`/${versionPath}`)) {
      return cleanBase;
    }
    
    return `${cleanBase}/${versionPath}`;
  }

  // --------------------------------------------------------------------------
  // Private Helper Methods
  // --------------------------------------------------------------------------

  /**
   * Select server from configured servers based on priority and version support
   */
  private selectFromConfiguredServers(
    fhirVersion: 'R4' | 'R5' | 'R6',
    servers: TerminologyServer[]
  ): ServerSelectionResult {
    // Filter to enabled servers supporting this version with open circuits
    const eligibleServers = servers.filter(server =>
      server.enabled &&
      server.fhirVersions.includes(fhirVersion) &&
      !server.circuitOpen
    );
    
    if (eligibleServers.length === 0) {
      console.warn(
        `[TerminologyServerRouter] No eligible servers for ${fhirVersion}, ` +
        `using default`
      );
      return this.getDefaultServerForVersion(fhirVersion);
    }
    
    // Return first eligible server (highest priority)
    const primaryServer = eligibleServers[0];
    return this.mapServerToResult(primaryServer, true);
  }

  /**
   * Map TerminologyServer config to ServerSelectionResult
   */
  private mapServerToResult(
    server: TerminologyServer,
    isPrimary: boolean
  ): ServerSelectionResult {
    return {
      url: server.url,
      serverId: server.id,
      name: server.name,
      supportedVersions: [...server.fhirVersions],
      isPrimary,
    };
  }

  /**
   * Get default terminology server for a FHIR version
   * Based on TERMINOLOGY_SERVER_TEST_RESULTS.md recommendations
   */
  private getDefaultServerForVersion(fhirVersion: 'R4' | 'R5' | 'R6'): ServerSelectionResult {
    const versionPath = fhirVersion.toLowerCase();
    
    switch (fhirVersion) {
      case 'R4':
        return {
          url: `https://tx.fhir.org/${versionPath}`,
          serverId: 'tx-fhir-org-r4',
          name: 'HL7 TX Server (R4)',
          supportedVersions: ['R4'],
          isPrimary: true,
        };
      
      case 'R5':
        return {
          url: `https://tx.fhir.org/${versionPath}`,
          serverId: 'tx-fhir-org-r5',
          name: 'HL7 TX Server (R5)',
          supportedVersions: ['R5', 'R6'], // R5 server can validate R6
          isPrimary: true,
        };
      
      case 'R6':
        return {
          url: `https://tx.fhir.org/${versionPath}`,
          serverId: 'tx-fhir-org-r6',
          name: 'HL7 TX Server (R6)',
          supportedVersions: ['R6'],
          isPrimary: true,
        };
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

let routerInstance: TerminologyServerRouter | null = null;

/**
 * Get or create singleton TerminologyServerRouter instance
 */
export function getTerminologyServerRouter(): TerminologyServerRouter {
  if (!routerInstance) {
    routerInstance = new TerminologyServerRouter();
  }
  return routerInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetTerminologyServerRouter(): void {
  routerInstance = null;
}

