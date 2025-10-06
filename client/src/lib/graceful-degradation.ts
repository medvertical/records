import { toast } from '@/hooks/use-toast';

/**
 * Graceful degradation system for handling service unavailability
 */

export interface ServiceStatus {
  name: string;
  available: boolean;
  lastChecked: Date;
  error?: string;
  fallbackMode: boolean;
}

export interface DegradationConfig {
  enableFallback: boolean;
  enableCaching: boolean;
  enableOfflineMode: boolean;
  cacheExpiry: number; // milliseconds
  maxRetries: number;
  retryInterval: number; // milliseconds
}

export interface FallbackData {
  data: any;
  timestamp: Date;
  source: 'cache' | 'fallback' | 'offline';
  expiresAt: Date;
}

export interface ServiceHealthCheck {
  name: string;
  url: string;
  timeout: number;
  interval: number; // milliseconds
  onStatusChange?: (status: ServiceStatus) => void;
}

/**
 * Service Health Monitor
 */
export class ServiceHealthMonitor {
  private services = new Map<string, ServiceStatus>();
  private healthChecks = new Map<string, ServiceHealthCheck>();
  private intervals = new Map<string, NodeJS.Timeout>();
  private config: DegradationConfig;

  constructor(config: DegradationConfig) {
    this.config = config;
  }

  /**
   * Register a service for health monitoring
   */
  registerService(healthCheck: ServiceHealthCheck): void {
    this.healthChecks.set(healthCheck.name, healthCheck);
    
    // Initial status
    this.services.set(healthCheck.name, {
      name: healthCheck.name,
      available: true, // Assume available initially
      lastChecked: new Date(),
      fallbackMode: false,
    });

    // Start health check interval
    this.startHealthCheck(healthCheck);
  }

  /**
   * Start health check for a service
   */
  private startHealthCheck(healthCheck: ServiceHealthCheck): void {
    const checkHealth = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), healthCheck.timeout);

        const response = await fetch(healthCheck.url, {
          method: 'HEAD',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const isAvailable = response.ok;
        const currentStatus = this.services.get(healthCheck.name);
        
        if (currentStatus && currentStatus.available !== isAvailable) {
          // Status changed
          const newStatus: ServiceStatus = {
            name: healthCheck.name,
            available: isAvailable,
            lastChecked: new Date(),
            fallbackMode: !isAvailable && this.config.enableFallback,
            error: isAvailable ? undefined : `Service unavailable (${response.status})`,
          };

          this.services.set(healthCheck.name, newStatus);
          healthCheck.onStatusChange?.(newStatus);
        } else if (currentStatus) {
          // Update last checked time
          currentStatus.lastChecked = new Date();
          this.services.set(healthCheck.name, currentStatus);
        }
      } catch (error) {
        const currentStatus = this.services.get(healthCheck.name);
        
        if (currentStatus && currentStatus.available) {
          // Service became unavailable
          const newStatus: ServiceStatus = {
            name: healthCheck.name,
            available: false,
            lastChecked: new Date(),
            fallbackMode: this.config.enableFallback,
            error: error instanceof Error ? error.message : 'Unknown error',
          };

          this.services.set(healthCheck.name, newStatus);
          healthCheck.onStatusChange?.(newStatus);
        } else if (currentStatus) {
          // Update last checked time
          currentStatus.lastChecked = new Date();
          this.services.set(healthCheck.name, currentStatus);
        }
      }
    };

    // Initial check
    checkHealth();

    // Set up interval
    const interval = setInterval(checkHealth, healthCheck.interval);
    this.intervals.set(healthCheck.name, interval);
  }

  /**
   * Get service status
   */
  getServiceStatus(serviceName: string): ServiceStatus | undefined {
    return this.services.get(serviceName);
  }

  /**
   * Get all service statuses
   */
  getAllServiceStatuses(): ServiceStatus[] {
    return Array.from(this.services.values());
  }

  /**
   * Check if any services are available
   */
  hasAvailableServices(): boolean {
    return Array.from(this.services.values()).some(service => service.available);
  }

  /**
   * Check if all services are available
   */
  areAllServicesAvailable(): boolean {
    return Array.from(this.services.values()).every(service => service.available);
  }

  /**
   * Stop monitoring a service
   */
  stopMonitoring(serviceName: string): void {
    const interval = this.intervals.get(serviceName);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(serviceName);
    }
    this.healthChecks.delete(serviceName);
    this.services.delete(serviceName);
  }

  /**
   * Stop all monitoring
   */
  stopAllMonitoring(): void {
    for (const interval of this.intervals.values()) {
      clearInterval(interval);
    }
    this.intervals.clear();
    this.healthChecks.clear();
    this.services.clear();
  }
}

/**
 * Fallback Data Manager
 */
export class FallbackDataManager {
  private cache = new Map<string, FallbackData>();
  private config: DegradationConfig;

  constructor(config: DegradationConfig) {
    this.config = config;
  }

