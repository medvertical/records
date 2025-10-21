/**
 * Server Capabilities Cache
 * 
 * Caches detected server capabilities in memory and database for fast access.
 * Capabilities are refreshed every 24 hours or on server activation.
 */

import { db } from '../../db/index.js';
import { serverCapabilities } from '../../../shared/schema.js';
import { eq } from 'drizzle-orm';
import { ServerCapabilities, ServerCapabilityDetector } from './server-capability-detector.js';
import { FhirClient } from './fhir-client.js';
import { logger } from '../../utils/logger.js';

// In-memory cache
const capabilitiesCache = new Map<number, { capabilities: ServerCapabilities; expiresAt: number }>();

// Cache TTL: 24 hours
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export class ServerCapabilitiesCache {
  /**
   * Get capabilities for a server (checks cache first, then database, then detects)
   */
  static async getCapabilities(serverId: number, fhirClient: FhirClient, serverUrl?: string): Promise<ServerCapabilities> {
    logger.debug(`[CapabilitiesCache] Getting capabilities for server ${serverId}`);

    // Check in-memory cache first
    const cached = capabilitiesCache.get(serverId);
    if (cached && Date.now() < cached.expiresAt) {
      logger.debug(`[CapabilitiesCache] Found in memory cache for server ${serverId}`);
      return cached.capabilities;
    }

    // Check database
    const dbCapabilities = await this.getFromDatabase(serverId);
    if (dbCapabilities && this.isValid(dbCapabilities)) {
      logger.debug(`[CapabilitiesCache] Found in database for server ${serverId}`);
      
      // Update memory cache
      this.updateMemoryCache(serverId, dbCapabilities);
      
      return dbCapabilities;
    }

    // Not found or stale - detect and cache
    logger.info(`[CapabilitiesCache] Detecting capabilities for server ${serverId}`);
    return await this.detectAndCache(serverId, fhirClient, serverUrl);
  }

  /**
   * Detect capabilities and store in cache
   */
  static async detectAndCache(serverId: number, fhirClient: FhirClient, serverUrl?: string): Promise<ServerCapabilities> {
    const detector = new ServerCapabilityDetector(fhirClient);
    const capabilities = await detector.detectCapabilities(serverId, serverUrl);

    // Store in database
    await this.saveToDatabase(capabilities);

    // Store in memory cache
    this.updateMemoryCache(serverId, capabilities);

    logger.info(`[CapabilitiesCache] Cached capabilities for server ${serverId}`);
    return capabilities;
  }

  /**
   * Refresh capabilities for a server (force re-detection)
   */
  static async refreshCapabilities(serverId: number, fhirClient: FhirClient, serverUrl?: string): Promise<ServerCapabilities> {
    logger.info(`[CapabilitiesCache] Force refreshing capabilities for server ${serverId}`);
    
    // Clear from memory cache
    capabilitiesCache.delete(serverId);
    
    // Detect and cache
    return await this.detectAndCache(serverId, fhirClient, serverUrl);
  }

  /**
   * Get capabilities from database
   */
  private static async getFromDatabase(serverId: number): Promise<ServerCapabilities | null> {
    try {
      const results = await db
        .select()
        .from(serverCapabilities)
        .where(eq(serverCapabilities.serverId, serverId))
        .limit(1);

      if (results.length === 0) {
        return null;
      }

      const row = results[0];
      return {
        serverId: row.serverId,
        serverUrl: '', // Will be filled from fhirClient if needed
        searchModifiers: row.capabilities as any,
        detectedAt: row.detectedAt,
        fhirVersion: row.fhirVersion || undefined,
      };
    } catch (error) {
      logger.error(`[CapabilitiesCache] Error reading from database:`, error);
      return null;
    }
  }

  /**
   * Save capabilities to database
   */
  private static async saveToDatabase(capabilities: ServerCapabilities): Promise<void> {
    try {
      await db
        .insert(serverCapabilities)
        .values({
          serverId: capabilities.serverId,
          capabilities: capabilities.searchModifiers as any,
          detectedAt: capabilities.detectedAt,
          fhirVersion: capabilities.fhirVersion || null,
        })
        .onConflictDoUpdate({
          target: serverCapabilities.serverId,
          set: {
            capabilities: capabilities.searchModifiers as any,
            detectedAt: capabilities.detectedAt,
            fhirVersion: capabilities.fhirVersion || null,
          },
        });

      logger.debug(`[CapabilitiesCache] Saved to database for server ${capabilities.serverId}`);
    } catch (error) {
      logger.error(`[CapabilitiesCache] Error saving to database:`, error);
    }
  }

  /**
   * Update in-memory cache
   */
  private static updateMemoryCache(serverId: number, capabilities: ServerCapabilities): void {
    capabilitiesCache.set(serverId, {
      capabilities,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  }

  /**
   * Check if capabilities are still valid (not expired)
   */
  private static isValid(capabilities: ServerCapabilities): boolean {
    const age = Date.now() - capabilities.detectedAt.getTime();
    return age < CACHE_TTL_MS;
  }

  /**
   * Clear all cached capabilities (for testing)
   */
  static clearCache(): void {
    capabilitiesCache.clear();
    logger.info('[CapabilitiesCache] Cleared all cached capabilities');
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): { inMemoryCount: number } {
    return {
      inMemoryCount: capabilitiesCache.size,
    };
  }
}

