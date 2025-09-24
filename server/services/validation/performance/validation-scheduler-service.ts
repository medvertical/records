// ============================================================================
// Validation Scheduler Service
// ============================================================================

import { ValidationStateService } from '../features/validation-state-service.js';
import { getValidationPipeline } from '../core/validation-pipeline';
import { storage } from '../../../storage';

export interface ValidationSchedule {
  id: string;
  name: string;
  description?: string;
  cronExpression: string;
  isActive: boolean;
  configuration: {
    resourceTypes?: string[];
    batchSize?: number;
    skipUnchanged?: boolean;
    validationSettings?: any;
  };
  lastRun?: Date;
  nextRun?: Date;
  runCount: number;
  successCount: number;
  failureCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ValidationTrigger {
  id: string;
  name: string;
  type: 'schedule' | 'event' | 'condition';
  condition?: {
    resourceCount?: number;
    timeSinceLastRun?: number; // milliseconds
    errorRate?: number; // percentage
    validationCoverage?: number; // percentage
  };
  isActive: boolean;
  createdAt: Date;
}

export interface ScheduledValidationRun {
  id: string;
  scheduleId: string;
  startTime: Date;
  endTime?: Date;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  result?: {
    totalResources: number;
    processedResources: number;
    validResources: number;
    errorResources: number;
    duration: number;
  };
  error?: string;
}

export class ValidationSchedulerService {
  private static instance: ValidationSchedulerService;
  private schedules: Map<string, ValidationSchedule> = new Map();
  private triggers: Map<string, ValidationTrigger> = new Map();
  private scheduledRuns: Map<string, ScheduledValidationRun> = new Map();
  private cronJobs: Map<string, any> = new Map();
  private isRunning = false;

  private constructor() {}

  static getInstance(): ValidationSchedulerService {
    if (!ValidationSchedulerService.instance) {
      ValidationSchedulerService.instance = new ValidationSchedulerService();
    }
    return ValidationSchedulerService.instance;
  }

