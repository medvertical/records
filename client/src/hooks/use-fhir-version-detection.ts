/**
 * FHIR Version Detection Hook - MVP Version
 * 
 * Simplified hook for detecting and managing FHIR server versions:
 * - Automatic version detection from server metadata
 * - Version-aware resource type loading
 * - Version change notifications
 * - Resource type validation
 */

import { useState, useEffect, useCallback } from 'react';
import { useToast } from './use-toast';
import type { FHIRVersion } from '@shared/validation-settings';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface FHIRServerMetadata {
  version: FHIRVersion;
  serverName?: string;
  serverUrl: string;
  lastChecked: Date;
  resourceTypes: string[];
  capabilities?: {
    supportedVersions: FHIRVersion[];
    supportedResourceTypes: string[];
    supportedOperations: string[];
  };
}

export interface UseFHIRVersionDetectionOptions {
  /** Server ID for server-specific detection */
  serverId?: number;
  
  /** Whether to auto-detect version on mount */
  autoDetect?: boolean;
  
  /** Detection interval in milliseconds */
  detectionIntervalMs?: number;
  
  /** Whether to show toast notifications */
  showNotifications?: boolean;
  
  /** Whether to validate resource types after detection */
  validateResourceTypes?: boolean;
}

export interface UseFHIRVersionDetectionReturn {
  // Version state
  currentVersion: FHIRVersion | null;
  serverMetadata: FHIRServerMetadata | null;
  loading: boolean;
  error: string | null;
  
  // Actions
  detectVersion: () => Promise<FHIRVersion | null>;
  refreshMetadata: () => Promise<void>;
  validateResourceTypes: (resourceTypes: string[]) => Promise<string[]>;
  
  // Resource type management
  availableResourceTypes: string[];
  supportedResourceTypes: string[];
  unsupportedResourceTypes: string[];
  
  // Version utilities
  isVersionSupported: (version: FHIRVersion) => boolean;
  getVersionDisplayName: (version: FHIRVersion) => string;
  getVersionDescription: (version: FHIRVersion) => string;
  
  // Change detection
  hasVersionChanged: boolean;
  previousVersion: FHIRVersion | null;
  onVersionChange: (callback: (newVersion: FHIRVersion, oldVersion: FHIRVersion | null) => void) => void;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_R4_RESOURCE_TYPES = [
  'Patient', 'Observation', 'Encounter', 'Condition', 'Procedure', 'Medication',
  'DiagnosticReport', 'AllergyIntolerance', 'Device', 'Organization', 'Practitioner',
  'Location', 'Appointment', 'Bundle', 'Binary', 'OperationOutcome'
];

const DEFAULT_R5_RESOURCE_TYPES = [
  ...DEFAULT_R4_RESOURCE_TYPES,
  'Substance', 'TestScript', 'ClinicalImpression', 'DeviceMetric', 'SubstanceDefinition',
  'TestReport', 'TestPlan', 'TestScript', 'ValueSet', 'CodeSystem', 'ConceptMap'
];

const VERSION_DISPLAY_NAMES: Record<FHIRVersion, string> = {
  R4: 'FHIR R4',
  R5: 'FHIR R5'
};

const VERSION_DESCRIPTIONS: Record<FHIRVersion, string> = {
  R4: 'FHIR Release 4 (R4) - Stable release with comprehensive resource definitions',
  R5: 'FHIR Release 5 (R5) - Latest release with additional resources and improvements'
};

// ============================================================================
// Hook Implementation
// ============================================================================

export function useFHIRVersionDetection(options: UseFHIRVersionDetectionOptions = {}): UseFHIRVersionDetectionReturn {
  const { toast } = useToast();
  const {
    serverId,
    autoDetect = true,
    detectionIntervalMs = 30000, // 30 seconds
    showNotifications = true,
    validateResourceTypes = true
  } = options;

  // State
  const [currentVersion, setCurrentVersion] = useState<FHIRVersion | null>(null);
  const [serverMetadata, setServerMetadata] = useState<FHIRServerMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableResourceTypes, setAvailableResourceTypes] = useState<string[]>([]);
  const [supportedResourceTypes, setSupportedResourceTypes] = useState<string[]>([]);
  const [unsupportedResourceTypes, setUnsupportedResourceTypes] = useState<string[]>([]);
  const [hasVersionChanged, setHasVersionChanged] = useState(false);
  const [previousVersion, setPreviousVersion] = useState<FHIRVersion | null>(null);
  const [versionChangeCallbacks, setVersionChangeCallbacks] = useState<Array<(newVersion: FHIRVersion, oldVersion: FHIRVersion | null) => void>>([]);

