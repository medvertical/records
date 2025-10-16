/**
 * Cache Management API Integration Tests
 * Task 7.11: Test cache management API endpoints
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import cacheManagementRoutes from '../../server/routes/api/validation/cache-management';

// Mock the validation cache manager
vi.mock('../../server/services/validation/cache/validation-cache-manager', () => ({
  getValidationCacheManager: vi.fn(() => ({
    getStats: vi.fn(async () => ({
      layers: {
        L1: {
          enabled: true,
          entries: 10,
          sizeMB: 1.5,
          hits: 100,
          misses: 50,
          evictions: 5,
          hitRate: 0.67,
        },
        L2: {
          enabled: true,
          entries: 50,
          sizeMB: 10.2,
          hits: 200,
          misses: 100,
          evictions: 10,
          hitRate: 0.67,
        },
        L3: {
          enabled: true,
          entries: 20,
          sizeMB: 5.0,
          hits: 50,
          misses: 25,
          evictions: 2,
          hitRate: 0.67,
        },
      },
      overall: {
        totalHits: 350,
        totalMisses: 175,
        hitRate: 0.67,
        totalSizeMB: 16.7,
        totalEntries: 80,
      },
    })),
    clear: vi.fn(async () => {}),
    invalidateCategory: vi.fn(async () => {}),
    invalidateAll: vi.fn(async () => {}),
    warmCache: vi.fn(async (options) => ({
      profilesWarmed: options?.categories?.includes('profile') ? 11 : 0,
      terminologyWarmed: options?.categories?.includes('terminology') ? 7 : 0,
      totalWarmed: 18,
      errors: [],
    })),
    getConfig: vi.fn(() => ({
      layers: { L1: 'enabled', L2: 'enabled', L3: 'enabled' },
      l1MaxSizeMb: 100,
      l2MaxSizeGb: 1,
      l3MaxSizeGb: 5,
      ttl: {
        validation: 300000,
        profile: 1800000,
        terminology: 3600000,
        igPackage: 86400000,
        default: 900000,
      },
    })),
    updateConfig: vi.fn(async () => {}),
  })),
}));

// Mock logger
vi.mock('../../server/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Cache Management API', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/validation/cache', cacheManagementRoutes);
    vi.clearAllMocks();
  });

  // ========================================================================
  // GET /api/validation/cache/stats
  // ========================================================================

  describe('GET /api/validation/cache/stats', () => {
    it('should return cache statistics', async () => {
      const response = await request(app)
        .get('/api/validation/cache/stats')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('stats');
      expect(response.body.stats).toHaveProperty('layers');
      expect(response.body.stats).toHaveProperty('overall');
      expect(response.body.stats.layers).toHaveProperty('L1');
      expect(response.body.stats.layers).toHaveProperty('L2');
      expect(response.body.stats.layers).toHaveProperty('L3');
      expect(response.body.stats.overall).toHaveProperty('totalHits', 350);
      expect(response.body.stats.overall).toHaveProperty('totalMisses', 175);
      expect(response.body.stats.overall).toHaveProperty('hitRate', 0.67);
    });
  });

  // ========================================================================
  // DELETE /api/validation/cache/clear
  // ========================================================================

  describe('DELETE /api/validation/cache/clear', () => {
    it('should clear all caches', async () => {
      const response = await request(app)
        .delete('/api/validation/cache/clear')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'All caches cleared successfully');
      expect(response.body).toHaveProperty('stats');
    });
  });

  // ========================================================================
  // DELETE /api/validation/cache/clear/:category
  // ========================================================================

  describe('DELETE /api/validation/cache/clear/:category', () => {
    it('should clear cache for specific category', async () => {
      const response = await request(app)
        .delete('/api/validation/cache/clear/validation')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', "Cache category 'validation' cleared successfully");
      expect(response.body).toHaveProperty('category', 'validation');
      expect(response.body).toHaveProperty('stats');
    });

    it('should reject invalid category', async () => {
      const response = await request(app)
        .delete('/api/validation/cache/clear/invalid')
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'Invalid category');
      expect(response.body).toHaveProperty('validCategories');
    });

    it('should accept all valid categories', async () => {
      const categories = ['validation', 'profile', 'terminology', 'igPackage'];

      for (const category of categories) {
        const response = await request(app)
          .delete(`/api/validation/cache/clear/${category}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('category', category);
      }
    });
  });

  // ========================================================================
  // POST /api/validation/cache/warm
  // ========================================================================

  describe('POST /api/validation/cache/warm', () => {
    it('should warm cache with default options', async () => {
      const response = await request(app)
        .post('/api/validation/cache/warm')
        .send({})
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Cache warming completed');
      expect(response.body).toHaveProperty('result');
      expect(response.body.result).toHaveProperty('profilesWarmed');
      expect(response.body.result).toHaveProperty('terminologyWarmed');
      expect(response.body.result).toHaveProperty('totalWarmed');
      expect(response.body.result).toHaveProperty('errors');
    });

    it('should warm cache with custom profiles', async () => {
      const response = await request(app)
        .post('/api/validation/cache/warm')
        .send({
          profiles: ['http://example.com/StructureDefinition/Patient'],
          categories: ['profile'],
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.result.profilesWarmed).toBeGreaterThanOrEqual(0);
    });

    it('should warm cache with custom terminology systems', async () => {
      const response = await request(app)
        .post('/api/validation/cache/warm')
        .send({
          terminologySystems: ['http://loinc.org'],
          categories: ['terminology'],
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.result.terminologyWarmed).toBeGreaterThanOrEqual(0);
    });
  });

  // ========================================================================
  // POST /api/validation/cache/invalidate
  // ========================================================================

  describe('POST /api/validation/cache/invalidate', () => {
    it('should invalidate all caches', async () => {
      const response = await request(app)
        .post('/api/validation/cache/invalidate')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'All caches invalidated successfully');
      expect(response.body).toHaveProperty('stats');
    });
  });

  // ========================================================================
  // GET /api/validation/cache/config
  // ========================================================================

  describe('GET /api/validation/cache/config', () => {
    it('should return cache configuration', async () => {
      const response = await request(app)
        .get('/api/validation/cache/config')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('config');
      expect(response.body.config).toHaveProperty('layers');
      expect(response.body.config).toHaveProperty('l1MaxSizeMb');
      expect(response.body.config).toHaveProperty('l2MaxSizeGb');
      expect(response.body.config).toHaveProperty('l3MaxSizeGb');
      expect(response.body.config).toHaveProperty('ttl');
    });
  });

  // ========================================================================
  // PUT /api/validation/cache/config
  // ========================================================================

  describe('PUT /api/validation/cache/config', () => {
    it('should update cache configuration', async () => {
      const response = await request(app)
        .put('/api/validation/cache/config')
        .send({
          l1MaxSizeMb: 200,
          ttl: {
            validation: 600000,
          },
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Cache configuration updated successfully');
      expect(response.body).toHaveProperty('config');
    });

    it('should update cache layer settings', async () => {
      const response = await request(app)
        .put('/api/validation/cache/config')
        .send({
          layers: {
            L1: 'enabled',
            L2: 'disabled',
            L3: 'enabled',
          },
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });
  });
});


