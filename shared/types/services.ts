// ============================================================================
// Service Interface Types - Comprehensive Service Contracts
// ============================================================================

import { z } from 'zod';
import { 
  FhirServer, 
  FhirResource, 
  ValidationResult, 
  ValidationProfile, 
  ValidationSettings,
  DashboardCard,
  ResourceStats 
} from './schema.js';
import { 
  ValidationProgress, 
  ValidationControlsState, 
  ValidationConfiguration,
  ValidationRunHistory,
  ValidationMetrics 
} from './validation.js';
import { 
  FhirServerStats, 
  ValidationStats, 
  DashboardData 
} from './dashboard.js';
import { 
  ApiResponse, 
  PaginatedResponse, 
  PaginationParams 
} from './api.js';
import { BaseError } from './errors.js';

// ============================================================================
// Base Service Interface
// ============================================================================

/**
 * Base service interface
 */
export interface BaseService {
  readonly name: string;
  readonly version: string;
  readonly isHealthy: boolean;
  readonly lastHealthCheck: Date;
  
  /**
   * Initialize the service
   */
  initialize(): Promise<void>;
  
  /**
   * Health check
   */
  healthCheck(): Promise<boolean>;
  
  /**
   * Shutdown the service
   */
  shutdown(): Promise<void>;
  
  /**
   * Get service metrics
   */
  getMetrics(): Promise<ServiceMetrics>;
}

/**
 * Service metrics
 */
export interface ServiceMetrics {
  name: string;
  version: string;
  uptime: number;
  requestCount: number;
  errorCount: number;
  averageResponseTime: number;
  memoryUsage: number;
  cpuUsage?: number;
  lastRequestTime?: Date;
  lastErrorTime?: Date;
  isHealthy: boolean;
}

// ============================================================================
// FHIR Client Service Interface
// ============================================================================

/**
 * FHIR client service interface
 */
export interface FhirClientService extends BaseService {
  /**
   * Test connection to FHIR server
   */
  testConnection(url?: string, authConfig?: any): Promise<{
    connected: boolean;
    version?: string;
    serverName?: string;
    error?: string;
    responseTime: number;
  }>;
  
  /**
   * Get server metadata
   */
  getMetadata(): Promise<any>;
  
  /**
   * Get all resource types
   */
  getAllResourceTypes(): Promise<string[]>;
  
  /**
   * Get resource count for specific type
   */
  getResourceCount(resourceType: string): Promise<number>;
  
  /**
   * Search resources
   */
  searchResources(
    resourceType: string, 
    params?: Record<string, any>
  ): Promise<any>;
  
  /**
   * Get resource by ID
   */
  getResource(resourceType: string, id: string): Promise<any>;
  
  /**
   * Validate resource
   */
  validateResource(resource: any, profile?: string): Promise<any>;
  
  /**
   * Get server version info
   */
  getVersionInfo(): Promise<{
    version: string;
    isR5: boolean;
    totalResourceTypes: number;
    priorityResourceTypes: string[];
    allResourceTypes: string[];
  }>;
}

// ============================================================================
// Storage Service Interface
// ============================================================================

/**
 * Storage service interface
 */
export interface StorageService extends BaseService {
  // FHIR Servers
  getFhirServers(): Promise<FhirServer[]>;
  getActiveFhirServer(): Promise<FhirServer | undefined>;
  createFhirServer(server: Partial<FhirServer>): Promise<FhirServer>;
  updateFhirServer(id: number, updates: Partial<FhirServer>): Promise<FhirServer>;
  deleteFhirServer(id: number): Promise<void>;
  
