import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cacheManager } from './cache-manager'

// Mock the logger
vi.mock('../../utils/logger.js', () => ({
  logger: {
    cache: vi.fn(),
    getLogLevel: vi.fn(() => 2)
  }
}))

// Mock the error handler
vi.mock('../../utils/error-handler.js', () => ({
  errorHandler: {
    handleError: vi.fn((error) => ({
      success: false,
      error: {
        code: 'CACHE_ERROR',
        message: error.message,
        category: 'cache',
        severity: 'high',
        recoverable: true,
        recoveryAction: 'retry'
      }
    }))
  }
}))

describe('cacheManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear the cache before each test
    cacheManager.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('get and set', () => {
    it('should store and retrieve data', async () => {
      const key = 'test-key'
      const value = { data: 'test-value' }

      await cacheManager.set(key, value)
      const result = await cacheManager.get(key)

      expect(result).toEqual(value)
    })

    it('should return null for non-existent key', async () => {
      const result = await cacheManager.get('non-existent-key')
      expect(result).toBeNull()
    })

    it('should overwrite existing data', async () => {
      const key = 'test-key'
      const value1 = { data: 'value1' }
      const value2 = { data: 'value2' }

      await cacheManager.set(key, value1)
      await cacheManager.set(key, value2)

      const result = await cacheManager.get(key)
      expect(result).toEqual(value2)
    })
  })

  describe('TTL (Time To Live)', () => {
    it('should expire data after TTL', async () => {
      const key = 'test-key'
      const value = { data: 'test-value' }

      await cacheManager.set(key, value, { ttl: 100 }) // 100ms TTL

      // Data should be available immediately
      let result = await cacheManager.get(key)
      expect(result).toEqual(value)

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150))

      // Data should be expired
      result = await cacheManager.get(key)
      expect(result).toBeNull()
    })

    it('should not expire data without TTL', async () => {
      const key = 'test-key'
      const value = { data: 'test-value' }

      await cacheManager.set(key, value) // No TTL

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100))

      // Data should still be available
      const result = await cacheManager.get(key)
      expect(result).toEqual(value)
    })

    it('should handle different TTL values', async () => {
      const key1 = 'test-key-1'
      const key2 = 'test-key-2'
      const value1 = { data: 'value1' }
      const value2 = { data: 'value2' }

      await cacheManager.set(key1, value1, { ttl: 50 })
      await cacheManager.set(key2, value2, { ttl: 200 })

      // Wait for first TTL to expire
      await new Promise(resolve => setTimeout(resolve, 100))

      let result1 = await cacheManager.get(key1)
      let result2 = await cacheManager.get(key2)

      expect(result1).toBeNull() // Expired
      expect(result2).toEqual(value2) // Still valid

      // Wait for second TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150))

      result2 = await cacheManager.get(key2)
      expect(result2).toBeNull() // Now expired
    })
  })

  describe('tags', () => {
    it('should store data with tags', async () => {
      const key = 'test-key'
      const value = { data: 'test-value' }
      const tags = ['tag1', 'tag2']

      await cacheManager.set(key, value, { tags })

      const result = await cacheManager.get(key)
      expect(result).toEqual(value)
    })

    it('should invalidate by tags', async () => {
      const key1 = 'test-key-1'
      const key2 = 'test-key-2'
      const key3 = 'test-key-3'
      const value1 = { data: 'value1' }
      const value2 = { data: 'value2' }
      const value3 = { data: 'value3' }

      await cacheManager.set(key1, value1, { tags: ['tag1', 'tag2'] })
      await cacheManager.set(key2, value2, { tags: ['tag2', 'tag3'] })
      await cacheManager.set(key3, value3, { tags: ['tag3'] })

      // Invalidate by tag2
      await cacheManager.invalidateByTag('tag2')

      // key1 and key2 should be invalidated, key3 should remain
      expect(await cacheManager.get(key1)).toBeNull()
      expect(await cacheManager.get(key2)).toBeNull()
      expect(await cacheManager.get(key3)).toEqual(value3)
    })

    it('should invalidate by multiple tags', async () => {
      const key1 = 'test-key-1'
      const key2 = 'test-key-2'
      const key3 = 'test-key-3'
      const value1 = { data: 'value1' }
      const value2 = { data: 'value2' }
      const value3 = { data: 'value3' }

      await cacheManager.set(key1, value1, { tags: ['tag1', 'tag2'] })
      await cacheManager.set(key2, value2, { tags: ['tag2', 'tag3'] })
      await cacheManager.set(key3, value3, { tags: ['tag3'] })

      // Invalidate by multiple tags
      await cacheManager.invalidateByTag(['tag1', 'tag3'])

      // All keys should be invalidated
      expect(await cacheManager.get(key1)).toBeNull()
      expect(await cacheManager.get(key2)).toBeNull()
      expect(await cacheManager.get(key3)).toBeNull()
    })
  })

  describe('invalidate', () => {
    it('should invalidate specific keys', async () => {
      const key1 = 'test-key-1'
      const key2 = 'test-key-2'
      const key3 = 'test-key-3'
      const value1 = { data: 'value1' }
      const value2 = { data: 'value2' }
      const value3 = { data: 'value3' }

      await cacheManager.set(key1, value1)
      await cacheManager.set(key2, value2)
      await cacheManager.set(key3, value3)

      // Invalidate specific keys
      await cacheManager.invalidate([key1, key3])

      expect(await cacheManager.get(key1)).toBeNull()
      expect(await cacheManager.get(key2)).toEqual(value2) // Should remain
      expect(await cacheManager.get(key3)).toBeNull()
    })

    it('should handle invalidating non-existent keys', async () => {
      // Should not throw error
      await expect(cacheManager.invalidate(['non-existent-key'])).resolves.toBeUndefined()
    })
  })

  describe('clear', () => {
    it('should clear all data', async () => {
      const key1 = 'test-key-1'
      const key2 = 'test-key-2'
      const value1 = { data: 'value1' }
      const value2 = { data: 'value2' }

      await cacheManager.set(key1, value1)
      await cacheManager.set(key2, value2)

      // Verify data exists
      expect(await cacheManager.get(key1)).toEqual(value1)
      expect(await cacheManager.get(key2)).toEqual(value2)

      // Clear all data
      await cacheManager.clear()

      // Verify data is cleared
      expect(await cacheManager.get(key1)).toBeNull()
      expect(await cacheManager.get(key2)).toBeNull()
    })
  })

  describe('size management', () => {
    it('should respect max size limit', async () => {
      // Set a small max size for testing
      const originalMaxSize = cacheManager['maxSize']
      cacheManager['maxSize'] = 3

      try {
        // Add more items than max size
        await cacheManager.set('key1', 'value1')
        await cacheManager.set('key2', 'value2')
        await cacheManager.set('key3', 'value3')
        await cacheManager.set('key4', 'value4') // This should evict key1

        // key1 should be evicted (LRU)
        expect(await cacheManager.get('key1')).toBeNull()
        expect(await cacheManager.get('key2')).toEqual('value2')
        expect(await cacheManager.get('key3')).toEqual('value3')
        expect(await cacheManager.get('key4')).toEqual('value4')
      } finally {
        // Restore original max size
        cacheManager['maxSize'] = originalMaxSize
      }
    })

    it('should update LRU order on access', async () => {
      // Set a small max size for testing
      const originalMaxSize = cacheManager['maxSize']
      cacheManager['maxSize'] = 3

      try {
        await cacheManager.set('key1', 'value1')
        await cacheManager.set('key2', 'value2')
        await cacheManager.set('key3', 'value3')

        // Access key1 to make it most recently used
        await cacheManager.get('key1')

        // Add key4, which should evict key2 (least recently used)
        await cacheManager.set('key4', 'value4')

        expect(await cacheManager.get('key1')).toEqual('value1') // Should remain
        expect(await cacheManager.get('key2')).toBeNull() // Should be evicted
        expect(await cacheManager.get('key3')).toEqual('value3') // Should remain
        expect(await cacheManager.get('key4')).toEqual('value4') // Should remain
      } finally {
        // Restore original max size
        cacheManager['maxSize'] = originalMaxSize
      }
    })
  })

  describe('error handling', () => {
    it('should handle serialization errors gracefully', async () => {
      const key = 'test-key'
      const circularValue = { data: 'test' }
      circularValue.self = circularValue // Create circular reference

      // Should not throw error
      await expect(cacheManager.set(key, circularValue)).resolves.toBeUndefined()
    })

    it('should handle deserialization errors gracefully', async () => {
      const key = 'test-key'
      
      // Manually set invalid JSON in cache
      cacheManager['cache'].set(key, 'invalid-json')

      // Should return null for invalid data
      const result = await cacheManager.get(key)
      expect(result).toBeNull()
    })
  })

  describe('performance', () => {
    it('should handle large amounts of data', async () => {
      const largeData = new Array(1000).fill(0).map((_, i) => ({
        id: i,
        data: `item-${i}`,
        timestamp: new Date()
      }))

      const key = 'large-data'
      
      await cacheManager.set(key, largeData)
      const result = await cacheManager.get(key)

      expect(result).toEqual(largeData)
    })

    it('should handle concurrent operations', async () => {
      const promises = []
      
      // Set multiple keys concurrently
      for (let i = 0; i < 100; i++) {
        promises.push(cacheManager.set(`key-${i}`, `value-${i}`))
      }

      await Promise.all(promises)

      // Verify all keys were set
      for (let i = 0; i < 100; i++) {
        const result = await cacheManager.get(`key-${i}`)
        expect(result).toEqual(`value-${i}`)
      }
    })
  })

  describe('statistics', () => {
    it('should track cache statistics', async () => {
      const key1 = 'test-key-1'
      const key2 = 'test-key-2'
      const value1 = { data: 'value1' }
      const value2 = { data: 'value2' }

      // Set data
      await cacheManager.set(key1, value1)
      await cacheManager.set(key2, value2)

      // Get data (hits)
      await cacheManager.get(key1)
      await cacheManager.get(key2)

      // Get non-existent data (miss)
      await cacheManager.get('non-existent')

      const stats = cacheManager.getStats()

      expect(stats.hits).toBe(2)
      expect(stats.misses).toBe(1)
      expect(stats.size).toBe(2)
      expect(stats.hitRate).toBe(2 / 3) // 2 hits out of 3 total requests
    })

    it('should reset statistics', async () => {
      // Generate some stats
      await cacheManager.set('key', 'value')
      await cacheManager.get('key')
      await cacheManager.get('non-existent')

      const statsBefore = cacheManager.getStats()
      expect(statsBefore.hits).toBe(1)
      expect(statsBefore.misses).toBe(1)

      // Reset stats
      cacheManager.resetStats()

      const statsAfter = cacheManager.getStats()
      expect(statsAfter.hits).toBe(0)
      expect(statsAfter.misses).toBe(0)
      expect(statsAfter.size).toBe(1) // Size should remain
    })
  })
})

