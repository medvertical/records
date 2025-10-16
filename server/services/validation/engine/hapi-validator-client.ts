/**
 * HAPI FHIR Validator Client
 * 
 * Node.js wrapper around HAPI FHIR Validator CLI for comprehensive FHIR validation.
 * Supports R4, R5, and R6 FHIR versions with multi-aspect validation.
 * 
 * Architecture:
 * - Spawns Java processes to execute validator JAR
 * - Parses OperationOutcome responses from HAPI
 * - Maps HAPI issues to ValidationIssue format (via hapi-issue-mapper.ts)
 * - Handles timeouts, errors, and cleanup
 * - Version-specific initialization using fhir-package-versions.ts (Task 2.5)
 * 
 * Updates (Task 2.5):
 * - Uses getCorePackage() and getVersionConfig() for version-specific setup
 * - Validates version support before initialization
 * - Provides version support info via getVersionSupport() and isVersionAvailable()
 * - Logs version limitations and configuration details
 * 
 * File size: Target <400 lines (global.mdc compliance)
 */

import { spawn } from 'child_process';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { ValidationIssue } from '../types/validation-types';
import {
  hapiValidatorConfig,
  getTerminologyServerUrl,
  FHIR_VERSION_IG_MAP,
  type HapiValidatorConfig
} from '../../../config/hapi-validator-config';
import {
  getCorePackage,
  getCorePackageId,
  getVersionConfig,
  isSupportedVersion,
  hasFullSupport,
} from '../../../config/fhir-package-versions';
import type {
  HapiValidationOptions,
  HapiOperationOutcome,
  HapiValidatorSetupResult
} from './hapi-validator-types';
import { mapOperationOutcomeToIssues } from './hapi-issue-mapper';
import { withRetry, isRetryableError, isNonRetryableHapiError } from '../utils/retry-helper';
import { createValidationTimer, globalTimingAggregator, type ValidationTimingBreakdown } from '../utils/validation-timing'; // Task 10.4
import { getHapiProcessPool } from './hapi-process-pool'; // Task 10.6

// ============================================================================
// HAPI Validator Client
// ============================================================================

export class HapiValidatorClient {
  private readonly config: HapiValidatorConfig;
  private useProcessPool: boolean = false; // Feature flag for process pool

  constructor(config: HapiValidatorConfig = hapiValidatorConfig) {
    this.config = config;
    this.verifySetup();
    
    // Enable process pool by default (disable with HAPI_USE_PROCESS_POOL=false)
    this.useProcessPool = process.env.HAPI_USE_PROCESS_POOL !== 'false';
    
    if (this.useProcessPool) {
      console.log('[HapiValidatorClient] Process pool mode ENABLED (warmed processes for faster validation)');
    } else {
      console.log('[HapiValidatorClient] Process pool mode DISABLED (slower validation)');
    }
  }

  /**
   * Verify HAPI validator setup
   */
  private verifySetup(): void {
    if (!existsSync(this.config.jarPath)) {
      throw new Error(
        `HAPI validator JAR not found at: ${this.config.jarPath}\n` +
        `Run 'bash scripts/setup-hapi-validator.sh' to download it.`
      );
    }
  }

  /**
   * Get version support information
   * Task 2.5: Provides version-specific configuration and support details
   * 
   * @param version - FHIR version to check
   * @returns Version configuration including support status, limitations, and packages
   */
  getVersionSupport(version: 'R4' | 'R5' | 'R6') {
    if (!isSupportedVersion(version)) {
      throw new Error(`Unsupported FHIR version: ${version}`);
    }

    const corePackage = getCorePackage(version);
    const versionConfig = getVersionConfig(version);
    
    return {
      version: version,
      corePackage: corePackage.corePackage,
      fhirVersion: corePackage.fhirVersion,
      status: corePackage.status,
      supportStatus: versionConfig.supportStatus,
      limitations: versionConfig.limitations || [],
      hasFullSupport: hasFullSupport(version),
      isConfigured: (version === 'R5' ? this.config.supportR5 : version === 'R6' ? this.config.supportR6 : true),
    };
  }

