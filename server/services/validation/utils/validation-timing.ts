/**
 * Validation Timing Utilities
 * Task 10.4: Detailed timing breakdowns for validation phases
 * 
 * Tracks granular timing information for:
 * - HAPI spawn time
 * - Package loading time
 * - Actual validation execution
 * - Post-processing (mapping, enhancement)
 */

/**
 * Validation timing breakdown interface
 */
export interface ValidationTimingBreakdown {
  // Overall timing
  totalMs: number;
  
  // HAPI-specific timing
  hapiSpawnMs?: number;       // Time to spawn Java process
  hapiPackageLoadMs?: number; // Time to load IG packages
  hapiValidationMs?: number;  // Actual validation execution
  hapiParseMs?: number;       // Parsing OperationOutcome
  
  // Aspect-specific timing
  structuralMs?: number;
  profileMs?: number;
  terminologyMs?: number;
  referenceMs?: number;
  businessRuleMs?: number;
  metadataMs?: number;
  
  // Post-processing timing
  postProcessingMs?: number;  // Issue mapping and enhancement
  cacheOperationMs?: number;  // Cache read/write operations
  
  // Phase details
  phases: ValidationPhase[];
  
  // Metadata
  timestamp: Date;
  resourceType?: string;
  aspect?: string;
}

/**
 * Individual validation phase
 */
export interface ValidationPhase {
  name: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  description?: string;
  metadata?: Record<string, any>;
}

/**
 * Timer class for tracking validation phases
 */
export class ValidationTimer {
  private startTime: number;
  private phases: ValidationPhase[] = [];
  private currentPhase: { name: string; startMs: number; description?: string; metadata?: Record<string, any> } | null = null;
  private resourceType?: string;
  private aspect?: string;

  constructor(resourceType?: string, aspect?: string) {
    this.startTime = Date.now();
    this.resourceType = resourceType;
    this.aspect = aspect;
  }

  /**
   * Start a new phase
   */
  startPhase(name: string, description?: string, metadata?: Record<string, any>): void {
    // End previous phase if one is active
    if (this.currentPhase) {
      this.endPhase();
    }

    this.currentPhase = {
      name,
      startMs: Date.now() - this.startTime,
      description,
      metadata,
    };
  }

  /**
   * End current phase
   */
  endPhase(): void {
    if (!this.currentPhase) {
      return;
    }

    const endMs = Date.now() - this.startTime;
    const phase: ValidationPhase = {
      name: this.currentPhase.name,
      startMs: this.currentPhase.startMs,
      endMs,
      durationMs: endMs - this.currentPhase.startMs,
      description: this.currentPhase.description,
      metadata: this.currentPhase.metadata,
    };

    this.phases.push(phase);
    this.currentPhase = null;
  }

  /**
   * Record a phase that has already completed
   */
  recordPhase(name: string, durationMs: number, description?: string, metadata?: Record<string, any>): void {
    const startMs = this.phases.length > 0 
      ? this.phases[this.phases.length - 1].endMs 
      : 0;

    this.phases.push({
      name,
      startMs,
      endMs: startMs + durationMs,
      durationMs,
      description,
      metadata,
    });
  }

  /**
   * Get timing breakdown
   */
  getBreakdown(): ValidationTimingBreakdown {
    // End current phase if still active
    if (this.currentPhase) {
      this.endPhase();
    }

    const totalMs = Date.now() - this.startTime;

    // Extract specific timings from phases
    const breakdown: ValidationTimingBreakdown = {
      totalMs,
      phases: [...this.phases],
      timestamp: new Date(),
      resourceType: this.resourceType,
      aspect: this.aspect,
    };

    // Map phase names to specific timing fields
    for (const phase of this.phases) {
      switch (phase.name) {
        case 'hapi-spawn':
          breakdown.hapiSpawnMs = phase.durationMs;
          break;
        case 'hapi-package-load':
          breakdown.hapiPackageLoadMs = phase.durationMs;
          break;
        case 'hapi-validation':
          breakdown.hapiValidationMs = phase.durationMs;
          break;
        case 'hapi-parse':
          breakdown.hapiParseMs = phase.durationMs;
          break;
        case 'structural':
          breakdown.structuralMs = phase.durationMs;
          break;
        case 'profile':
          breakdown.profileMs = phase.durationMs;
          break;
        case 'terminology':
          breakdown.terminologyMs = phase.durationMs;
          break;
        case 'reference':
          breakdown.referenceMs = phase.durationMs;
          break;
        case 'businessRule':
          breakdown.businessRuleMs = phase.durationMs;
          break;
        case 'metadata':
          breakdown.metadataMs = phase.durationMs;
          break;
        case 'post-processing':
          breakdown.postProcessingMs = phase.durationMs;
          break;
        case 'cache-operation':
          breakdown.cacheOperationMs = phase.durationMs;
          break;
      }
    }

    return breakdown;
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    totalMs: number;
    phaseCount: number;
    longestPhase?: { name: string; durationMs: number };
    shortestPhase?: { name: string; durationMs: number };
    avgPhaseMs: number;
  } {
    if (this.currentPhase) {
      this.endPhase();
    }

    if (this.phases.length === 0) {
      return {
        totalMs: Date.now() - this.startTime,
        phaseCount: 0,
        avgPhaseMs: 0,
      };
    }

    const longestPhase = this.phases.reduce((prev, current) =>
      current.durationMs > prev.durationMs ? current : prev
    );

    const shortestPhase = this.phases.reduce((prev, current) =>
      current.durationMs < prev.durationMs ? current : prev
    );

    const totalPhaseMs = this.phases.reduce((sum, phase) => sum + phase.durationMs, 0);

    return {
      totalMs: Date.now() - this.startTime,
      phaseCount: this.phases.length,
      longestPhase: {
        name: longestPhase.name,
        durationMs: longestPhase.durationMs,
      },
      shortestPhase: {
        name: shortestPhase.name,
        durationMs: shortestPhase.durationMs,
      },
      avgPhaseMs: totalPhaseMs / this.phases.length,
    };
  }