  /**
   * Store fallback data
   */
  store(key: string, data: any, source: 'cache' | 'fallback' | 'offline' = 'cache'): void {
    const fallbackData: FallbackData = {
      data,
      timestamp: new Date(),
      source,
      expiresAt: new Date(Date.now() + this.config.cacheExpiry),
    };

    this.cache.set(key, fallbackData);
  }

  /**
   * Retrieve fallback data
   */
  retrieve(key: string): any | null {
    const fallbackData = this.cache.get(key);
    
    if (!fallbackData) {
      return null;
    }

    // Check if expired
    if (new Date() > fallbackData.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return fallbackData.data;
  }

  /**
   * Check if fallback data exists and is valid
   */
  hasValidData(key: string): boolean {
    const fallbackData = this.cache.get(key);
    return fallbackData ? new Date() <= fallbackData.expiresAt : false;
  }

  /**
   * Get fallback data info
   */
  getDataInfo(key: string): FallbackData | null {
    const fallbackData = this.cache.get(key);
    return fallbackData && new Date() <= fallbackData.expiresAt ? fallbackData : null;
  }

  /**
   * Clear expired data
   */
  clearExpiredData(): void {
    const now = new Date();
    for (const [key, data] of this.cache.entries()) {
      if (now > data.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all data
   */
  clearAllData(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { total: number; expired: number; valid: number } {
    const now = new Date();
    let expired = 0;
    let valid = 0;

    for (const data of this.cache.values()) {
      if (now > data.expiresAt) {
        expired++;
      } else {
        valid++;
      }
    }

    return {
      total: this.cache.size,
      expired,
      valid,
    };
  }
}

/**
 * Graceful Degradation Manager
 */
export class GracefulDegradationManager {
  private healthMonitor: ServiceHealthMonitor;
  private fallbackManager: FallbackDataManager;
  private config: DegradationConfig;
  private isOfflineMode = false;

  constructor(config: DegradationConfig) {
    this.config = config;
    this.healthMonitor = new ServiceHealthMonitor(config);
    this.fallbackManager = new FallbackDataManager(config);

    // Set up offline detection
    this.setupOfflineDetection();

    // Set up cache cleanup
    this.setupCacheCleanup();
  }

  /**
   * Set up offline detection
   */
  private setupOfflineDetection(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOfflineMode = false;
        this.handleOnlineStatus();
      });

      window.addEventListener('offline', () => {
        this.isOfflineMode = true;
        this.handleOfflineStatus();
      });

      // Initial check
      this.isOfflineMode = !navigator.onLine;
    }
  }

  /**
   * Set up cache cleanup
   */
  private setupCacheCleanup(): void {
    // Clean up expired data every 5 minutes
    setInterval(() => {
      this.fallbackManager.clearExpiredData();
    }, 5 * 60 * 1000);
  }

  /**
   * Handle online status
   */
  private handleOnlineStatus(): void {
    console.log('[GracefulDegradation] Back online, attempting to reconnect services');
    toast({
      title: "Connection Restored",
      description: "Services are being reconnected. Some features may take a moment to restore.",
    });
  }

  /**
   * Handle offline status
   */
  private handleOfflineStatus(): void {
    console.log('[GracefulDegradation] Gone offline, switching to offline mode');
    toast({
      title: "Connection Lost",
      description: "You're now in offline mode. Some features may be limited.",
      variant: "destructive",
    });
  }

  /**
   * Register a service for monitoring
   */
  registerService(healthCheck: ServiceHealthCheck): void {
    this.healthMonitor.registerService(healthCheck);
  }

  /**
   * Execute operation with graceful degradation
   */
  async executeWithDegradation<T>(
    operation: () => Promise<T>,
    fallbackKey: string,
    fallbackData?: any,
    options: {
      useCache?: boolean;
      useFallback?: boolean;
      onFallback?: (data: any) => void;
    } = {}
  ): Promise<T> {
    const { useCache = true, useFallback = true, onFallback } = options;

    // Check if we're in offline mode
    if (this.isOfflineMode && this.config.enableOfflineMode) {
      const cachedData = this.fallbackManager.retrieve(fallbackKey);
      if (cachedData) {
        console.log('[GracefulDegradation] Using cached data in offline mode');
        return cachedData;
      }
    }

    // Try to execute the operation
    try {
      const result = await operation();
      
      // Store successful result in cache
      if (useCache) {
        this.fallbackManager.store(fallbackKey, result, 'cache');
      }
      
      return result;
    } catch (error) {
      console.log('[GracefulDegradation] Operation failed, attempting fallback');
      
      // Try to use cached data
      if (useCache) {
        const cachedData = this.fallbackManager.retrieve(fallbackKey);
        if (cachedData) {
          console.log('[GracefulDegradation] Using cached data as fallback');
          onFallback?.(cachedData);
          return cachedData;
        }
      }

      // Try to use provided fallback data
      if (useFallback && fallbackData) {
        console.log('[GracefulDegradation] Using provided fallback data');
        this.fallbackManager.store(fallbackKey, fallbackData, 'fallback');
        onFallback?.(fallbackData);
        return fallbackData;
      }

      // If all else fails, throw the original error
      throw error;
    }
  }

  /**
   * Get service status
   */
  getServiceStatus(serviceName: string): ServiceStatus | undefined {
    return this.healthMonitor.getServiceStatus(serviceName);
  }

  /**
   * Get all service statuses
   */
  getAllServiceStatuses(): ServiceStatus[] {
    return this.healthMonitor.getAllServiceStatuses();
  }

  /**
   * Check if services are available
   */
  areServicesAvailable(): boolean {
    return this.healthMonitor.hasAvailableServices();
  }

  /**
   * Check if we're in offline mode
   */
  isOffline(): boolean {
    return this.isOfflineMode;
  }

  /**
   * Get fallback data
   */
  getFallbackData(key: string): any | null {
    return this.fallbackManager.retrieve(key);
  }

  /**
   * Store fallback data
   */
  storeFallbackData(key: string, data: any): void {
    this.fallbackManager.store(key, data);
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.fallbackManager.getCacheStats();
  }

  /**
   * Clear all fallback data
   */
  clearFallbackData(): void {
    this.fallbackManager.clearAllData();
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.healthMonitor.stopAllMonitoring();
    this.fallbackManager.clearAllData();
  }
}

/**
 * Default degradation configuration
 */
export const DEFAULT_DEGRADATION_CONFIG: DegradationConfig = {
  enableFallback: true,
  enableCaching: true,
  enableOfflineMode: true,
  cacheExpiry: 30 * 60 * 1000, // 30 minutes
  maxRetries: 3,
  retryInterval: 5000, // 5 seconds
};

/**
 * Global graceful degradation manager
 */
export const gracefulDegradationManager = new GracefulDegradationManager(DEFAULT_DEGRADATION_CONFIG);

/**
 * Hook for using graceful degradation in React components
 */
export function useGracefulDegradation(config?: Partial<DegradationConfig>) {
  const manager = config ? new GracefulDegradationManager({ ...DEFAULT_DEGRADATION_CONFIG, ...config }) : gracefulDegradationManager;

  const executeWithDegradation = async <T>(
    operation: () => Promise<T>,
    fallbackKey: string,
    fallbackData?: any,
    options?: {
      useCache?: boolean;
      useFallback?: boolean;
      onFallback?: (data: any) => void;
    }
  ): Promise<T> => {
    return manager.executeWithDegradation(operation, fallbackKey, fallbackData, options);
  };

  const getServiceStatus = (serviceName: string) => {
    return manager.getServiceStatus(serviceName);
  };

  const getAllServiceStatuses = () => {
    return manager.getAllServiceStatuses();
  };

  const areServicesAvailable = () => {
    return manager.areServicesAvailable();
  };

  const isOffline = () => {
    return manager.isOffline();
  };

  const getFallbackData = (key: string) => {
    return manager.getFallbackData(key);
  };

  const storeFallbackData = (key: string, data: any) => {
    manager.storeFallbackData(key, data);
  };

  const getCacheStats = () => {
    return manager.getCacheStats();
  };

  return {
    executeWithDegradation,
    getServiceStatus,
    getAllServiceStatuses,
    areServicesAvailable,
    isOffline,
    getFallbackData,
    storeFallbackData,
    getCacheStats,
  };
}

/**
 * Utility functions for graceful degradation
 */
export const DegradationUtils = {
  /**
   * Create a fallback response for validation operations
   */
  createValidationFallback: (operation: string) => ({
    message: `Validation service is currently unavailable. ${operation} operation cannot be completed.`,
    status: 'service_unavailable',
    fallback: true,
    timestamp: new Date().toISOString(),
    operation,
  }),

  /**
   * Create a fallback response for progress data
   */
  createProgressFallback: () => ({
    isRunning: false,
    isPaused: false,
    processedResources: 0,
    totalResources: 0,
    validResources: 0,
    errorResources: 0,
    status: 'service_unavailable',
    message: 'Validation service is currently unavailable. Progress data cannot be retrieved.',
    fallback: true,
    timestamp: new Date().toISOString(),
  }),

  /**
   * Create a fallback response for settings data
   */
  createSettingsFallback: () => ({
    id: 'fallback-settings',
    name: 'Default Settings (Offline)',
    description: 'Using default validation settings while service is unavailable',
    aspects: {
      structural: true,
      profile: true,
      terminology: true,
      reference: true,
      businessRule: true,
      metadata: true,
    },
    fallback: true,
    timestamp: new Date().toISOString(),
  }),

  /**
   * Check if a response is a fallback response
   */
  isFallbackResponse: (response: any): boolean => {
    return response && response.fallback === true;
  },

  /**
   * Get user-friendly message for service unavailability
   */
  getServiceUnavailableMessage: (service: string): string => {
    return `The ${service} service is currently unavailable. Some features may be limited or unavailable.`;
  },
};

