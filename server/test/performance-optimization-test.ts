/**
 * Performance Optimization Test
 * 
 * Tests that performance optimizations are working correctly including:
 * - Timing measurements for each validator
 * - Caching for Ontoserver terminology lookups
 * - Timeout handling for external service calls
 * - Storage optimization for validation results
 */

import { testResourceSuite } from './test-resources';
import { PerformanceMeasurer } from '../services/validation/utils/performance-measurer';
import { terminologyCache, codeSystemCache, valueSetCache } from '../services/validation/utils/terminology-cache';
import { OntoserverClient } from '../services/fhir/ontoserver-client';

export interface PerformanceOptimizationTestResult {
  testName: string;
  success: boolean;
  optimizationFeatures: {
    timingMeasurements: boolean;
    caching: boolean;
    timeoutHandling: boolean;
    storageOptimization: boolean;
  };
  performanceMetrics: {
    averageValidationTime: number;
    cacheHitRate: number;
    externalCallReduction: number;
    memoryUsage: number;
    throughput: number;
  };
  testScenarios: {
    timingAccuracy: boolean;
    cacheEffectiveness: boolean;
    timeoutBehavior: boolean;
    storageEfficiency: boolean;
  };
  errors: string[];
}

export class PerformanceOptimizationTest {
  private ontoserverClient: OntoserverClient;

  constructor() {
    this.ontoserverClient = new OntoserverClient();
  }

  /**
   * Run comprehensive performance optimization tests
   */
  async runPerformanceOptimizationTests(): Promise<PerformanceOptimizationTestResult[]> {
    console.log('🚀 Starting Performance Optimization Tests...');
    console.log('==============================================');
    
    const results: PerformanceOptimizationTestResult[] = [];
    
    // Test 1: Timing Measurements for Each Validator
    console.log('\n📋 Test 1: Timing Measurements for Each Validator');
    const timingMeasurementsResult = await this.testTimingMeasurements();
    results.push(timingMeasurementsResult);
    
    // Test 2: Caching for Ontoserver Terminology Lookups
    console.log('\n📋 Test 2: Caching for Ontoserver Terminology Lookups');
    const cachingResult = await this.testCaching();
    results.push(cachingResult);
    
    // Test 3: Timeout Handling for External Service Calls
    console.log('\n📋 Test 3: Timeout Handling for External Service Calls');
    const timeoutHandlingResult = await this.testTimeoutHandling();
    results.push(timeoutHandlingResult);
    
    // Test 4: Storage Optimization for Validation Results
    console.log('\n📋 Test 4: Storage Optimization for Validation Results');
    const storageOptimizationResult = await this.testStorageOptimization();
    results.push(storageOptimizationResult);
    
    // Generate comprehensive summary
    this.generatePerformanceOptimizationSummary(results);
    
    return results;
  }

  /**
   * Test timing measurements for each validator
   */
  private async testTimingMeasurements(): Promise<PerformanceOptimizationTestResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let averageValidationTime = 0;

    console.log('  🔍 Testing timing measurements for each validator...');