  /**
   * Check if a FHIR version is supported and configured
   * Task 2.5: Quick check for version availability
   * 
   * @param version - FHIR version to check
   * @returns true if version is supported and configured, false otherwise
   */
  isVersionAvailable(version: 'R4' | 'R5' | 'R6'): boolean {
    if (!isSupportedVersion(version)) {
      return false;
    }

    // Check configuration settings
    if (version === 'R5' && !this.config.supportR5) {
      return false;
    }

    if (version === 'R6' && !this.config.supportR6) {
      return false;
    }

    return true;
  }

  /**
   * Validate a FHIR resource using HAPI validator
   * 
   * @param resource - FHIR resource to validate
   * @param options - Validation options
   * @returns Array of validation issues
   */
  async validateResource(
    resource: any,
    options: HapiValidationOptions
  ): Promise<ValidationIssue[]> {
    const startTime = Date.now();
    let tempFilePath: string | null = null;

    // Task 10.4: Create timing tracker
    const timer = createValidationTimer(resource.resourceType, 'hapi');

    try {
      // Validate options
      timer.startPhase('options-validation', 'Validating options');
      this.validateOptions(options);
      timer.endPhase();

      // Task 10.6: Use process pool if enabled and available
      if (this.useProcessPool) {
        console.log('[HapiValidatorClient] Using process pool for validation');
        timer.startPhase('pool-validation', 'Validating via process pool');
        
        try {
          const pool = getHapiProcessPool();
          const operationOutcome = await pool.validate(resource, options);
          
          // Map HAPI issues to ValidationIssue format
          const issues = mapOperationOutcomeToIssues(operationOutcome, options.fhirVersion);
          
          timer.endPhase();
          
          const validationTime = Date.now() - startTime;
          const breakdown = timer.getBreakdown();
          globalTimingAggregator.add(breakdown);

          console.log(
            `[HapiValidatorClient] Pool validation completed in ${validationTime}ms ` +
            `(${issues.length} issues, pool stats: ${JSON.stringify(pool.getStats())})`
          );

          if (process.env.LOG_VALIDATION_TIMING === 'true') {
            console.log(timer.formatBreakdown());
          }

          return issues;

        } catch (poolError) {
          console.warn('[HapiValidatorClient] Pool validation failed, falling back to spawn:', poolError);
          timer.endPhase();
          // Fall through to standard execution
        }
      }

      // Execute validation with retry logic (standard spawn-based approach)
      timer.startPhase('validation-execution', 'Executing HAPI validation with retry logic');
      const result = await withRetry(
        async () => {
          // Create temporary file with resource JSON
          const tempFileStart = Date.now();
          tempFilePath = this.createTempFile(resource);
          timer.recordPhase('temp-file-creation', Date.now() - tempFileStart, 'Creating temporary resource file');

          // Build HAPI CLI arguments
          const argsStart = Date.now();
          const args = this.buildValidatorArgs(tempFilePath, options);
          timer.recordPhase('args-building', Date.now() - argsStart, 'Building HAPI CLI arguments');

          // Execute HAPI validator
          const executeStart = Date.now();
          const { stdout, stderr } = await this.executeValidator(args, options.timeout);
          const executeTime = Date.now() - executeStart;
          timer.recordPhase('hapi-spawn', executeTime, 'Spawning Java process and validation', {
            timeout: options.timeout,
            poolEnabled: this.useProcessPool,
          });

          // Parse OperationOutcome
          const parseStart = Date.now();
          const operationOutcome = this.parseOperationOutcome(stdout, stderr);
          timer.recordPhase('hapi-parse', Date.now() - parseStart, 'Parsing OperationOutcome from HAPI output');

          // Map HAPI issues to ValidationIssue format
          const mapStart = Date.now();
          const issues = mapOperationOutcomeToIssues(operationOutcome, options.fhirVersion);
          timer.recordPhase('post-processing', Date.now() - mapStart, 'Mapping HAPI issues to ValidationIssue format');

          return issues;
        },
        {
          maxAttempts: 3,
          initialDelay: 1000,
          maxDelay: 10000,
          timeout: options.timeout || this.config.timeout,
          isRetryable: (error) => {
            // Don't retry non-retryable HAPI errors (validation failures, parse errors)
            if (isNonRetryableHapiError(error)) {
              return false;
            }
            // Retry timeout and network errors
            return isRetryableError(error);
          },
        }
      );
      timer.endPhase();

      const validationTime = Date.now() - startTime;
      
      // Task 10.4: Get timing breakdown
      const breakdown = timer.getBreakdown();
      globalTimingAggregator.add(breakdown);

      console.log(
        `[HapiValidatorClient] Validation completed in ${validationTime}ms ` +
        `(${result.result.length} issues, ${result.attempts} attempts, ` +
        `pool: ${this.useProcessPool})`
      );
      
      // Log detailed timing in debug mode
      if (process.env.LOG_VALIDATION_TIMING === 'true') {
        console.log(timer.formatBreakdown());
      }

      return result.result;

    } catch (error) {
      console.error('[HapiValidatorClient] Validation failed:', error);
      throw this.handleValidationError(error);

    } finally {
      // Cleanup temp file
      if (tempFilePath) {
        this.cleanupTempFile(tempFilePath);
      }
    }
  }