  // Auto-detect version on mount
  useEffect(() => {
    if (autoDetect) {
      detectVersion();
    }
  }, [autoDetect, serverId]);

  // Periodic version checking
  useEffect(() => {
    if (!autoDetect || detectionIntervalMs <= 0) return;

    const interval = setInterval(() => {
      detectVersion();
    }, detectionIntervalMs);

    return () => clearInterval(interval);
  }, [autoDetect, detectionIntervalMs, serverId]);

  // Load resource types when version changes
  useEffect(() => {
    if (currentVersion && validateResourceTypes) {
      loadResourceTypesForVersion(currentVersion);
    }
  }, [currentVersion, validateResourceTypes]);

  const detectVersion = useCallback(async (): Promise<FHIRVersion | null> => {
    try {
      setLoading(true);
      setError(null);
      
      const url = `/api/fhir/metadata${serverId ? `?serverId=${serverId}` : ''}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch server metadata: ${response.statusText}`);
      }
      
      const metadata = await response.json();
      const version = metadata.version || 'R4';
      
      // Validate version
      if (!['R4', 'R5'].includes(version)) {
        throw new Error(`Unsupported FHIR version: ${version}`);
      }
      
      const fhirVersion = version as FHIRVersion;
      
      // Check if version has changed
      if (currentVersion && currentVersion !== fhirVersion) {
        setHasVersionChanged(true);
        setPreviousVersion(currentVersion);
        
        // Notify callbacks
        versionChangeCallbacks.forEach(callback => {
          callback(fhirVersion, currentVersion);
        });
        
        if (showNotifications) {
          toast({
            title: 'FHIR Version Changed',
            description: `Server version changed from ${getVersionDisplayName(currentVersion)} to ${getVersionDisplayName(fhirVersion)}`,
            variant: 'default'
          });
        }
      }
      
      setCurrentVersion(fhirVersion);
      
      // Update server metadata
      const serverMeta: FHIRServerMetadata = {
        version: fhirVersion,
        serverName: metadata.serverName,
        serverUrl: metadata.serverUrl || '',
        lastChecked: new Date(),
        resourceTypes: metadata.resourceTypes || [],
        capabilities: metadata.capabilities
      };
      
      setServerMetadata(serverMeta);
      
      return fhirVersion;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to detect FHIR version';
      setError(errorMessage);
      
      if (showNotifications) {
        toast({
          title: 'Version Detection Error',
          description: errorMessage,
          variant: 'destructive'
        });
      }
      
      return null;
    } finally {
      setLoading(false);
    }
  }, [currentVersion, serverId, showNotifications, toast, versionChangeCallbacks]);

  const refreshMetadata = useCallback(async (): Promise<void> => {
    await detectVersion();
  }, [detectVersion]);

  const loadResourceTypesForVersion = useCallback(async (version: FHIRVersion): Promise<void> => {
    try {
      const response = await fetch(`/api/validation/resource-types/${version}`);
      
      if (!response.ok) {
        throw new Error(`Failed to load resource types for ${version}`);
      }
      
      const data = await response.json();
      const resourceTypes = data.resourceTypes || [];
      
      setAvailableResourceTypes(resourceTypes);
      
      // Get default resource types for version
      const defaultResourceTypes = version === 'R4' ? DEFAULT_R4_RESOURCE_TYPES : DEFAULT_R5_RESOURCE_TYPES;
      
      // Find supported and unsupported resource types
      const supported = resourceTypes.filter(type => defaultResourceTypes.includes(type));
      const unsupported = defaultResourceTypes.filter(type => !resourceTypes.includes(type));
      
      setSupportedResourceTypes(supported);
      setUnsupportedResourceTypes(unsupported);
    } catch (err) {
      console.error('Error loading resource types:', err);
      setAvailableResourceTypes([]);
      setSupportedResourceTypes([]);
      setUnsupportedResourceTypes([]);
    }
  }, []);

  const validateResourceTypes = useCallback(async (resourceTypes: string[]): Promise<string[]> => {
    if (!currentVersion) return resourceTypes;
    
    try {
      const response = await fetch(`/api/validation/resource-types/${currentVersion}`);
      
      if (!response.ok) {
        throw new Error(`Failed to validate resource types for ${currentVersion}`);
      }
      
      const data = await response.json();
      const availableTypes = data.resourceTypes || [];
      
      // Return only resource types that are available in the current version
      return resourceTypes.filter(type => availableTypes.includes(type));
    } catch (err) {
      console.error('Error validating resource types:', err);
      return resourceTypes; // Return original list if validation fails
    }
  }, [currentVersion]);

  const isVersionSupported = useCallback((version: FHIRVersion): boolean => {
    return ['R4', 'R5'].includes(version);
  }, []);

  const getVersionDisplayName = useCallback((version: FHIRVersion): string => {
    return VERSION_DISPLAY_NAMES[version] || version;
  }, []);

  const getVersionDescription = useCallback((version: FHIRVersion): string => {
    return VERSION_DESCRIPTIONS[version] || `FHIR version ${version}`;
  }, []);

  const onVersionChange = useCallback((callback: (newVersion: FHIRVersion, oldVersion: FHIRVersion | null) => void) => {
    setVersionChangeCallbacks(prev => [...prev, callback]);
    
    // Return cleanup function
    return () => {
      setVersionChangeCallbacks(prev => prev.filter(cb => cb !== callback));
    };
  }, []);

  return {
    // Version state
    currentVersion,
    serverMetadata,
    loading,
    error,
    
    // Actions
    detectVersion,
    refreshMetadata,
    validateResourceTypes,
    
    // Resource type management
    availableResourceTypes,
    supportedResourceTypes,
    unsupportedResourceTypes,
    
    // Version utilities
    isVersionSupported,
    getVersionDisplayName,
    getVersionDescription,
    
    // Change detection
    hasVersionChanged,
    previousVersion,
    onVersionChange
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get default resource types for a FHIR version
 */
export function getDefaultResourceTypes(version: FHIRVersion): string[] {
  return version === 'R4' ? DEFAULT_R4_RESOURCE_TYPES : DEFAULT_R5_RESOURCE_TYPES;
}

/**
 * Check if a resource type is available in a specific FHIR version
 */
export function isResourceTypeAvailableInVersion(resourceType: string, version: FHIRVersion): boolean {
  const defaultTypes = getDefaultResourceTypes(version);
  return defaultTypes.includes(resourceType);
}

/**
 * Get version-specific resource type differences
 */
export function getVersionResourceTypeDifferences(r4Types: string[], r5Types: string[]): {
  r4Only: string[];
  r5Only: string[];
  common: string[];
} {
  const r4Only = r4Types.filter(type => !r5Types.includes(type));
  const r5Only = r5Types.filter(type => !r4Types.includes(type));
  const common = r4Types.filter(type => r5Types.includes(type));
  
  return { r4Only, r5Only, common };
}

/**
 * Format version display text
 */
export function formatVersionDisplay(version: FHIRVersion): string {
  return VERSION_DISPLAY_NAMES[version] || version;
}

/**
 * Get version color variant
 */
export function getVersionColorVariant(version: FHIRVersion): 'default' | 'secondary' | 'destructive' | 'outline' {
  const variants: Record<FHIRVersion, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    R4: 'default',
    R5: 'secondary'
  };
  
  return variants[version] || 'outline';
}