  // FHIR Resources
  getFhirResources(
    serverId?: number, 
    resourceType?: string, 
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<FhirResource>>;
  getFhirResourceById(id: number): Promise<FhirResource | undefined>;
  createFhirResource(resource: Partial<FhirResource>): Promise<FhirResource>;
  updateFhirResource(id: number, data: any): Promise<void>;
  deleteFhirResource(id: number): Promise<void>;
  
  // Validation Results
  getValidationResults(
    resourceId?: number,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<ValidationResult>>;
  createValidationResult(result: Partial<ValidationResult>): Promise<ValidationResult>;
  getRecentValidationErrors(limit?: number, serverId?: number): Promise<ValidationResult[]>;
  
  // Validation Profiles
  getValidationProfiles(resourceType?: string): Promise<ValidationProfile[]>;
  createValidationProfile(profile: Partial<ValidationProfile>): Promise<ValidationProfile>;
  updateValidationProfile(id: number, updates: Partial<ValidationProfile>): Promise<void>;
  deleteValidationProfile(id: number): Promise<void>;
  
  // Dashboard
  getDashboardCards(): Promise<DashboardCard[]>;
  createDashboardCard(card: Partial<DashboardCard>): Promise<DashboardCard>;
  updateDashboardCard(id: number, config: any): Promise<void>;
  
  // Statistics
  getResourceStats(serverId?: number): Promise<ResourceStats>;
  
  // Validation Settings
  getValidationSettings(): Promise<ValidationSettings | undefined>;
  createOrUpdateValidationSettings(settings: Partial<ValidationSettings>): Promise<ValidationSettings>;
  
  // Batch operations
  batchInsertFhirResources(resources: Partial<FhirResource>[]): Promise<void>;
  batchInsertValidationResults(results: Partial<ValidationResult>[]): Promise<void>;
  
  // Cache management
  clearCache(): Promise<void>;
  clearCacheByTag(tag: string): Promise<void>;
}

// ============================================================================
// Validation Service Interface
// ============================================================================

/**
 * Validation service interface
 */
export interface ValidationService extends BaseService {
  /**
   * Start validation
   */
  startValidation(options?: {
    batchSize?: number;
    forceRevalidation?: boolean;
    skipUnchanged?: boolean;
    resourceTypes?: string[];
    customConfiguration?: Partial<ValidationConfiguration>;
  }): Promise<{
    success: boolean;
    validationId: string;
    estimatedDuration?: number;
    message: string;
  }>;
  
  /**
   * Pause validation
   */
  pauseValidation(): Promise<void>;
  
  /**
   * Resume validation
   */
  resumeValidation(): Promise<void>;
  
  /**
   * Stop validation
   */
  stopValidation(): Promise<void>;
  
  /**
   * Get validation status
   */
  getValidationStatus(): Promise<{
    status: 'idle' | 'running' | 'paused' | 'completed' | 'error' | 'stopping';
    isRunning: boolean;
    isPaused: boolean;
    progress: ValidationProgress | null;
  }>;
  
  /**
   * Get validation progress
   */
  getValidationProgress(): Promise<ValidationProgress | null>;
  
  /**
   * Get validation history
   */
  getValidationHistory(limit?: number): Promise<ValidationRunHistory[]>;
  
  /**
   * Get validation metrics
   */
  getValidationMetrics(): Promise<ValidationMetrics>;
  
  /**
   * Update validation configuration
   */
  updateValidationConfiguration(config: Partial<ValidationConfiguration>): Promise<void>;
  
  /**
   * Clear validation results
   */
  clearValidationResults(): Promise<void>;
  
  /**
   * Export validation results
   */
  exportValidationResults(format: 'json' | 'csv' | 'pdf'): Promise<Blob>;
}

// ============================================================================
// Dashboard Service Interface
// ============================================================================

/**
 * Dashboard service interface
 */
export interface DashboardService extends BaseService {
  /**
   * Get FHIR server statistics
   */
  getFhirServerStats(): Promise<FhirServerStats>;
  
  /**
   * Get validation statistics
   */
  getValidationStats(): Promise<ValidationStats>;
  
  /**
   * Get combined dashboard data
   */
  getCombinedDashboardData(): Promise<DashboardData>;
  
  /**
   * Get FHIR version information
   */
  getFhirVersionInfo(): Promise<{
    version: string | null;
    isR5: boolean;
    totalResourceTypes: number;
    priorityResourceTypes: string[];
    allResourceTypes: string[];
  }>;
  
  /**
   * Force refresh FHIR server data
   */
  forceRefreshFhirServerData(): Promise<FhirServerStats>;
  
  /**
   * Clear dashboard cache
   */
  clearCache(): Promise<void>;
  
  /**
   * Get cache status
   */
  getCacheStatus(): Promise<Record<string, any>>;
}

// ============================================================================
// Cache Service Interface
// ============================================================================

/**
 * Cache service interface
 */
export interface CacheService extends BaseService {
  /**
   * Get cached data
   */
  get<T>(key: string): Promise<T | null>;
  
  /**
   * Set cached data
   */
  set<T>(
    key: string, 
    data: T, 
    options?: {
      ttl?: number;
      tags?: string[];
      size?: number;
    }
  ): Promise<void>;
  
  /**
   * Delete cached data
   */
  delete(key: string): Promise<boolean>;
  
  /**
   * Clear all cache
   */
  clear(): Promise<void>;
  
  /**
   * Clear cache by tag
   */
  clearByTag(tag: string): Promise<number>;
  
  /**
   * Get cache statistics
   */
  getCacheStats(): Promise<{
    totalEntries: number;
    totalSize: number;
    totalHits: number;
    totalMisses: number;
    hitRate: number;
    oldestEntry: Date | null;
    newestEntry: Date | null;
    entriesByTag: Record<string, number>;
  }>;
  
  /**
   * Get cache information
   */
  getCacheInfo(): Promise<Record<string, any>>;
  
  /**
   * Cleanup expired entries
   */
  cleanup(): Promise<number>;
}

// ============================================================================
// SSE Service Interface
// ============================================================================

/**
 * SSE service interface
 */
export interface SSEService extends BaseService {
  /**
   * Create SSE connection
   */
  createConnection(res: any): Promise<void>;
  
  /**
   * Close SSE connection
   */
  closeConnection(res: any): Promise<void>;
  
  /**
   * Broadcast message to all clients
   */
  broadcast(message: {
    type: string;
    data: any;
    timestamp: Date;
  }): Promise<void>;
  
  /**
   * Get connected clients count
   */
  getConnectedClientsCount(): Promise<number>;
  
  /**
   * Get connection statistics
   */
  getConnectionStats(): Promise<{
    totalConnections: number;
    activeConnections: number;
    totalMessages: number;
    messagesPerMinute: number;
    averageConnectionDuration: number;
  }>;
}

// ============================================================================
// Service Registry Interface
// ============================================================================

/**
 * Service registry interface
 */
export interface ServiceRegistry {
  /**
   * Register a service
   */
  register<T extends BaseService>(name: string, service: T): void;
  
  /**
   * Get a service by name
   */
  get<T extends BaseService>(name: string): T | undefined;
  
  /**
   * Get all services
   */
  getAll(): Map<string, BaseService>;
  
  /**
   * Unregister a service
   */
  unregister(name: string): boolean;
  
  /**
   * Check if service is registered
   */
  has(name: string): boolean;
  
  /**
   * Get service health status
   */
  getServiceHealth(name: string): Promise<boolean>;
  
  /**
   * Get all services health status
   */
  getAllServicesHealth(): Promise<Record<string, boolean>>;
  
  /**
   * Initialize all services
   */
  initializeAll(): Promise<void>;
  
  /**
   * Shutdown all services
   */
  shutdownAll(): Promise<void>;
}

// ============================================================================
// Service Factory Interface
// ============================================================================

/**
 * Service factory interface
 */
export interface ServiceFactory<T extends BaseService> {
  /**
   * Create service instance
   */
  create(config?: any): Promise<T>;
  
  /**
   * Get service dependencies
   */
  getDependencies(): string[];
  
  /**
   * Validate service configuration
   */
  validateConfig(config: any): Promise<boolean>;
}

// ============================================================================
// Service Configuration Types
// ============================================================================

/**
 * Service configuration
 */
export interface ServiceConfig {
  name: string;
  enabled: boolean;
  config: Record<string, any>;
  dependencies: string[];
  healthCheckInterval: number;
  metricsInterval: number;
  retryAttempts: number;
  retryDelay: number;
}

/**
 * Service configuration schema
 */
export const serviceConfigSchema = z.object({
  name: z.string(),
  enabled: z.boolean(),
  config: z.record(z.any()),
  dependencies: z.array(z.string()),
  healthCheckInterval: z.number().min(1000),
  metricsInterval: z.number().min(1000),
  retryAttempts: z.number().min(0),
  retryDelay: z.number().min(100),
});

// ============================================================================
// Service Error Types
// ============================================================================

/**
 * Service error
 */
export interface ServiceError extends BaseError {
  serviceName: string;
  operation: string;
  retryable: boolean;
  retryCount?: number;
  maxRetries?: number;
}

/**
 * Service initialization error
 */
export interface ServiceInitializationError extends ServiceError {
  cause: string;
  dependencies?: string[];
  configuration?: Record<string, any>;
}

/**
 * Service health check error
 */
export interface ServiceHealthCheckError extends ServiceError {
  healthCheckDuration: number;
  lastHealthyTime?: Date;
  consecutiveFailures: number;
}

// ============================================================================
// Service Event Types
// ============================================================================

/**
 * Service event types
 */
export type ServiceEventType = 
  | 'service-started'
  | 'service-stopped'
  | 'service-error'
  | 'service-health-check'
  | 'service-metrics-updated';

/**
 * Service event
 */
export interface ServiceEvent {
  type: ServiceEventType;
  serviceName: string;
  timestamp: Date;
  data: any;
}

/**
 * Service event handler
 */
export type ServiceEventHandler = (event: ServiceEvent) => void | Promise<void>;

/**
 * Service event emitter interface
 */
export interface ServiceEventEmitter {
  on(event: ServiceEventType, handler: ServiceEventHandler): void;
  off(event: ServiceEventType, handler: ServiceEventHandler): void;
  emit(event: ServiceEvent): void;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for base service
 */
export function isBaseService(obj: any): obj is BaseService {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.name === 'string' &&
    typeof obj.version === 'string' &&
    typeof obj.isHealthy === 'boolean' &&
    obj.lastHealthCheck instanceof Date &&
    typeof obj.initialize === 'function' &&
    typeof obj.healthCheck === 'function' &&
    typeof obj.shutdown === 'function' &&
    typeof obj.getMetrics === 'function'
  );
}

/**
 * Type guard for FHIR client service
 */
export function isFhirClientService(obj: any): obj is FhirClientService {
  return (
    isBaseService(obj) &&
    typeof obj.testConnection === 'function' &&
    typeof obj.getMetadata === 'function' &&
    typeof obj.getAllResourceTypes === 'function' &&
    typeof obj.getResourceCount === 'function' &&
    typeof obj.searchResources === 'function' &&
    typeof obj.getResource === 'function' &&
    typeof obj.validateResource === 'function' &&
    typeof obj.getVersionInfo === 'function'
  );
}

/**
 * Type guard for storage service
 */
export function isStorageService(obj: any): obj is StorageService {
  return (
    isBaseService(obj) &&
    typeof obj.getFhirServers === 'function' &&
    typeof obj.getActiveFhirServer === 'function' &&
    typeof obj.createFhirServer === 'function' &&
    typeof obj.updateFhirServer === 'function' &&
    typeof obj.deleteFhirServer === 'function' &&
    typeof obj.getFhirResources === 'function' &&
    typeof obj.getFhirResourceById === 'function' &&
    typeof obj.createFhirResource === 'function' &&
    typeof obj.updateFhirResource === 'function' &&
    typeof obj.deleteFhirResource === 'function' &&
    typeof obj.getValidationResults === 'function' &&
    typeof obj.createValidationResult === 'function' &&
    typeof obj.getRecentValidationErrors === 'function' &&
    typeof obj.getValidationProfiles === 'function' &&
    typeof obj.createValidationProfile === 'function' &&
    typeof obj.updateValidationProfile === 'function' &&
    typeof obj.deleteValidationProfile === 'function' &&
    typeof obj.getDashboardCards === 'function' &&
    typeof obj.createDashboardCard === 'function' &&
    typeof obj.updateDashboardCard === 'function' &&
    typeof obj.getResourceStats === 'function' &&
    typeof obj.getValidationSettings === 'function' &&
    typeof obj.createOrUpdateValidationSettings === 'function' &&
    typeof obj.batchInsertFhirResources === 'function' &&
    typeof obj.batchInsertValidationResults === 'function' &&
    typeof obj.clearCache === 'function' &&
    typeof obj.clearCacheByTag === 'function'
  );
}

/**
 * Type guard for validation service
 */
export function isValidationService(obj: any): obj is ValidationService {
  return (
    isBaseService(obj) &&
    typeof obj.startValidation === 'function' &&
    typeof obj.pauseValidation === 'function' &&
    typeof obj.resumeValidation === 'function' &&
    typeof obj.stopValidation === 'function' &&
    typeof obj.getValidationStatus === 'function' &&
    typeof obj.getValidationProgress === 'function' &&
    typeof obj.getValidationHistory === 'function' &&
    typeof obj.getValidationMetrics === 'function' &&
    typeof obj.updateValidationConfiguration === 'function' &&
    typeof obj.clearValidationResults === 'function' &&
    typeof obj.exportValidationResults === 'function'
  );
}

/**
 * Type guard for dashboard service
 */
export function isDashboardService(obj: any): obj is DashboardService {
  return (
    isBaseService(obj) &&
    typeof obj.getFhirServerStats === 'function' &&
    typeof obj.getValidationStats === 'function' &&
    typeof obj.getCombinedDashboardData === 'function' &&
    typeof obj.getFhirVersionInfo === 'function' &&
    typeof obj.forceRefreshFhirServerData === 'function' &&
    typeof obj.clearCache === 'function' &&
    typeof obj.getCacheStatus === 'function'
  );
}

/**
 * Type guard for cache service
 */
export function isCacheService(obj: any): obj is CacheService {
  return (
    isBaseService(obj) &&
    typeof obj.get === 'function' &&
    typeof obj.set === 'function' &&
    typeof obj.delete === 'function' &&
    typeof obj.clear === 'function' &&
    typeof obj.clearByTag === 'function' &&
    typeof obj.getCacheStats === 'function' &&
    typeof obj.getCacheInfo === 'function' &&
    typeof obj.cleanup === 'function'
  );
}

/**
 * Type guard for SSE service
 */
export function isSSEService(obj: any): obj is SSEService {
  return (
    isBaseService(obj) &&
    typeof obj.createConnection === 'function' &&
    typeof obj.closeConnection === 'function' &&
    typeof obj.broadcast === 'function' &&
    typeof obj.getConnectedClientsCount === 'function' &&
    typeof obj.getConnectionStats === 'function'
  );
}