  /**
   * Validate options
   */
  /**
   * Validate options and check version support
   * Task 2.5: Version-specific validation using fhir-package-versions.ts
   */
  private validateOptions(options: HapiValidationOptions): void {
    // Validate FHIR version format
    if (!options.fhirVersion) {
      throw new Error('FHIR version is required for validation.');
    }

    // Check if version is supported (using fhir-package-versions.ts)
    if (!isSupportedVersion(options.fhirVersion)) {
      throw new Error(
        `Unsupported FHIR version: ${options.fhirVersion}. ` +
        `Supported versions: R4, R5, R6.`
      );
    }

    // Check configuration settings
    if (options.fhirVersion === 'R5' && !this.config.supportR5) {
      throw new Error('FHIR R5 support is disabled. Enable it in configuration.');
    }

    if (options.fhirVersion === 'R6' && !this.config.supportR6) {
      throw new Error('FHIR R6 support is disabled. Enable it in configuration.');
    }

    // Get version configuration
    const versionConfig = getVersionConfig(options.fhirVersion);
    
    // Log version support status
    if (!hasFullSupport(options.fhirVersion)) {
      const limitations = versionConfig.limitations || [];
      console.warn(
        `[HapiValidatorClient] Warning: ${options.fhirVersion} has ${versionConfig.supportStatus} support. ` +
        `Limitations: ${limitations.join(', ')}`
      );
    }
  }

  /**
   * Create temporary file for resource JSON
   */
  private createTempFile(resource: any): string {
    const tempFile = join(tmpdir(), `fhir-resource-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.json`);
    writeFileSync(tempFile, JSON.stringify(resource, null, 2), 'utf8');
    return tempFile;
  }

