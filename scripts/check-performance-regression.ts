#!/usr/bin/env ts-node
/**
 * Performance Regression Checker
 * Task 10.5: Automated performance regression detection
 * 
 * Usage:
 *   npm run check-perf-regression
 *   node scripts/check-performance-regression.ts
 */

import { performanceBaselineTracker } from '../server/services/performance/performance-baseline';
import { globalTimingAggregator } from '../server/services/validation/utils/validation-timing';

interface RegressionResult {
  hasRegressions: boolean;
  regressions: string[];
  improvements: string[];
  warnings: string[];
  summary: {
    coldStartChange: number;
    warmCacheChange: number;
    throughputChange: number;
  };
}

/**
 * Check for performance regressions
 */
function checkPerformanceRegression(): RegressionResult {
  const result: RegressionResult = {
    hasRegressions: false,
    regressions: [],
    improvements: [],
    warnings: [],
    summary: {
      coldStartChange: 0,
      warmCacheChange: 0,
      throughputChange: 0,
    },
  };

  // Get current and previous baselines
  const allBaselines = performanceBaselineTracker.getAllBaselines();
  
  if (allBaselines.length < 2) {
    result.warnings.push('Not enough baseline data for comparison (need at least 2)');
    return result;
  }

  const current = allBaselines[allBaselines.length - 1];
  const previous = allBaselines[allBaselines.length - 2];

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   Performance Regression Check                             ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Comparing baselines:`);
  console.log(`  Current:  ${current.timestamp}`);
  console.log(`  Previous: ${previous.timestamp}`);
  console.log('');

  // Compare baselines
  const comparison = performanceBaselineTracker.compareToBaseline(previous);

  // Store summary
  result.summary.coldStartChange = comparison.coldStartDiff;
  result.summary.warmCacheChange = comparison.warmCacheDiff;
  result.summary.throughputChange = comparison.throughputDiff;

  // Check for regressions
  if (comparison.regressions.length > 0) {
    result.hasRegressions = true;
    result.regressions = comparison.regressions;
  }

  result.improvements = comparison.improvements;

  // Additional checks using timing aggregator
  const timingStats = globalTimingAggregator.getStats();
  
  // Check for slow phases
  Object.entries(timingStats.byPhase).forEach(([phase, stats]) => {
    if (stats.avgMs > 1000) {
      result.warnings.push(`Slow phase detected: ${phase} averages ${stats.avgMs.toFixed(0)}ms`);
    }
  });

  // Check cache effectiveness
  if (current.cacheEffectiveness.hitRate < 0.5) {
    result.warnings.push(
      `Low cache hit rate: ${(current.cacheEffectiveness.hitRate * 100).toFixed(1)}%`
    );
  }

  // Check memory usage
  if (current.memoryUsageMB.heapUsed > 512) {
    result.warnings.push(
      `High memory usage: ${current.memoryUsageMB.heapUsed.toFixed(0)}MB heap used`
    );
  }

  return result;
}

/**
 * Print regression report
 */
function printReport(result: RegressionResult): void {
  console.log('═══ Performance Summary ═══');
  console.log('');

  // Print summary
  console.log('Changes from previous baseline:');
  console.log(`  Cold Start:  ${formatChange(result.summary.coldStartChange)}ms`);
  console.log(`  Warm Cache:  ${formatChange(result.summary.warmCacheChange)}ms`);
  console.log(`  Throughput:  ${formatChange(result.summary.throughputChange, true)} resources/sec`);
  console.log('');

  // Print regressions
  if (result.regressions.length > 0) {
    console.log('⚠️  REGRESSIONS DETECTED:');
    result.regressions.forEach((r) => console.log(`  ❌ ${r}`));
    console.log('');
  }

  // Print improvements
  if (result.improvements.length > 0) {
    console.log('✅ IMPROVEMENTS:');
    result.improvements.forEach((i) => console.log(`  ✓ ${i}`));
    console.log('');
  }

  // Print warnings
  if (result.warnings.length > 0) {
    console.log('⚠️  WARNINGS:');
    result.warnings.forEach((w) => console.log(`  ⚠ ${w}`));
    console.log('');
  }

  // Final verdict
  if (result.hasRegressions) {
    console.log('❌ FAIL: Performance regressions detected');
    console.log('');
    console.log('Action required:');
    console.log('  1. Review profiling data to identify bottlenecks');
    console.log('  2. Run: npm run profile:timing');
    console.log('  3. Check logs for errors or warnings');
    console.log('  4. Consider optimization strategies in docs/performance/profiling-guide.md');
  } else if (result.warnings.length > 0) {
    console.log('⚠️  PASS with warnings: No critical regressions, but performance could be improved');
  } else {
    console.log('✅ PASS: No performance regressions detected');
  }

  console.log('');
}

/**
 * Format change value with color
 */
function formatChange(value: number, higherIsBetter: boolean = false): string {
  const sign = value >= 0 ? '+' : '';
  const color = higherIsBetter 
    ? (value > 0 ? '\x1b[32m' : value < 0 ? '\x1b[31m' : '')
    : (value < 0 ? '\x1b[32m' : value > 0 ? '\x1b[31m' : '');
  const reset = '\x1b[0m';
  
  return `${color}${sign}${value.toFixed(1)}${reset}`;
}

/**
 * Analyze bottlenecks from timing data
 */
function analyzeBottlenecks(): void {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   Bottleneck Analysis                                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  const stats = globalTimingAggregator.getStats();

  if (stats.count === 0) {
    console.log('No timing data available');
    console.log('Run some validations first to collect timing data');
    return;
  }

  console.log(`Analyzed ${stats.count} validation(s)`);
  console.log('');

  // Sort phases by average time
  const phasesByTime = Object.entries(stats.byPhase)
    .sort((a, b) => b[1].avgMs - a[1].avgMs)
    .slice(0, 10); // Top 10

  if (phasesByTime.length > 0) {
    console.log('═══ Slowest Phases ═══');
    console.log('');
    console.log('Phase                      Avg Time    Min/Max         Count');
    console.log('────────────────────────────────────────────────────────────');
    
    phasesByTime.forEach(([phase, phaseStats]) => {
      const phaseName = phase.padEnd(25);
      const avgTime = `${phaseStats.avgMs.toFixed(0)}ms`.padStart(8);
      const minMax = `${phaseStats.minMs.toFixed(0)}/${phaseStats.maxMs.toFixed(0)}ms`.padStart(14);
      const count = phaseStats.count.toString().padStart(6);
      
      console.log(`${phaseName} ${avgTime}    ${minMax}   ${count}`);
    });
    console.log('');
  }

  // Analyze by resource type
  if (Object.keys(stats.byResourceType).length > 0) {
    console.log('═══ By Resource Type ═══');
    console.log('');
    console.log('Resource Type         Avg Time    Count');
    console.log('────────────────────────────────────────');
    
    Object.entries(stats.byResourceType)
      .sort((a, b) => b[1].avgMs - a[1].avgMs)
      .forEach(([type, typeStats]) => {
        const typeName = type.padEnd(20);
        const avgTime = `${typeStats.avgMs.toFixed(0)}ms`.padStart(8);
        const count = typeStats.count.toString().padStart(6);
        
        console.log(`${typeName} ${avgTime}   ${count}`);
      });
    console.log('');
  }

  // Recommendations
  console.log('═══ Recommendations ═══');
  console.log('');

  const recommendations: string[] = [];

  // Check HAPI spawn time
  const hapiSpawn = stats.byPhase['hapi-spawn'];
  if (hapiSpawn && hapiSpawn.avgMs > 500) {
    recommendations.push(
      `• HAPI spawn time is high (${hapiSpawn.avgMs.toFixed(0)}ms avg)` +
      `\n  Consider: Enable HAPI process pool (Task 10.6)`
    );
  }

  // Check terminology validation
  const terminology = stats.byPhase['terminology'];
  if (terminology && terminology.avgMs > 200) {
    recommendations.push(
      `• Terminology validation is slow (${terminology.avgMs.toFixed(0)}ms avg)` +
      `\n  Consider: Implement batch validation and aggressive caching (Task 10.7)`
    );
  }

  // Check profile validation
  const profile = stats.byPhase['profile'];
  if (profile && profile.avgMs > 1000) {
    recommendations.push(
      `• Profile validation is slow (${profile.avgMs.toFixed(0)}ms avg)` +
      `\n  Consider: Pre-load common profiles at startup (Task 10.8)`
    );
  }

  // Check reference validation
  const reference = stats.byPhase['reference'];
  if (reference && reference.avgMs > 500) {
    recommendations.push(
      `• Reference validation is slow (${reference.avgMs.toFixed(0)}ms avg)` +
      `\n  Consider: Batch HTTP requests and use HEAD instead of GET (Task 10.9)`
    );
  }

  // Check for sequential execution
  if (phasesByTime.length >= 3) {
    const top3Total = phasesByTime.slice(0, 3).reduce((sum, [, s]) => sum + s.avgMs, 0);
    const avgTotal = stats.avgTotalMs;
    
    if (top3Total > avgTotal * 0.8) {
      recommendations.push(
        `• Top 3 phases account for ${((top3Total / avgTotal) * 100).toFixed(0)}% of validation time` +
        `\n  Consider: Implement parallel aspect validation (Task 10.10)`
      );
    }
  }

  if (recommendations.length > 0) {
    recommendations.forEach((r) => console.log(r + '\n'));
  } else {
    console.log('✅ No major bottlenecks detected');
    console.log('   Performance appears to be within acceptable ranges');
  }

  console.log('');
  console.log('For detailed profiling, run:');
  console.log('  npm run profile:timing');
  console.log('  npm run profile:clinic');
  console.log('');
}

// Main execution
if (require.main === module) {
  try {
    const result = checkPerformanceRegression();
    printReport(result);
    
    // Analyze bottlenecks
    analyzeBottlenecks();

    // Exit with appropriate code
    process.exit(result.hasRegressions ? 1 : 0);
  } catch (error) {
    console.error('Error checking performance regression:', error);
    process.exit(2);
  }
}

export { checkPerformanceRegression, analyzeBottlenecks };