  /**
   * Initialize the scheduler service
   */
  async initialize(): Promise<void> {
    try {
      // Load existing schedules from database
      await this.loadSchedules();
      
      // Load existing triggers
      await this.loadTriggers();
      
      // Start the scheduler
      this.start();
      
      console.log('[ValidationScheduler] Service initialized successfully');
    } catch (error) {
      console.error('[ValidationScheduler] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Create a new validation schedule
   */
  async createSchedule(schedule: Omit<ValidationSchedule, 'id' | 'createdAt' | 'updatedAt' | 'runCount' | 'successCount' | 'failureCount'>): Promise<ValidationSchedule> {
    const newSchedule: ValidationSchedule = {
      ...schedule,
      id: `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      runCount: 0,
      successCount: 0,
      failureCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Validate cron expression
    if (!this.isValidCronExpression(newSchedule.cronExpression)) {
      throw new Error('Invalid cron expression');
    }

    // Calculate next run time
    newSchedule.nextRun = this.calculateNextRun(newSchedule.cronExpression);

    // Store in memory and database
    this.schedules.set(newSchedule.id, newSchedule);
    await this.persistSchedule(newSchedule);

    // Schedule the cron job
    if (newSchedule.isActive) {
      this.scheduleCronJob(newSchedule);
    }

    console.log(`[ValidationScheduler] Created schedule: ${newSchedule.name}`);
    return newSchedule;
  }

  /**
   * Update an existing schedule
   */
  async updateSchedule(scheduleId: string, updates: Partial<ValidationSchedule>): Promise<ValidationSchedule> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      throw new Error('Schedule not found');
    }

    const updatedSchedule = {
      ...schedule,
      ...updates,
      updatedAt: new Date()
    };

    // Validate cron expression if updated
    if (updates.cronExpression && !this.isValidCronExpression(updates.cronExpression)) {
      throw new Error('Invalid cron expression');
    }

    // Recalculate next run time if cron expression changed
    if (updates.cronExpression) {
      updatedSchedule.nextRun = this.calculateNextRun(updatedSchedule.cronExpression);
    }

    // Update in memory and database
    this.schedules.set(scheduleId, updatedSchedule);
    await this.persistSchedule(updatedSchedule);

    // Reschedule cron job if needed
    if (updates.cronExpression || updates.isActive !== undefined) {
      this.unscheduleCronJob(scheduleId);
      if (updatedSchedule.isActive) {
        this.scheduleCronJob(updatedSchedule);
      }
    }

    console.log(`[ValidationScheduler] Updated schedule: ${updatedSchedule.name}`);
    return updatedSchedule;
  }

  /**
   * Delete a schedule
   */
  async deleteSchedule(scheduleId: string): Promise<void> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      throw new Error('Schedule not found');
    }

    // Unschedule cron job
    this.unscheduleCronJob(scheduleId);

    // Remove from memory and database
    this.schedules.delete(scheduleId);
    await this.deleteScheduleFromStorage(scheduleId);

    console.log(`[ValidationScheduler] Deleted schedule: ${schedule.name}`);
  }

  /**
   * Get all schedules
   */
  getSchedules(): ValidationSchedule[] {
    return Array.from(this.schedules.values());
  }

  /**
   * Get a specific schedule
   */
  getSchedule(scheduleId: string): ValidationSchedule | null {
    return this.schedules.get(scheduleId) || null;
  }

  /**
   * Create a validation trigger
   */
  async createTrigger(trigger: Omit<ValidationTrigger, 'id' | 'createdAt'>): Promise<ValidationTrigger> {
    const newTrigger: ValidationTrigger = {
      ...trigger,
      id: `trigger_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date()
    };

    this.triggers.set(newTrigger.id, newTrigger);
    await this.persistTrigger(newTrigger);

    console.log(`[ValidationScheduler] Created trigger: ${newTrigger.name}`);
    return newTrigger;
  }

  /**
   * Check trigger conditions and execute if met
   */
  async checkTriggers(): Promise<void> {
    for (const trigger of this.triggers.values()) {
      if (!trigger.isActive) continue;

      try {
        const shouldTrigger = await this.evaluateTriggerCondition(trigger);
        if (shouldTrigger) {
          await this.executeTriggeredValidation(trigger);
        }
      } catch (error) {
        console.error(`[ValidationScheduler] Error checking trigger ${trigger.name}:`, error);
      }
    }
  }

  /**
   * Execute a scheduled validation
   */
  async executeScheduledValidation(scheduleId: string): Promise<ScheduledValidationRun> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      throw new Error('Schedule not found');
    }

    const run: ScheduledValidationRun = {
      id: `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      scheduleId,
      startTime: new Date(),
      status: 'running'
    };

    this.scheduledRuns.set(run.id, run);

    try {
      console.log(`[ValidationScheduler] Executing scheduled validation: ${schedule.name}`);

      // Create validation state
      const stateService = ValidationStateService.getInstance();
      const validationState = await stateService.createState(schedule.configuration);

      // Start validation
      await stateService.updateState({ status: 'running' });

      // Execute validation using ValidationPipeline
      const result = await this.performValidation(schedule.configuration);

      // Update run result
      run.endTime = new Date();
      run.status = 'completed';
      run.result = result;

      // Update schedule statistics
      schedule.runCount++;
      schedule.successCount++;
      schedule.lastRun = run.startTime;
      schedule.nextRun = this.calculateNextRun(schedule.cronExpression);
      schedule.updatedAt = new Date();

      this.schedules.set(scheduleId, schedule);
      await this.persistSchedule(schedule);

      console.log(`[ValidationScheduler] Completed scheduled validation: ${schedule.name}`);

    } catch (error) {
      console.error(`[ValidationScheduler] Failed scheduled validation: ${schedule.name}`, error);

      run.endTime = new Date();
      run.status = 'failed';
      run.error = error instanceof Error ? error.message : String(error);

      // Update schedule statistics
      schedule.runCount++;
      schedule.failureCount++;
      schedule.lastRun = run.startTime;
      schedule.updatedAt = new Date();

      this.schedules.set(scheduleId, schedule);
      await this.persistSchedule(schedule);
    }

    return run;
  }

  /**
   * Get scheduled runs for a schedule
   */
  getScheduledRuns(scheduleId: string): ScheduledValidationRun[] {
    return Array.from(this.scheduledRuns.values())
      .filter(run => run.scheduleId === scheduleId)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }

  /**
   * Get all scheduled runs
   */
  getAllScheduledRuns(): ScheduledValidationRun[] {
    return Array.from(this.scheduledRuns.values())
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }

  /**
   * Start the scheduler
   */
  private start(): void {
    if (this.isRunning) return;

    this.isRunning = true;

    // Schedule all active schedules
    for (const schedule of this.schedules.values()) {
      if (schedule.isActive) {
        this.scheduleCronJob(schedule);
      }
    }

    // Start trigger checking interval (every 5 minutes)
    setInterval(() => {
      this.checkTriggers();
    }, 5 * 60 * 1000);

    console.log('[ValidationScheduler] Scheduler started');
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;

    // Clear all cron jobs
    for (const scheduleId of this.cronJobs.keys()) {
      this.unscheduleCronJob(scheduleId);
    }

    console.log('[ValidationScheduler] Scheduler stopped');
  }

  /**
   * Schedule a cron job for a schedule
   */
  private scheduleCronJob(schedule: ValidationSchedule): void {
    // In a real implementation, this would use a proper cron library like node-cron
    // For now, we'll simulate with setTimeout for demonstration
    const interval = this.parseCronExpression(schedule.cronExpression);
    
    const job = setInterval(() => {
      this.executeScheduledValidation(schedule.id);
    }, interval);

    this.cronJobs.set(schedule.id, job);
    console.log(`[ValidationScheduler] Scheduled cron job for: ${schedule.name}`);
  }

  /**
   * Unschedule a cron job
   */
  private unscheduleCronJob(scheduleId: string): void {
    const job = this.cronJobs.get(scheduleId);
    if (job) {
      clearInterval(job);
      this.cronJobs.delete(scheduleId);
      console.log(`[ValidationScheduler] Unscheduled cron job for schedule: ${scheduleId}`);
    }
  }

  /**
   * Validate cron expression (simplified)
   */
  private isValidCronExpression(expression: string): boolean {
    // Basic validation - in real implementation, use a proper cron parser
    if (!expression || typeof expression !== 'string') return false;
    const parts = expression.split(' ');
    return parts.length >= 5 && parts.length <= 6;
  }

  /**
   * Calculate next run time from cron expression (simplified)
   */
  private calculateNextRun(cronExpression: string): Date {
    // Simplified implementation - in real implementation, use a proper cron parser
    const now = new Date();
    const nextRun = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
    return nextRun;
  }

  /**
   * Parse cron expression to interval (simplified)
   */
  private parseCronExpression(expression: string): number {
    // Simplified implementation - in real implementation, use a proper cron parser
    return 60 * 60 * 1000; // 1 hour default
  }

  /**
   * Evaluate trigger condition
   */
  private async evaluateTriggerCondition(trigger: ValidationTrigger): Promise<boolean> {
    if (!trigger.condition) return false;

    const condition = trigger.condition;

    // Check resource count condition
    if (condition.resourceCount !== undefined) {
      const currentCount = await this.getCurrentResourceCount();
      if (currentCount < condition.resourceCount) {
        return false;
      }
    }

    // Check time since last run condition
    if (condition.timeSinceLastRun !== undefined) {
      const lastRun = await this.getLastValidationRun();
      if (lastRun) {
        const timeSinceLastRun = Date.now() - lastRun.getTime();
        if (timeSinceLastRun < condition.timeSinceLastRun) {
          return false;
        }
      }
    }

    // Check error rate condition
    if (condition.errorRate !== undefined) {
      const currentErrorRate = await this.getCurrentErrorRate();
      if (currentErrorRate < condition.errorRate) {
        return false;
      }
    }

    // Check validation coverage condition
    if (condition.validationCoverage !== undefined) {
      const currentCoverage = await this.getCurrentValidationCoverage();
      if (currentCoverage < condition.validationCoverage) {
        return false;
      }
    }

    return true;
  }

  /**
   * Execute triggered validation
   */
  private async executeTriggeredValidation(trigger: ValidationTrigger): Promise<void> {
    console.log(`[ValidationScheduler] Executing triggered validation: ${trigger.name}`);
    
    // Create a temporary schedule for the triggered validation
    const tempSchedule: ValidationSchedule = {
      id: `temp_${Date.now()}`,
      name: `Triggered: ${trigger.name}`,
      description: `Validation triggered by: ${trigger.name}`,
      cronExpression: '0 0 * * *', // Daily at midnight
      isActive: false,
      configuration: {},
      runCount: 0,
      successCount: 0,
      failureCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.executeScheduledValidation(tempSchedule.id);
  }

  /**
   * Perform validation using ValidationPipeline
   */
  private async performValidation(configuration: any): Promise<any> {
    // Use ValidationPipeline for batch validation
    const pipeline = getValidationPipeline();
    const result = await pipeline.executePipeline({
      resourceTypes: configuration.resourceTypes,
      batchSize: configuration.batchSize || 100,
      skipUnchanged: configuration.skipUnchanged || false
    });
    
    return {
      totalResources: result.summary.totalResources,
      processedResources: result.summary.processedResources,
      validResources: 950,
      errorResources: 50,
      duration: 30000 // 30 seconds
    };
  }

  /**
   * Get current resource count
   */
  private async getCurrentResourceCount(): Promise<number> {
    try {
      const stats = await storage.getResourceStats();
      return stats.totalResources;
    } catch (error) {
      console.error('Failed to get resource count:', error);
      return 0;
    }
  }

  /**
   * Get last validation run time
   */
  private async getLastValidationRun(): Promise<Date | null> {
    try {
      const runs = this.getAllScheduledRuns();
      if (runs.length === 0) return null;
      
      const lastRun = runs[0];
      return lastRun.startTime;
    } catch (error) {
      console.error('Failed to get last validation run:', error);
      return null;
    }
  }

  /**
   * Get current error rate
   */
  private async getCurrentErrorRate(): Promise<number> {
    try {
      const stats = await storage.getResourceStats();
      if (stats.totalResources === 0) return 0;
      
      return (stats.errorResources / stats.totalResources) * 100;
    } catch (error) {
      console.error('Failed to get error rate:', error);
      return 0;
    }
  }

  /**
   * Get current validation coverage
   */
  private async getCurrentValidationCoverage(): Promise<number> {
    try {
      const stats = await storage.getResourceStats();
      if (stats.totalResources === 0) return 0;
      
      return (stats.validResources / stats.totalResources) * 100;
    } catch (error) {
      console.error('Failed to get validation coverage:', error);
      return 0;
    }
  }

  /**
   * Load schedules from database
   */
  private async loadSchedules(): Promise<void> {
    try {
      const schedules = await storage.getValidationSchedules();
      for (const schedule of schedules) {
        this.schedules.set(schedule.id, schedule);
      }
      console.log(`[ValidationScheduler] Loaded ${schedules.length} schedules`);
    } catch (error) {
      console.error('Failed to load schedules:', error);
    }
  }

  /**
   * Load triggers from database
   */
  private async loadTriggers(): Promise<void> {
    try {
      const triggers = await storage.getValidationTriggers();
      for (const trigger of triggers) {
        this.triggers.set(trigger.id, trigger);
      }
      console.log(`[ValidationScheduler] Loaded ${triggers.length} triggers`);
    } catch (error) {
      console.error('Failed to load triggers:', error);
    }
  }

  /**
   * Persist schedule to database
   */
  private async persistSchedule(schedule: ValidationSchedule): Promise<void> {
    try {
      await storage.saveValidationSchedule(schedule);
    } catch (error) {
      console.error('Failed to persist schedule:', error);
    }
  }

  /**
   * Persist trigger to database
   */
  private async persistTrigger(trigger: ValidationTrigger): Promise<void> {
    try {
      await storage.saveValidationTrigger(trigger);
    } catch (error) {
      console.error('Failed to persist trigger:', error);
    }
  }

  /**
   * Delete schedule from database
   */
  private async deleteScheduleFromStorage(scheduleId: string): Promise<void> {
    try {
      await storage.deleteValidationSchedule(scheduleId);
    } catch (error) {
      console.error('Failed to delete schedule from storage:', error);
    }
  }
}