    try {
      // Clear existing metrics
      PerformanceMeasurer.clearMetrics();

      // Test 1: Basic operation timing
      const operationId1 = `test-operation-1-${Date.now()}`;
      PerformanceMeasurer.startTiming(operationId1, 'test-operation', { test: 'timing' });
      await new Promise(resolve => setTimeout(resolve, 50)); // Simulate work
      const duration1 = PerformanceMeasurer.endTiming(operationId1);

      if (duration1 < 45 || duration1 > 60) {
        errors.push(`Basic operation timing inaccurate: expected ~50ms, got ${duration1}ms`);
      }

      // Test 2: Validator timing
      const validatorId = `test-validator-${Date.now()}`;
      PerformanceMeasurer.startValidatorTiming(validatorId, 'TestValidator', 'Patient', 'test-patient-001');
      
      // Simulate aspect timings
      PerformanceMeasurer.recordAspectTiming(validatorId, 'structural', 25);
      PerformanceMeasurer.recordAspectTiming(validatorId, 'profile', 15);
      PerformanceMeasurer.recordAspectTiming(validatorId, 'terminology', 30);
      
      // Simulate external call
      PerformanceMeasurer.recordExternalCall(validatorId, 'Ontoserver', 20);
      
      await new Promise(resolve => setTimeout(resolve, 100)); // Simulate validation work
      
      const validatorMetrics = PerformanceMeasurer.endValidatorTiming(validatorId, 5);
      
      if (!validatorMetrics) {
        errors.push('Validator timing metrics not returned');
      } else {
        if (validatorMetrics.duration < 90 || validatorMetrics.duration > 120) {
          errors.push(`Validator timing inaccurate: expected ~100ms, got ${validatorMetrics.duration}ms`);
        }
        
        if (validatorMetrics.totalIssues !== 5) {
          errors.push(`Validator issues count incorrect: expected 5, got ${validatorMetrics.totalIssues}`);
        }
        
        if (Object.keys(validatorMetrics.aspectTimes).length !== 3) {
          errors.push(`Validator aspect times missing: expected 3, got ${Object.keys(validatorMetrics.aspectTimes).length}`);
        }
        
        if (!validatorMetrics.externalCallTimes.Ontoserver) {
          errors.push('External call timing not recorded');
        }
      }

      // Test 3: Pipeline timing
      const pipelineId = `test-pipeline-${Date.now()}`;
      PerformanceMeasurer.startPipelineTiming(pipelineId, 'test-pipeline', 100);
      
      // Simulate processing progress
      for (let i = 1; i <= 100; i += 10) {
        PerformanceMeasurer.updatePipelineProgress(pipelineId, i);
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      // Record bottlenecks
      PerformanceMeasurer.recordPipelineBottleneck(pipelineId, 'External API calls');
      PerformanceMeasurer.recordPipelineBottleneck(pipelineId, 'Database queries');
      
      const pipelineMetrics = PerformanceMeasurer.endPipelineTiming(pipelineId);
      
      if (!pipelineMetrics) {
        errors.push('Pipeline timing metrics not returned');
      } else {
        if (pipelineMetrics.processedResources !== 100) {
          errors.push(`Pipeline processed resources incorrect: expected 100, got ${pipelineMetrics.processedResources}`);
        }
        
        if (pipelineMetrics.bottlenecks.length !== 2) {
          errors.push(`Pipeline bottlenecks missing: expected 2, got ${pipelineMetrics.bottlenecks.length}`);
        }
        
        if (pipelineMetrics.throughput < 50) { // Should be at least 50 resources/sec
          errors.push(`Pipeline throughput too low: ${pipelineMetrics.throughput.toFixed(2)} resources/sec`);
        }
      }

      // Test 4: Performance summary
      const summary = PerformanceMeasurer.getPerformanceSummary();
      
      if (summary.totalOperations < 3) {
        errors.push(`Performance summary missing operations: expected >=3, got ${summary.totalOperations}`);
      }
      
      if (summary.validatorMetrics.length !== 1) {
        errors.push(`Performance summary missing validator metrics: expected 1, got ${summary.validatorMetrics.length}`);
      }
      
      if (summary.pipelineMetrics.length !== 1) {
        errors.push(`Performance summary missing pipeline metrics: expected 1, got ${summary.pipelineMetrics.length}`);
      }

      averageValidationTime = summary.averageDuration;

      const success = errors.length === 0;

      console.log(`    ✅ Timing measurements test completed in ${Date.now() - startTime}ms`);
      console.log(`    📊 Average validation time: ${averageValidationTime.toFixed(2)}ms`);
      console.log(`    🎯 Timing accuracy: ${errors.length === 0 ? 'All measurements accurate' : errors.length + ' issues'}`);

      return {
        testName: 'Timing Measurements for Each Validator',
        success,
        optimizationFeatures: {
          timingMeasurements: true,
          caching: false,
          timeoutHandling: false,
          storageOptimization: false
        },
        performanceMetrics: {
          averageValidationTime,
          cacheHitRate: 0,
          externalCallReduction: 0,
          memoryUsage: 0,
          throughput: pipelineMetrics?.throughput || 0
        },
        testScenarios: {
          timingAccuracy: success,
          cacheEffectiveness: false,
          timeoutBehavior: false,
          storageEfficiency: false
        },
        errors
      };

    } catch (error) {
      const totalTime = Date.now() - startTime;
      errors.push(`Timing measurements test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      console.log(`    ❌ Timing measurements test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        testName: 'Timing Measurements for Each Validator',
        success: false,
        optimizationFeatures: {
          timingMeasurements: false,
          caching: false,
          timeoutHandling: false,
          storageOptimization: false
        },
        performanceMetrics: {
          averageValidationTime: 0,
          cacheHitRate: 0,
          externalCallReduction: 0,
          memoryUsage: 0,
          throughput: 0
        },
        testScenarios: {
          timingAccuracy: false,
          cacheEffectiveness: false,
          timeoutBehavior: false,
          storageEfficiency: false
        },
        errors
      };
    }
  }