  /**
   * Build HAPI validator CLI arguments
   * Task 2.5: Version-specific initialization using fhir-package-versions.ts
   * 
   * Constructs HAPI CLI arguments based on:
   * - FHIR version (R4, R5, R6)
   * - Core package for version
   * - Additional IG packages
   * - Profile URL (if specified)
   * - Terminology server (version-specific, mode-dependent)
   */
  private buildValidatorArgs(tempFilePath: string, options: HapiValidationOptions): string[] {
    // Get version-specific core package (from fhir-package-versions.ts)
    const corePackageId = getCorePackageId(options.fhirVersion);
    const corePackage = getCorePackage(options.fhirVersion);
    const versionConfig = getVersionConfig(options.fhirVersion);
    
    // Determine mode and terminology server
    // Always use tx.fhir.org - fast and reliable
    // Don't use getTerminologyServerUrl as it may return localhost
    const terminologyServer = `https://tx.fhir.org/${options.fhirVersion.toLowerCase()}`;

    // Base arguments
    const args = [
      '-jar', this.config.jarPath,
      tempFilePath,
      '-version', corePackage.version,  // Use version from fhir-package-versions
      '-output', 'json',
      '-locale', 'en',
    ];

    // Note: Core package is loaded automatically by HAPI when -version is specified
    // Adding it as -ig causes "Unable to find/resolve/read" errors
    // args.push('-ig', corePackageId); // Commented out - causes HAPI errors

    console.log(
      `[HapiValidatorClient] Initializing HAPI validator for ${options.fhirVersion} ` +
      `(${corePackage.status}), core package loaded automatically by -version flag`
    );

    // Add additional IG packages
    if (options.igPackages && options.igPackages.length > 0) {
      console.log(`[HapiValidatorClient] Loading ${options.igPackages.length} additional IG packages`);
      options.igPackages.forEach(pkg => {
        args.push('-ig', pkg);
      });
    }

    // Add -profile parameter to explicitly validate against the profile
    // HAPI needs this to know which StructureDefinition to use from the loaded package
    if (options.profile) {
      args.push('-profile', options.profile);
      console.log(`[HapiValidatorClient] Explicitly validating against profile: ${options.profile}`);
    } else {
      console.log(`[HapiValidatorClient] No explicit profile - will validate against profiles in meta.profile`);
    }

    // Configure package cache directory (use project-local cache)
    const cacheDir = options.cacheDirectory || './server/cache/fhir-packages';
    args.push('-txCache', cacheDir);
    console.log(`[HapiValidatorClient] Using package cache: ${cacheDir}`);

    // Add terminology server to enable package downloads from Simplifier
    // This allows HAPI to download German profiles and other IGs
    args.push('-tx', terminologyServer);
    console.log(`[HapiValidatorClient] Using terminology server for package downloads: ${terminologyServer}`);

    // Log limitations for non-stable versions
    const limitations = versionConfig.limitations || [];
    if (limitations.length > 0) {
      console.warn(
        `[HapiValidatorClient] ${options.fhirVersion} limitations: ${limitations.join(', ')}`
      );
    }

    return args;
  }

