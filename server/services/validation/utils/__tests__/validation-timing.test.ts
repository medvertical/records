/**
 * Validation Timing Tests
 * Task 10.4: Test detailed timing breakdowns
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ValidationTimer,
  TimingAggregator,
  createValidationTimer,
  globalTimingAggregator,
  type ValidationTimingBreakdown,
} from '../validation-timing';

describe('ValidationTimer', () => {
  describe('Phase Tracking', () => {
    it('should track a single phase', () => {
      const timer = createValidationTimer('Patient', 'structural');
      
      timer.startPhase('test-phase', 'Testing phase');
      // Simulate some work
      timer.endPhase();

      const breakdown = timer.getBreakdown();

      expect(breakdown.phases.length).toBe(1);
      expect(breakdown.phases[0].name).toBe('test-phase');
      expect(breakdown.phases[0].durationMs).toBeGreaterThanOrEqual(0);
      expect(breakdown.phases[0].description).toBe('Testing phase');
    });

    it('should track multiple phases', () => {
      const timer = createValidationTimer('Patient', 'structural');
      
      timer.startPhase('phase-1', 'First phase');
      timer.endPhase();
      
      timer.startPhase('phase-2', 'Second phase');
      timer.endPhase();

      const breakdown = timer.getBreakdown();

      expect(breakdown.phases.length).toBe(2);
      expect(breakdown.phases[0].name).toBe('phase-1');
      expect(breakdown.phases[1].name).toBe('phase-2');
    });

    it('should automatically end previous phase when starting new one', () => {
      const timer = createValidationTimer('Patient', 'structural');
      
      timer.startPhase('phase-1');
      timer.startPhase('phase-2'); // Should auto-end phase-1
      timer.endPhase(); // End phase-2

      const breakdown = timer.getBreakdown();

      expect(breakdown.phases.length).toBe(2);
      expect(breakdown.phases[0].name).toBe('phase-1');
      expect(breakdown.phases[1].name).toBe('phase-2');
    });

    it('should record completed phases', () => {
      const timer = createValidationTimer('Patient', 'structural');
      
      timer.recordPhase('completed-phase', 100, 'Already finished phase');

      const breakdown = timer.getBreakdown();

      expect(breakdown.phases.length).toBe(1);
      expect(breakdown.phases[0].name).toBe('completed-phase');
      expect(breakdown.phases[0].durationMs).toBe(100);
      expect(breakdown.phases[0].description).toBe('Already finished phase');
    });

    it('should handle phase metadata', () => {
      const timer = createValidationTimer('Patient', 'structural');
      
      timer.startPhase('test-phase', 'With metadata', { key: 'value', count: 42 });
      timer.endPhase();

      const breakdown = timer.getBreakdown();

      expect(breakdown.phases[0].metadata).toBeDefined();
      expect(breakdown.phases[0].metadata?.key).toBe('value');
      expect(breakdown.phases[0].metadata?.count).toBe(42);
    });
  });

  describe('Timing Breakdown', () => {
    it('should calculate total time correctly', () => {
      const timer = createValidationTimer('Patient', 'structural');
      
      const startTime = Date.now();
      timer.recordPhase('phase-1', 50);
      timer.recordPhase('phase-2', 75);
      const breakdown = timer.getBreakdown();

      expect(breakdown.totalMs).toBeGreaterThanOrEqual(0);
      expect(breakdown.totalMs).toBeLessThan(Date.now() - startTime + 100); // Allow some overhead
    });

    it('should map phase names to specific timing fields', () => {
      const timer = createValidationTimer('Patient', 'hapi');
      
      timer.recordPhase('hapi-spawn', 100);
      timer.recordPhase('hapi-package-load', 50);
      timer.recordPhase('hapi-validation', 200);
      timer.recordPhase('hapi-parse', 25);
      timer.recordPhase('post-processing', 30);

      const breakdown = timer.getBreakdown();

      expect(breakdown.hapiSpawnMs).toBe(100);
      expect(breakdown.hapiPackageLoadMs).toBe(50);
      expect(breakdown.hapiValidationMs).toBe(200);
      expect(breakdown.hapiParseMs).toBe(25);
      expect(breakdown.postProcessingMs).toBe(30);
    });

    it('should map aspect names to specific timing fields', () => {
      const timer = createValidationTimer('Patient', 'overall');
      
      timer.recordPhase('structural', 100);
      timer.recordPhase('profile', 150);
      timer.recordPhase('terminology', 80);
      timer.recordPhase('reference', 60);
      timer.recordPhase('businessRule', 40);
      timer.recordPhase('metadata', 20);

      const breakdown = timer.getBreakdown();

      expect(breakdown.structuralMs).toBe(100);
      expect(breakdown.profileMs).toBe(150);
      expect(breakdown.terminologyMs).toBe(80);
      expect(breakdown.referenceMs).toBe(60);
      expect(breakdown.businessRuleMs).toBe(40);
      expect(breakdown.metadataMs).toBe(20);
    });

    it('should include resource type and aspect in breakdown', () => {
      const timer = createValidationTimer('Observation', 'terminology');
      
      timer.recordPhase('test-phase', 50);
      const breakdown = timer.getBreakdown();

      expect(breakdown.resourceType).toBe('Observation');
      expect(breakdown.aspect).toBe('terminology');
    });

    it('should include timestamp in breakdown', () => {
      const timer = createValidationTimer('Patient', 'structural');
      
      timer.recordPhase('test-phase', 50);
      const breakdown = timer.getBreakdown();

      expect(breakdown.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('Summary Statistics', () => {
    it('should calculate summary with no phases', () => {
      const timer = createValidationTimer('Patient', 'structural');
      
      const summary = timer.getSummary();

      expect(summary.phaseCount).toBe(0);
      expect(summary.avgPhaseMs).toBe(0);
      expect(summary.totalMs).toBeGreaterThanOrEqual(0);
    });

    it('should calculate summary with phases', () => {
      const timer = createValidationTimer('Patient', 'structural');
      
      timer.recordPhase('phase-1', 100);
      timer.recordPhase('phase-2', 200);
      timer.recordPhase('phase-3', 150);

      const summary = timer.getSummary();

      expect(summary.phaseCount).toBe(3);
      expect(summary.avgPhaseMs).toBe(150); // (100 + 200 + 150) / 3
      expect(summary.longestPhase?.name).toBe('phase-2');
      expect(summary.longestPhase?.durationMs).toBe(200);
      expect(summary.shortestPhase?.name).toBe('phase-1');
      expect(summary.shortestPhase?.durationMs).toBe(100);
    });
  });

  describe('Formatting', () => {
    it('should format breakdown as readable string', () => {
      const timer = createValidationTimer('Patient', 'structural');
      
      timer.recordPhase('phase-1', 100, 'First phase');
      timer.recordPhase('phase-2', 50, 'Second phase');

      const formatted = timer.formatBreakdown();

      expect(formatted).toContain('Validation Timing Breakdown');
      expect(formatted).toContain('Resource Type: Patient');
      expect(formatted).toContain('Aspect: structural');
      expect(formatted).toContain('phase-1');
      expect(formatted).toContain('phase-2');
      expect(formatted).toContain('100ms');
      expect(formatted).toContain('50ms');
    });
  });
});

describe('TimingAggregator', () => {
  let aggregator: TimingAggregator;

  beforeEach(() => {
    aggregator = new TimingAggregator();
  });

  describe('Adding Breakdowns', () => {
    it('should add breakdown', () => {
      const timer = createValidationTimer('Patient', 'structural');
      timer.recordPhase('test', 100);
      const breakdown = timer.getBreakdown();

      aggregator.add(breakdown);

      const all = aggregator.getAll();
      expect(all.length).toBe(1);
      expect(all[0]).toEqual(breakdown);
    });

    it('should limit history to max size', () => {
      // Create more than maxHistory (1000) breakdowns
      for (let i = 0; i < 1100; i++) {
        const timer = createValidationTimer('Patient', 'structural');
        timer.recordPhase('test', i);
        aggregator.add(timer.getBreakdown());
      }

      const all = aggregator.getAll();
      expect(all.length).toBe(1000); // Should keep only last 1000
    });
  });

  describe('Statistics Aggregation', () => {
    it('should return empty stats when no breakdowns', () => {
      const stats = aggregator.getStats();

      expect(stats.count).toBe(0);
      expect(stats.avgTotalMs).toBe(0);
      expect(stats.minTotalMs).toBe(0);
      expect(stats.maxTotalMs).toBe(0);
      expect(Object.keys(stats.byPhase).length).toBe(0);
      expect(Object.keys(stats.byResourceType).length).toBe(0);
      expect(Object.keys(stats.byAspect).length).toBe(0);
    });

    it('should calculate aggregate statistics', () => {
      // Add multiple breakdowns with different timings
      for (let i = 0; i < 5; i++) {
        const timer = createValidationTimer('Patient', 'structural');
        timer.recordPhase('phase-1', 100 + i * 10);
        aggregator.add(timer.getBreakdown());
      }

      const stats = aggregator.getStats();

      expect(stats.count).toBe(5);
      expect(stats.avgTotalMs).toBeGreaterThanOrEqual(0); // Can be 0 for fast execution
      expect(stats.minTotalMs).toBeGreaterThanOrEqual(0);
      expect(stats.maxTotalMs).toBeGreaterThanOrEqual(stats.minTotalMs);
    });

    it('should aggregate by phase', () => {
      const timer1 = createValidationTimer('Patient', 'structural');
      timer1.recordPhase('phase-1', 100);
      timer1.recordPhase('phase-2', 50);
      aggregator.add(timer1.getBreakdown());

      const timer2 = createValidationTimer('Observation', 'structural');
      timer2.recordPhase('phase-1', 120);
      timer2.recordPhase('phase-2', 60);
      aggregator.add(timer2.getBreakdown());

      const stats = aggregator.getStats();

      expect(stats.byPhase['phase-1']).toBeDefined();
      expect(stats.byPhase['phase-1'].count).toBe(2);
      expect(stats.byPhase['phase-1'].avgMs).toBe(110); // (100 + 120) / 2
      expect(stats.byPhase['phase-1'].minMs).toBe(100);
      expect(stats.byPhase['phase-1'].maxMs).toBe(120);

      expect(stats.byPhase['phase-2']).toBeDefined();
      expect(stats.byPhase['phase-2'].count).toBe(2);
      expect(stats.byPhase['phase-2'].avgMs).toBe(55); // (50 + 60) / 2
    });

    it('should aggregate by resource type', () => {
      const timer1 = createValidationTimer('Patient', 'structural');
      timer1.recordPhase('test', 100);
      aggregator.add(timer1.getBreakdown());

      const timer2 = createValidationTimer('Patient', 'structural');
      timer2.recordPhase('test', 120);
      aggregator.add(timer2.getBreakdown());

      const timer3 = createValidationTimer('Observation', 'structural');
      timer3.recordPhase('test', 80);
      aggregator.add(timer3.getBreakdown());

      const stats = aggregator.getStats();

      expect(stats.byResourceType['Patient']).toBeDefined();
      expect(stats.byResourceType['Patient'].count).toBe(2);
      expect(stats.byResourceType['Observation']).toBeDefined();
      expect(stats.byResourceType['Observation'].count).toBe(1);
    });

    it('should aggregate by aspect', () => {
      const timer1 = createValidationTimer('Patient', 'structural');
      timer1.recordPhase('test', 100);
      aggregator.add(timer1.getBreakdown());

      const timer2 = createValidationTimer('Patient', 'profile');
      timer2.recordPhase('test', 150);
      aggregator.add(timer2.getBreakdown());

      const stats = aggregator.getStats();

      expect(stats.byAspect['structural']).toBeDefined();
      expect(stats.byAspect['structural'].count).toBe(1);
      expect(stats.byAspect['profile']).toBeDefined();
      expect(stats.byAspect['profile'].count).toBe(1);
    });
  });

  describe('Clear and Get All', () => {
    it('should clear all breakdowns', () => {
      const timer = createValidationTimer('Patient', 'structural');
      timer.recordPhase('test', 100);
      aggregator.add(timer.getBreakdown());

      expect(aggregator.getAll().length).toBe(1);

      aggregator.clear();

      expect(aggregator.getAll().length).toBe(0);
      expect(aggregator.getStats().count).toBe(0);
    });

    it('should return all breakdowns', () => {
      const breakdowns: ValidationTimingBreakdown[] = [];
      for (let i = 0; i < 5; i++) {
        const timer = createValidationTimer('Patient', 'structural');
        timer.recordPhase('test', 100 + i * 10);
        const breakdown = timer.getBreakdown();
        breakdowns.push(breakdown);
        aggregator.add(breakdown);
      }

      const all = aggregator.getAll();

      expect(all.length).toBe(5);
      expect(all).toEqual(breakdowns);
    });
  });
});

describe('Global Timing Aggregator', () => {
  it('should be a singleton instance', () => {
    expect(globalTimingAggregator).toBeDefined();
    expect(globalTimingAggregator).toBeInstanceOf(TimingAggregator);
  });

  it('should persist data across imports', () => {
    const timer = createValidationTimer('Patient', 'structural');
    timer.recordPhase('test', 100);
    globalTimingAggregator.add(timer.getBreakdown());

    // In a real scenario, this would be in a different module
    const stats = globalTimingAggregator.getStats();

    expect(stats.count).toBeGreaterThanOrEqual(1);
  });
});