  /**
   * Format timing breakdown as readable string
   */
  formatBreakdown(): string {
    const breakdown = this.getBreakdown();
    const lines: string[] = [];

    lines.push(`Validation Timing Breakdown (Total: ${breakdown.totalMs}ms)`);
    
    if (breakdown.resourceType) {
      lines.push(`Resource Type: ${breakdown.resourceType}`);
    }
    
    if (breakdown.aspect) {
      lines.push(`Aspect: ${breakdown.aspect}`);
    }

    lines.push('');
    lines.push('Phases:');

    for (const phase of breakdown.phases) {
      const pct = ((phase.durationMs / breakdown.totalMs) * 100).toFixed(1);
      lines.push(
        `  ${phase.name.padEnd(20)} ${phase.durationMs.toString().padStart(6)}ms (${pct.padStart(5)}%)`
      );
      
      if (phase.description) {
        lines.push(`    └─ ${phase.description}`);
      }
    }

    return lines.join('\n');
  }
}

/**
 * Create a new validation timer
 */
export function createValidationTimer(resourceType?: string, aspect?: string): ValidationTimer {
  return new ValidationTimer(resourceType, aspect);
}

/**
 * Timing aggregator for collecting timing data across multiple validations
 */
export class TimingAggregator {
  private breakdowns: ValidationTimingBreakdown[] = [];
  private readonly maxHistory = 1000;

  /**
   * Add a timing breakdown
   */
  add(breakdown: ValidationTimingBreakdown): void {
    this.breakdowns.push(breakdown);

    // Keep only recent breakdowns
    if (this.breakdowns.length > this.maxHistory) {
      this.breakdowns.shift();
    }
  }

  /**
   * Get aggregate statistics
   */
  getStats(): {
    count: number;
    avgTotalMs: number;
    minTotalMs: number;
    maxTotalMs: number;
    byPhase: Record<string, { count: number; avgMs: number; minMs: number; maxMs: number }>;
    byResourceType: Record<string, { count: number; avgMs: number }>;
    byAspect: Record<string, { count: number; avgMs: number }>;
  } {
    if (this.breakdowns.length === 0) {
      return {
        count: 0,
        avgTotalMs: 0,
        minTotalMs: 0,
        maxTotalMs: 0,
        byPhase: {},
        byResourceType: {},
        byAspect: {},
      };
    }

    const totalMs = this.breakdowns.map((b) => b.totalMs);
    const avgTotalMs = totalMs.reduce((sum, t) => sum + t, 0) / totalMs.length;
    const minTotalMs = Math.min(...totalMs);
    const maxTotalMs = Math.max(...totalMs);

    // Aggregate by phase
    const byPhase: Record<string, number[]> = {};
    for (const breakdown of this.breakdowns) {
      for (const phase of breakdown.phases) {
        if (!byPhase[phase.name]) {
          byPhase[phase.name] = [];
        }
        byPhase[phase.name].push(phase.durationMs);
      }
    }

    const byPhaseStats: Record<string, { count: number; avgMs: number; minMs: number; maxMs: number }> = {};
    for (const [name, durations] of Object.entries(byPhase)) {
      byPhaseStats[name] = {
        count: durations.length,
        avgMs: durations.reduce((sum, d) => sum + d, 0) / durations.length,
        minMs: Math.min(...durations),
        maxMs: Math.max(...durations),
      };
    }

    // Aggregate by resource type
    const byResourceType: Record<string, number[]> = {};
    for (const breakdown of this.breakdowns) {
      if (breakdown.resourceType) {
        if (!byResourceType[breakdown.resourceType]) {
          byResourceType[breakdown.resourceType] = [];
        }
        byResourceType[breakdown.resourceType].push(breakdown.totalMs);
      }
    }

    const byResourceTypeStats: Record<string, { count: number; avgMs: number }> = {};
    for (const [type, durations] of Object.entries(byResourceType)) {
      byResourceTypeStats[type] = {
        count: durations.length,
        avgMs: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      };
    }

    // Aggregate by aspect
    const byAspect: Record<string, number[]> = {};
    for (const breakdown of this.breakdowns) {
      if (breakdown.aspect) {
        if (!byAspect[breakdown.aspect]) {
          byAspect[breakdown.aspect] = [];
        }
        byAspect[breakdown.aspect].push(breakdown.totalMs);
      }
    }

    const byAspectStats: Record<string, { count: number; avgMs: number }> = {};
    for (const [aspect, durations] of Object.entries(byAspect)) {
      byAspectStats[aspect] = {
        count: durations.length,
        avgMs: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      };
    }

    return {
      count: this.breakdowns.length,
      avgTotalMs,
      minTotalMs,
      maxTotalMs,
      byPhase: byPhaseStats,
      byResourceType: byResourceTypeStats,
      byAspect: byAspectStats,
    };
  }

  /**
   * Clear all stored breakdowns
   */
  clear(): void {
    this.breakdowns = [];
  }

  /**
   * Get all breakdowns
   */
  getAll(): ValidationTimingBreakdown[] {
    return [...this.breakdowns];
  }
}

/**
 * Global timing aggregator instance
 */
export const globalTimingAggregator = new TimingAggregator();