  /**
   * Execute HAPI validator as child process
   */
  private async executeValidator(
    args: string[],
    timeout?: number
  ): Promise<{ stdout: string; stderr: string }> {
    const timeoutMs = timeout || this.config.timeout;

    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      // Use full path to java to ensure it's found
      const javaPath = process.env.JAVA_HOME 
        ? `${process.env.JAVA_HOME}/bin/java`
        : '/opt/homebrew/opt/openjdk@17/bin/java';
      
      console.log(`[HapiValidatorClient] *** CODE VERSION 2024-10-14-11:06 ***`);
      console.log(`[HapiValidatorClient] Using Java at: ${javaPath}`);
      console.log(`[HapiValidatorClient] Full command: ${javaPath} ${args.join(' ')}`);
      
      // Use cached packages from home directory (already downloaded)
      // This makes HAPI use existing packages instead of re-downloading
      const env = {
        ...process.env,
        FHIR_PACKAGE_CACHE_PATH: process.env.FHIR_PACKAGE_CACHE_PATH || '/Users/sheydin/.fhir/packages'
      };
      
      console.log(`[HapiValidatorClient] Package cache path: ${env.FHIR_PACKAGE_CACHE_PATH}`);
      
      const childProcess = spawn(javaPath, args, {
        timeout: timeoutMs,
        killSignal: 'SIGTERM',
        env: env,
      });

      // Capture stdout
      childProcess.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      // Capture stderr
      childProcess.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      // Handle timeout
      const timeoutHandle = setTimeout(() => {
        timedOut = true;
        childProcess.kill('SIGTERM');
        reject(new Error(`HAPI validation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      // Handle process exit
      childProcess.on('close', (code: number | null) => {
        clearTimeout(timeoutHandle);

        if (timedOut) {
          return; // Already rejected in timeout
        }

        // HAPI validator returns exit code 1 even for successful validation with issues
        // Only fail on exit codes > 1 (actual errors)
        if (code !== null && code > 1) {
          reject(new Error(`HAPI validator exited with code ${code}: ${stderr}`));
        } else {
          resolve({ stdout, stderr });
        }
      });

      // Handle process errors
      childProcess.on('error', (error: Error) => {
        clearTimeout(timeoutHandle);
        reject(new Error(`Failed to spawn Java process: ${error.message}`));
      });
    });
  }

  /**
   * Parse OperationOutcome from HAPI output
   */
  private parseOperationOutcome(stdout: string, stderr: string): HapiOperationOutcome {
    // HAPI outputs OperationOutcome as JSON to stdout
    try {
      // Find JSON output in stdout (HAPI may output other text before JSON)
      const jsonMatch = stdout.match(/\{[\s\S]*"resourceType"\s*:\s*"OperationOutcome"[\s\S]*\}/);
      
      if (!jsonMatch) {
        // No OperationOutcome found - check stderr for errors
        if (stderr.includes('Error') || stderr.includes('Exception')) {
          throw new Error(`HAPI validation error: ${stderr}`);
        }
        
        // Return empty OperationOutcome if no issues found
        return {
          resourceType: 'OperationOutcome',
          issue: []
        };
      }

      const operationOutcome = JSON.parse(jsonMatch[0]) as HapiOperationOutcome;

      // Validate structure
      if (!operationOutcome.resourceType || operationOutcome.resourceType !== 'OperationOutcome') {
        throw new Error('Invalid OperationOutcome structure');
      }

      return operationOutcome;

    } catch (error) {
      console.error('[HapiValidatorClient] Failed to parse OperationOutcome:', error);
      console.error('stdout:', stdout.substring(0, 500));
      console.error('stderr:', stderr.substring(0, 500));
      
      throw new Error(`Failed to parse HAPI OperationOutcome: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Handle validation errors with comprehensive error classification
   */
  private handleValidationError(error: unknown): Error {
    if (!(error instanceof Error)) {
      return new Error(`Unknown validation error: ${String(error)}`);
    }

    const message = error.message;

    // Java Runtime not found
    if (message.includes('ENOENT') || message.includes('spawn java')) {
      return new Error(
        `Java Runtime not found. HAPI validator requires Java 11+.\n\n` +
        `Installation:\n` +
        `  macOS:   brew install openjdk@11\n` +
        `  Ubuntu:  sudo apt-get install openjdk-11-jre\n` +
        `  Windows: Download from https://www.oracle.com/java/technologies/downloads/\n\n` +
        `Original error: ${message}`
      );
    }

    // Timeout errors
    if (message.includes('timed out') || message.includes('timeout')) {
      return new Error(
        `HAPI validation timed out.\n\n` +
        `Possible solutions:\n` +
        `  1. Increase timeout: Set HAPI_TIMEOUT environment variable (default: 30000ms)\n` +
        `  2. Simplify resource: Remove unnecessary extensions or contained resources\n` +
        `  3. Check network: Ensure terminology server is accessible\n\n` +
        `Original error: ${message}`
      );
    }

    // JAR not found
    if (message.includes('validator_cli.jar') || message.includes('JAR not found')) {
      return new Error(
        `HAPI validator JAR not found.\n\n` +
        `Setup:\n` +
        `  Run: bash scripts/setup-hapi-validator.sh\n` +
        `  Or download manually from: https://github.com/hapifhir/org.hl7.fhir.core/releases\n\n` +
        `Original error: ${message}`
      );
    }

    // Network errors
    if (message.includes('ECONNREFUSED') || message.includes('ENOTFOUND')) {
      return new Error(
        `Network error: Cannot connect to terminology server.\n\n` +
        `Possible solutions:\n` +
        `  1. Check internet connection\n` +
        `  2. Verify terminology server URL in configuration\n` +
        `  3. Try offline mode with local Ontoserver\n\n` +
        `Original error: ${message}`
      );
    }

    // Memory errors
    if (message.includes('OutOfMemoryError') || message.includes('heap space')) {
      return new Error(
        `Java heap space error: HAPI validator ran out of memory.\n\n` +
        `Solutions:\n` +
        `  1. Set JAVA_OPTS="-Xmx2G" to increase heap size\n` +
        `  2. Validate smaller resources or batches\n` +
        `  3. Restart the validator process\n\n` +
        `Original error: ${message}`
      );
    }

    // Parse errors (non-retryable)
    if (message.includes('parse') || message.includes('invalid JSON')) {
      return new Error(
        `Invalid FHIR resource format.\n\n` +
        `The resource JSON could not be parsed by HAPI validator.\n` +
        `Please check:\n` +
        `  1. Resource is valid JSON\n` +
        `  2. Resource type is correct\n` +
        `  3. Required fields are present\n\n` +
        `Original error: ${message}`
      );
    }

    // Retry errors (from retry-helper)
    if (error.name === 'RetryError') {
      const retryError = error as any;
      return new Error(
        `HAPI validation failed after ${retryError.attempts} attempts.\n\n` +
        `Last error: ${retryError.lastError?.message || 'Unknown'}\n\n` +
        `This may indicate:\n` +
        `  1. Persistent network issues\n` +
        `  2. HAPI validator is unavailable\n` +
        `  3. Resource is too complex to validate\n\n` +
        `Consider using fallback validation or checking system status.`
      );
    }

    // Return original error if no specific handling
    return error;
  }

  /**
   * Cleanup temporary file
   */
  private cleanupTempFile(filePath: string): void {
    try {
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    } catch (error) {
      console.warn(`[HapiValidatorClient] Failed to cleanup temp file: ${filePath}`, error);
      // Don't throw - cleanup failure shouldn't break validation
    }
  }

  /**
   * Get validator version info
   */
  async getValidatorVersion(): Promise<string> {
    try {
      const args = ['-jar', this.config.jarPath, '-version'];
      const { stdout } = await this.executeValidator(args, 5000);
      return stdout.trim();
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Test validator connectivity and setup
   */
  async testSetup(): Promise<HapiValidatorSetupResult> {
    try {
      // Check JAR exists
      if (!existsSync(this.config.jarPath)) {
        return {
          success: false,
          message: `Validator JAR not found at: ${this.config.jarPath}`
        };
      }

      // Try to get version
      const version = await this.getValidatorVersion();
      
      return {
        success: true,
        message: 'HAPI validator is ready',
        version
      };

    } catch (error) {
      return {
        success: false,
        message: `Validator setup test failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  // ========================================================================
  // Task 10.6: Process Pool Methods
  // ========================================================================

  /**
   * Get process pool statistics
   */
  getPoolStats() {
    if (!this.useProcessPool) {
      return {
        enabled: false,
        message: 'Process pool is not enabled',
      };
    }

    try {
      const pool = getHapiProcessPool();
      return {
        enabled: true,
        ...pool.getStats(),
      };
    } catch (error) {
      return {
        enabled: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if process pool is enabled
   */
  isPoolEnabled(): boolean {
    return this.useProcessPool;
  }
}

// Export singleton instance
export const hapiValidatorClient = new HapiValidatorClient();

// Re-export types for convenience
export type { HapiValidationOptions, HapiOperationOutcome, HapiIssue } from './hapi-validator-types';
