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
import type {
  HapiValidationOptions,
  HapiOperationOutcome,
  HapiValidatorSetupResult
} from './hapi-validator-types';
import { mapOperationOutcomeToIssues } from './hapi-issue-mapper';
import { withRetry, isRetryableError, isNonRetryableHapiError } from '../utils/retry-helper';

// ============================================================================
// HAPI Validator Client
// ============================================================================

export class HapiValidatorClient {
  private readonly config: HapiValidatorConfig;

  constructor(config: HapiValidatorConfig = hapiValidatorConfig) {
    this.config = config;
    this.verifySetup();
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

    try {
      // Validate options
      this.validateOptions(options);

      // Execute validation with retry logic
      const result = await withRetry(
        async () => {
          // Create temporary file with resource JSON
          tempFilePath = this.createTempFile(resource);

          // Build HAPI CLI arguments
          const args = this.buildValidatorArgs(tempFilePath, options);

          // Execute HAPI validator
          const { stdout, stderr } = await this.executeValidator(args, options.timeout);

          // Parse OperationOutcome
          const operationOutcome = this.parseOperationOutcome(stdout, stderr);

          // Map HAPI issues to ValidationIssue format
          return mapOperationOutcomeToIssues(operationOutcome, options.fhirVersion);
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

      const validationTime = Date.now() - startTime;
      console.log(
        `[HapiValidatorClient] Validation completed in ${validationTime}ms ` +
        `(${result.result.length} issues, ${result.attempts} attempts)`
      );

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
  private validateOptions(options: HapiValidationOptions): void {
    if (!options.fhirVersion || !['R4', 'R5', 'R6'].includes(options.fhirVersion)) {
      throw new Error(`Invalid FHIR version: ${options.fhirVersion}. Must be R4, R5, or R6.`);
    }

    if (options.fhirVersion === 'R5' && !this.config.supportR5) {
      throw new Error('FHIR R5 support is disabled. Enable it in configuration.');
    }

    if (options.fhirVersion === 'R6' && !this.config.supportR6) {
      throw new Error('FHIR R6 support is disabled. Enable it in configuration.');
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
   */
  private buildValidatorArgs(tempFilePath: string, options: HapiValidationOptions): string[] {
    const versionInfo = FHIR_VERSION_IG_MAP[options.fhirVersion];
    const mode = options.mode || 'online';
    const terminologyServer = options.terminologyServer || getTerminologyServerUrl(options.fhirVersion, mode, this.config);

    const args = [
      '-jar', this.config.jarPath,
      tempFilePath,
      '-version', versionInfo.version,
      '-output', 'json',
      '-locale', 'en',
    ];

    // Add core IG package
    args.push('-ig', versionInfo.corePackage);

    // Add additional IG packages
    if (options.igPackages && options.igPackages.length > 0) {
      options.igPackages.forEach(pkg => {
        args.push('-ig', pkg);
      });
    }

    // Add profile URL if specified
    if (options.profile) {
      args.push('-profile', options.profile);
    }

    // Add terminology server
    args.push('-tx', terminologyServer);

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

      const process = spawn('java', args, {
        timeout: timeoutMs,
        killSignal: 'SIGTERM',
      });

      // Capture stdout
      process.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      // Capture stderr
      process.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      // Handle timeout
      const timeoutHandle = setTimeout(() => {
        timedOut = true;
        process.kill('SIGTERM');
        reject(new Error(`HAPI validation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      // Handle process exit
      process.on('close', (code: number | null) => {
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
      process.on('error', (error: Error) => {
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
}

// Export singleton instance
export const hapiValidatorClient = new HapiValidatorClient();

// Re-export types for convenience
export type { HapiValidationOptions, HapiOperationOutcome, HapiIssue } from './hapi-validator-types';