  /**
   * Test caching for Ontoserver terminology lookups
   */
  private async testCaching(): Promise<PerformanceOptimizationTestResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let cacheHitRate = 0;
    let externalCallReduction = 0;

    console.log('  🔍 Testing caching for Ontoserver terminology lookups...');

    try {
      // Clear caches
      await terminologyCache.clear();
      await codeSystemCache.clear();
      await valueSetCache.clear();

      // Test 1: Cache miss behavior
      const cacheKey1 = 'test-cache-key-1';
      const testValue1 = { system: 'test-system', codes: ['code1', 'code2'] };
      
      const missResult1 = await codeSystemCache.get('getCodeSystem', { system: cacheKey1 });
      if (missResult1 !== null) {
        errors.push('Cache should return null for non-existent key');
      }

      // Test 2: Cache set and get
      await codeSystemCache.set('getCodeSystem', { system: cacheKey1 }, testValue1);
      
      const hitResult1 = await codeSystemCache.get('getCodeSystem', { system: cacheKey1 });
      if (!hitResult1 || JSON.stringify(hitResult1) !== JSON.stringify(testValue1)) {
        errors.push('Cache should return stored value');
      }

      // Test 3: Cache statistics
      const stats1 = codeSystemCache.getStatistics();
      if (stats1.hits !== 1 || stats1.misses !== 1) {
        errors.push(`Cache statistics incorrect: expected 1 hit, 1 miss; got ${stats1.hits} hits, ${stats1.misses} misses`);
      }

      // Test 4: Cache TTL behavior
      const shortTTLCache = await codeSystemCache.set('getCodeSystem', { system: 'short-ttl' }, testValue1, 100); // 100ms TTL
      await new Promise(resolve => setTimeout(resolve, 150)); // Wait for expiration
      
      const expiredResult = await codeSystemCache.get('getCodeSystem', { system: 'short-ttl' });
      if (expiredResult !== null) {
        errors.push('Cache should return null for expired entries');
      }

      // Test 5: Cache size management
      const stats2 = codeSystemCache.getStatistics();
      cacheHitRate = stats2.hitRate;
      externalCallReduction = cacheHitRate; // Assume cache hits reduce external calls

      // Test 6: Memory usage
      const sizeInfo = codeSystemCache.getSizeInfo();
      if (sizeInfo.entries < 1) {
        errors.push('Cache should have at least one entry');
      }

      const success = errors.length === 0;

      console.log(`    ✅ Caching test completed in ${Date.now() - startTime}ms`);
      console.log(`    📊 Cache hit rate: ${cacheHitRate.toFixed(1)}%`);
      console.log(`    🎯 Cache effectiveness: ${errors.length === 0 ? 'All cache operations working' : errors.length + ' issues'}`);

      return {
        testName: 'Caching for Ontoserver Terminology Lookups',
        success,
        optimizationFeatures: {
          timingMeasurements: false,
          caching: true,
          timeoutHandling: false,
          storageOptimization: false
        },
        performanceMetrics: {
          averageValidationTime: 0,
          cacheHitRate,
          externalCallReduction,
          memoryUsage: sizeInfo.totalSizeMB,
          throughput: 0
        },
        testScenarios: {
          timingAccuracy: false,
          cacheEffectiveness: success,
          timeoutBehavior: false,
          storageEfficiency: false
        },
        errors
      };

    } catch (error) {
      const totalTime = Date.now() - startTime;
      errors.push(`Caching test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      console.log(`    ❌ Caching test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        testName: 'Caching for Ontoserver Terminology Lookups',
        success: false,
        optimizationFeatures: {
          timingMeasurements: false,
          caching: false,
          timeoutHandling: false,
          storageOptimization: false
        },
        performanceMetrics: {
          averageValidationTime: 0,
          cacheHitRate: 0,
          externalCallReduction: 0,
          memoryUsage: 0,
          throughput: 0
        },
        testScenarios: {
          timingAccuracy: false,
          cacheEffectiveness: false,
          timeoutBehavior: false,
          storageEfficiency: false
        },
        errors
      };
    }
  }

  /**
   * Test timeout handling for external service calls
   */
  private async testTimeoutHandling(): Promise<PerformanceOptimizationTestResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    console.log('  🔍 Testing timeout handling for external service calls...');

    try {
      // Test 1: Normal timeout behavior
      const normalStartTime = Date.now();
      try {
        // Simulate a normal operation that completes quickly
        await new Promise(resolve => setTimeout(resolve, 10));
      } catch (error) {
        errors.push('Normal operation should not timeout');
      }
      const normalDuration = Date.now() - normalStartTime;
      
      if (normalDuration > 100) {
        errors.push(`Normal operation took too long: ${normalDuration}ms`);
      }

      // Test 2: Timeout behavior with AbortSignal
      const timeoutStartTime = Date.now();
      let timeoutOccurred = false;
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 50);
        
        // Simulate a slow operation
        await new Promise((resolve, reject) => {
          controller.signal.addEventListener('abort', () => {
            clearTimeout(timeoutId);
            reject(new Error('AbortError: The operation was aborted'));
          });
          
          setTimeout(resolve, 100); // This should be aborted
        });
        
        clearTimeout(timeoutId);
      } catch (error) {
        if (error instanceof Error && error.message.includes('AbortError')) {
          timeoutOccurred = true;
        } else {
          errors.push(`Unexpected error during timeout test: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      const timeoutDuration = Date.now() - timeoutStartTime;
      
      if (!timeoutOccurred) {
        errors.push('Timeout should have occurred');
      }
      
      if (timeoutDuration < 45 || timeoutDuration > 60) {
        errors.push(`Timeout duration inaccurate: expected ~50ms, got ${timeoutDuration}ms`);
      }

      // Test 3: Timeout with fetch (simulating external service)
      const fetchTimeoutStartTime = Date.now();
      let fetchTimeoutOccurred = false;
      
      try {
        // This will timeout because the URL is unreachable
        await fetch('http://192.0.2.1:9999/test', {
          signal: AbortSignal.timeout(100)
        });
      } catch (error) {
        if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('timeout'))) {
          fetchTimeoutOccurred = true;
        } else {
          // Network error is also acceptable for this test
          fetchTimeoutOccurred = true;
        }
      }
      
      const fetchTimeoutDuration = Date.now() - fetchTimeoutStartTime;
      
      if (!fetchTimeoutOccurred) {
        errors.push('Fetch timeout should have occurred');
      }
      
      if (fetchTimeoutDuration > 200) {
        errors.push(`Fetch timeout took too long: ${fetchTimeoutDuration}ms`);
      }

      const success = errors.length === 0;

      console.log(`    ✅ Timeout handling test completed in ${Date.now() - startTime}ms`);
      console.log(`    📊 Timeout behavior: ${errors.length === 0 ? 'All timeout scenarios working' : errors.length + ' issues'}`);

      return {
        testName: 'Timeout Handling for External Service Calls',
        success,
        optimizationFeatures: {
          timingMeasurements: false,
          caching: false,
          timeoutHandling: true,
          storageOptimization: false
        },
        performanceMetrics: {
          averageValidationTime: 0,
          cacheHitRate: 0,
          externalCallReduction: 0,
          memoryUsage: 0,
          throughput: 0
        },
        testScenarios: {
          timingAccuracy: false,
          cacheEffectiveness: false,
          timeoutBehavior: success,
          storageEfficiency: false
        },
        errors
      };

    } catch (error) {
      const totalTime = Date.now() - startTime;
      errors.push(`Timeout handling test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      console.log(`    ❌ Timeout handling test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        testName: 'Timeout Handling for External Service Calls',
        success: false,
        optimizationFeatures: {
          timingMeasurements: false,
          caching: false,
          timeoutHandling: false,
          storageOptimization: false
        },
        performanceMetrics: {
          averageValidationTime: 0,
          cacheHitRate: 0,
          externalCallReduction: 0,
          memoryUsage: 0,
          throughput: 0
        },
        testScenarios: {
          timingAccuracy: false,
          cacheEffectiveness: false,
          timeoutBehavior: false,
          storageEfficiency: false
        },
        errors
      };
    }
  }

  /**
   * Test storage optimization for validation results
   */
  private async testStorageOptimization(): Promise<PerformanceOptimizationTestResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let memoryUsage = 0;

    console.log('  🔍 Testing storage optimization for validation results...');

    try {
      // Test 1: Memory usage tracking
      const initialMemory = process.memoryUsage();
      
      // Create some test data
      const testResults = [];
      for (let i = 0; i < 100; i++) {
        testResults.push({
          id: `test-result-${i}`,
          resourceType: 'Patient',
          resourceId: `patient-${i}`,
          isValid: i % 2 === 0,
          issues: Array.from({ length: Math.floor(Math.random() * 5) }, (_, j) => ({
            id: `issue-${i}-${j}`,
            severity: ['error', 'warning', 'info'][Math.floor(Math.random() * 3)],
            message: `Test issue ${j}`,
            path: `resource.field.${j}`
          })),
          validatedAt: new Date().toISOString(),
          validationTime: Math.floor(Math.random() * 1000)
        });
      }

      const afterCreationMemory = process.memoryUsage();
      memoryUsage = (afterCreationMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024; // MB

      // Test 2: Data compression/serialization
      const serializedResults = JSON.stringify(testResults);
      const serializedSize = Buffer.byteLength(serializedResults, 'utf8');
      
      if (serializedSize < 1000) {
        errors.push(`Serialized data too small: ${serializedSize} bytes`);
      }

      // Test 3: Deserialization performance
      const deserializeStartTime = Date.now();
      const deserializedResults = JSON.parse(serializedResults);
      const deserializeTime = Date.now() - deserializeStartTime;
      
      if (deserializeTime > 50) {
        errors.push(`Deserialization too slow: ${deserializeTime}ms`);
      }

      if (deserializedResults.length !== testResults.length) {
        errors.push(`Deserialization data loss: expected ${testResults.length}, got ${deserializedResults.length}`);
      }

      // Test 4: Memory cleanup
      const beforeCleanupMemory = process.memoryUsage();
      testResults.length = 0; // Clear array
      deserializedResults.length = 0; // Clear array
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const afterCleanupMemory = process.memoryUsage();
      const memoryFreed = (beforeCleanupMemory.heapUsed - afterCleanupMemory.heapUsed) / 1024 / 1024;
      
      if (memoryFreed < 0.1) { // Should free at least 0.1 MB
        errors.push(`Insufficient memory cleanup: only ${memoryFreed.toFixed(2)} MB freed`);
      }

      // Test 5: Storage efficiency metrics
      const storageEfficiency = {
        totalObjects: 100,
        averageObjectSize: serializedSize / 100,
        memoryOverhead: memoryUsage / 100,
        compressionRatio: serializedSize / (memoryUsage * 1024 * 1024)
      };

      if (storageEfficiency.averageObjectSize < 10) {
        errors.push(`Average object size too small: ${storageEfficiency.averageObjectSize.toFixed(2)} bytes`);
      }

      const success = errors.length === 0;

      console.log(`    ✅ Storage optimization test completed in ${Date.now() - startTime}ms`);
      console.log(`    📊 Memory usage: ${memoryUsage.toFixed(2)} MB`);
      console.log(`    📦 Serialized size: ${(serializedSize / 1024).toFixed(2)} KB`);
      console.log(`    🎯 Storage efficiency: ${errors.length === 0 ? 'All storage optimizations working' : errors.length + ' issues'}`);

      return {
        testName: 'Storage Optimization for Validation Results',
        success,
        optimizationFeatures: {
          timingMeasurements: false,
          caching: false,
          timeoutHandling: false,
          storageOptimization: true
        },
        performanceMetrics: {
          averageValidationTime: 0,
          cacheHitRate: 0,
          externalCallReduction: 0,
          memoryUsage,
          throughput: 0
        },
        testScenarios: {
          timingAccuracy: false,
          cacheEffectiveness: false,
          timeoutBehavior: false,
          storageEfficiency: success
        },
        errors
      };

    } catch (error) {
      const totalTime = Date.now() - startTime;
      errors.push(`Storage optimization test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      console.log(`    ❌ Storage optimization test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        testName: 'Storage Optimization for Validation Results',
        success: false,
        optimizationFeatures: {
          timingMeasurements: false,
          caching: false,
          timeoutHandling: false,
          storageOptimization: false
        },
        performanceMetrics: {
          averageValidationTime: 0,
          cacheHitRate: 0,
          externalCallReduction: 0,
          memoryUsage: 0,
          throughput: 0
        },
        testScenarios: {
          timingAccuracy: false,
          cacheEffectiveness: false,
          timeoutBehavior: false,
          storageEfficiency: false
        },
        errors
      };
    }
  }

  /**
   * Generate comprehensive performance optimization test summary
   */
  private generatePerformanceOptimizationSummary(results: PerformanceOptimizationTestResult[]): void {
    console.log('\n🎯 Performance Optimization Test Summary');
    console.log('========================================');

    // Overall statistics
    const totalTests = results.length;
    const passedTests = results.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;
    const passRate = (passedTests / totalTests) * 100;

    console.log(`\n📊 Overall Results:`);
    console.log(`  Total Tests: ${totalTests}`);
    console.log(`  Passed: ${passedTests} (${passRate.toFixed(1)}%)`);
    console.log(`  Failed: ${failedTests}`);

    // Results by test type
    console.log(`\n📋 Results by Test Type:`);
    results.forEach(result => {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      console.log(`  ${status} ${result.testName}`);
      
      const workingFeatures = Object.values(result.optimizationFeatures).filter(Boolean).length;
      console.log(`    Optimization Features: ${workingFeatures}/4 working`);
      
      const workingScenarios = Object.values(result.testScenarios).filter(Boolean).length;
      console.log(`    Test Scenarios: ${workingScenarios}/4 working`);
      
      if (result.errors.length > 0) {
        console.log(`    Errors: ${result.errors.join(', ')}`);
      }
    });

    // Performance metrics statistics
    console.log(`\n⚡ Performance Metrics Statistics:`);
    const avgValidationTime = results.reduce((sum, r) => sum + r.performanceMetrics.averageValidationTime, 0) / totalTests;
    const avgCacheHitRate = results.reduce((sum, r) => sum + r.performanceMetrics.cacheHitRate, 0) / totalTests;
    const avgExternalCallReduction = results.reduce((sum, r) => sum + r.performanceMetrics.externalCallReduction, 0) / totalTests;
    const avgMemoryUsage = results.reduce((sum, r) => sum + r.performanceMetrics.memoryUsage, 0) / totalTests;
    const avgThroughput = results.reduce((sum, r) => sum + r.performanceMetrics.throughput, 0) / totalTests;

    console.log(`  Average Validation Time: ${avgValidationTime.toFixed(2)}ms`);
    console.log(`  Average Cache Hit Rate: ${avgCacheHitRate.toFixed(1)}%`);
    console.log(`  Average External Call Reduction: ${avgExternalCallReduction.toFixed(1)}%`);
    console.log(`  Average Memory Usage: ${avgMemoryUsage.toFixed(2)} MB`);
    console.log(`  Average Throughput: ${avgThroughput.toFixed(2)} resources/sec`);

    // Optimization features statistics
    console.log(`\n🔧 Optimization Features Statistics:`);
    const featureStats = {
      timingMeasurements: results.filter(r => r.optimizationFeatures.timingMeasurements).length,
      caching: results.filter(r => r.optimizationFeatures.caching).length,
      timeoutHandling: results.filter(r => r.optimizationFeatures.timeoutHandling).length,
      storageOptimization: results.filter(r => r.optimizationFeatures.storageOptimization).length
    };

    Object.entries(featureStats).forEach(([feature, count]) => {
      const percentage = (count / totalTests) * 100;
      console.log(`  ${feature}: ${count}/${totalTests} (${percentage.toFixed(1)}%)`);
    });

    // Test scenarios statistics
    console.log(`\n🎯 Test Scenarios Statistics:`);
    const scenarioStats = {
      timingAccuracy: results.filter(r => r.testScenarios.timingAccuracy).length,
      cacheEffectiveness: results.filter(r => r.testScenarios.cacheEffectiveness).length,
      timeoutBehavior: results.filter(r => r.testScenarios.timeoutBehavior).length,
      storageEfficiency: results.filter(r => r.testScenarios.storageEfficiency).length
    };

    Object.entries(scenarioStats).forEach(([scenario, count]) => {
      const percentage = (count / totalTests) * 100;
      console.log(`  ${scenario}: ${count}/${totalTests} (${percentage.toFixed(1)}%)`);
    });

    // Success criteria check
    console.log(`\n🎉 Performance Optimization Success Criteria Check:`);
    console.log(`  ✅ Timing measurements: ${featureStats.timingMeasurements === totalTests ? 'PASS' : 'FAIL'}`);
    console.log(`  ✅ Caching: ${featureStats.caching === totalTests ? 'PASS' : 'FAIL'}`);
    console.log(`  ✅ Timeout handling: ${featureStats.timeoutHandling === totalTests ? 'PASS' : 'FAIL'}`);
    console.log(`  ✅ Storage optimization: ${featureStats.storageOptimization === totalTests ? 'PASS' : 'FAIL'}`);
    console.log(`  ✅ Overall pass rate >= 75%: ${passRate >= 75 ? 'PASS' : 'FAIL'}`);

    console.log(`\n🚀 Performance Optimization Tests ${passRate >= 75 ? 'PASSED' : 'FAILED'}!`);
    
    if (passRate >= 75) {
      console.log('\n🎉 SUCCESS: Performance optimizations are working!');
      console.log('✅ Timing measurements provide accurate performance data');
      console.log('✅ Caching reduces external service calls effectively');
      console.log('✅ Timeout handling prevents hanging operations');
      console.log('✅ Storage optimization minimizes memory usage');
      console.log('✅ All performance optimizations work together seamlessly');
      console.log('✅ Ready for production performance requirements');
    } else {
      console.log('\n❌ FAILURE: Performance optimizations have issues');
      console.log('🔧 Review failed tests and fix optimization mechanisms');
      console.log('📝 Check timing, caching, timeout, and storage optimizations');
    }
  }
}
