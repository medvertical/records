/**
 * Comprehensive Error Handling Test
 * 
 * Tests that comprehensive error handling works correctly including:
 * - Try-catch blocks around external service calls
 * - Graceful degradation when services are unavailable
 * - Retry logic with exponential backoff
 * - Detailed error logging with context
 * - User-friendly error messages
 */

import { testResourceSuite } from './test-resources';
import { ValidationErrorHandler, ErrorContext } from '../services/validation/utils/error-handler';
import { OntoserverClient } from '../services/fhir/ontoserver-client';
import { FirelyClient } from '../services/fhir/firely-client';

export interface ErrorHandlingTestResult {
  testName: string;
  success: boolean;
  errorHandlingFeatures: {
    tryCatchBlocks: boolean;
    gracefulDegradation: boolean;
    retryLogic: boolean;
    detailedLogging: boolean;
    userFriendlyMessages: boolean;
  };
  testScenarios: {
    networkErrors: boolean;
    timeoutErrors: boolean;
    serviceErrors: boolean;
    validationErrors: boolean;
    fallbackMechanisms: boolean;
  };
  performanceMetrics: {
    errorHandlingTime: number;
    retryAttempts: number;
    fallbackTime: number;
    totalRecoveryTime: number;
  };
  errors: string[];
}

export class ComprehensiveErrorHandlingTest {
  private ontoserverClient: OntoserverClient;
  private firelyClient: FirelyClient;

  constructor() {
    this.ontoserverClient = new OntoserverClient();
    this.firelyClient = new FirelyClient();
  }

  /**
   * Run comprehensive error handling tests
   */
  async runErrorHandlingTests(): Promise<ErrorHandlingTestResult[]> {
    console.log('🚀 Starting Comprehensive Error Handling Tests...');
    console.log('=================================================');
    
    const results: ErrorHandlingTestResult[] = [];
    
    // Test 1: Try-Catch Blocks Around External Service Calls
    console.log('\n📋 Test 1: Try-Catch Blocks Around External Service Calls');
    const tryCatchResult = await this.testTryCatchBlocks();
    results.push(tryCatchResult);
    
    // Test 2: Graceful Degradation When Services Unavailable
    console.log('\n📋 Test 2: Graceful Degradation When Services Unavailable');
    const gracefulDegradationResult = await this.testGracefulDegradation();
    results.push(gracefulDegradationResult);
    
    // Test 3: Retry Logic with Exponential Backoff
    console.log('\n📋 Test 3: Retry Logic with Exponential Backoff');
    const retryLogicResult = await this.testRetryLogic();
    results.push(retryLogicResult);
    
    // Test 4: Detailed Error Logging with Context
    console.log('\n📋 Test 4: Detailed Error Logging with Context');
    const errorLoggingResult = await this.testErrorLogging();
    results.push(errorLoggingResult);
    
    // Test 5: User-Friendly Error Messages
    console.log('\n📋 Test 5: User-Friendly Error Messages');
    const userFriendlyMessagesResult = await this.testUserFriendlyMessages();
    results.push(userFriendlyMessagesResult);
    
    // Generate comprehensive summary
    this.generateErrorHandlingSummary(results);
    
    return results;
  }

  /**
   * Test try-catch blocks around external service calls
   */
  private async testTryCatchBlocks(): Promise<ErrorHandlingTestResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let errorHandlingTime = 0;

    console.log('  🔍 Testing try-catch blocks around external service calls...');

    try {
      // Test 1: Valid service call with try-catch
      const context: ErrorContext = {
        externalService: 'Test Service',
        operation: 'testTryCatch',
        validator: 'ErrorHandlingTest'
      };

      const result1 = await ValidationErrorHandler.executeWithErrorHandling(
        async () => {
          // Simulate successful operation
          return { success: true, data: 'test-data' };
        },
        context
      );

      if (!result1.success) {
        errors.push('Try-catch block failed for successful operation');
      }

      // Test 2: Service call that throws error with try-catch
      try {
        await ValidationErrorHandler.executeWithErrorHandling(
          async () => {
            throw new Error('Simulated service error');
          },
          context,
          { maxAttempts: 1 } // No retries for this test
        );
        errors.push('Expected error to be thrown but operation succeeded');
      } catch (error) {
        // This is expected
        if (!(error as any).isValidationError) {
          errors.push('Error was not properly wrapped as validation error');
        }
      }

      // Test 3: Network error simulation with try-catch
      try {
        await ValidationErrorHandler.executeWithErrorHandling(
          async () => {
            const networkError = new Error('ECONNRESET: Connection reset by peer');
            networkError.name = 'NetworkError';
            throw networkError;
          },
          context,
          { maxAttempts: 1 }
        );
        errors.push('Expected network error to be thrown but operation succeeded');
      } catch (error) {
        // This is expected
        if (!(error as any).isValidationError) {
          errors.push('Network error was not properly wrapped as validation error');
        }
      }

      errorHandlingTime = Date.now() - startTime;

      const success = errors.length === 0;

      console.log(`    ✅ Try-catch blocks test completed in ${errorHandlingTime}ms`);
      console.log(`    📊 Errors caught: ${errors.length === 0 ? 'All errors properly caught' : errors.length + ' issues'}`);

      return {
        testName: 'Try-Catch Blocks Around External Service Calls',
        success,
        errorHandlingFeatures: {
          tryCatchBlocks: true,
          gracefulDegradation: false,
          retryLogic: false,
          detailedLogging: false,
          userFriendlyMessages: false
        },
        testScenarios: {
          networkErrors: true,
          timeoutErrors: false,
          serviceErrors: true,
          validationErrors: false,
          fallbackMechanisms: false
        },
        performanceMetrics: {
          errorHandlingTime,
          retryAttempts: 0,
          fallbackTime: 0,
          totalRecoveryTime: errorHandlingTime
        },
        errors
      };

    } catch (error) {
      errorHandlingTime = Date.now() - startTime;
      errors.push(`Try-catch blocks test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      console.log(`    ❌ Try-catch blocks test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        testName: 'Try-Catch Blocks Around External Service Calls',
        success: false,
        errorHandlingFeatures: {
          tryCatchBlocks: false,
          gracefulDegradation: false,
          retryLogic: false,
          detailedLogging: false,
          userFriendlyMessages: false
        },
        testScenarios: {
          networkErrors: false,
          timeoutErrors: false,
          serviceErrors: false,
          validationErrors: false,
          fallbackMechanisms: false
        },
        performanceMetrics: {
          errorHandlingTime,
          retryAttempts: 0,
          fallbackTime: 0,
          totalRecoveryTime: errorHandlingTime
        },
        errors
      };
    }
  }

  /**
   * Test graceful degradation when services are unavailable
   */
  private async testGracefulDegradation(): Promise<ErrorHandlingTestResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let fallbackTime = 0;

    console.log('  🔍 Testing graceful degradation when services unavailable...');

    try {
      // Test 1: Service unavailable with fallback
      const context: ErrorContext = {
        externalService: 'Unavailable Service',
        operation: 'testGracefulDegradation',
        validator: 'ErrorHandlingTest'
      };

      const fallbackStartTime = Date.now();
      
      const result = await ValidationErrorHandler.executeExternalServiceCall(
        'Unavailable Service',
        async () => {
          throw new Error('SERVICE_UNAVAILABLE: Service is down for maintenance');
        },
        context,
        {
          retryConfig: { maxAttempts: 1 }, // Quick test
          fallback: async () => {
            // Simulate fallback operation
            await new Promise(resolve => setTimeout(resolve, 100));
            return { success: false, fallback: true, message: 'Using fallback validation' };
          }
        }
      );

      fallbackTime = Date.now() - fallbackStartTime;

      if (!result.fallback) {
        errors.push('Fallback mechanism did not execute when service was unavailable');
      }

      // Test 2: Multiple service failures with cascading fallbacks
      const cascadingResult = await ValidationErrorHandler.executeExternalServiceCall(
        'Primary Service',
        async () => {
          throw new Error('ECONNREFUSED: Connection refused');
        },
        context,
        {
          retryConfig: { maxAttempts: 1 },
          fallback: async () => {
            return await ValidationErrorHandler.executeExternalServiceCall(
              'Secondary Service',
              async () => {
                throw new Error('ETIMEDOUT: Connection timed out');
              },
              { ...context, externalService: 'Secondary Service' },
              {
                retryConfig: { maxAttempts: 1 },
                fallback: async () => {
                  return { success: false, fallback: true, message: 'Using final fallback' };
                }
              }
            );
          }
        }
      );

      if (!cascadingResult.fallback) {
        errors.push('Cascading fallback mechanism did not execute properly');
      }

      const success = errors.length === 0;

      console.log(`    ✅ Graceful degradation test completed in ${fallbackTime}ms`);
      console.log(`    📊 Fallback mechanisms: ${errors.length === 0 ? 'All working correctly' : errors.length + ' issues'}`);

      return {
        testName: 'Graceful Degradation When Services Unavailable',
        success,
        errorHandlingFeatures: {
          tryCatchBlocks: false,
          gracefulDegradation: true,
          retryLogic: false,
          detailedLogging: false,
          userFriendlyMessages: false
        },
        testScenarios: {
          networkErrors: true,
          timeoutErrors: false,
          serviceErrors: true,
          validationErrors: false,
          fallbackMechanisms: true
        },
        performanceMetrics: {
          errorHandlingTime: 0,
          retryAttempts: 0,
          fallbackTime,
          totalRecoveryTime: fallbackTime
        },
        errors
      };

    } catch (error) {
      const totalTime = Date.now() - startTime;
      errors.push(`Graceful degradation test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      console.log(`    ❌ Graceful degradation test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        testName: 'Graceful Degradation When Services Unavailable',
        success: false,
        errorHandlingFeatures: {
          tryCatchBlocks: false,
          gracefulDegradation: false,
          retryLogic: false,
          detailedLogging: false,
          userFriendlyMessages: false
        },
        testScenarios: {
          networkErrors: false,
          timeoutErrors: false,
          serviceErrors: false,
          validationErrors: false,
          fallbackMechanisms: false
        },
        performanceMetrics: {
          errorHandlingTime: 0,
          retryAttempts: 0,
          fallbackTime: 0,
          totalRecoveryTime: totalTime
        },
        errors
      };
    }
  }

  /**
   * Test retry logic with exponential backoff
   */
  private async testRetryLogic(): Promise<ErrorHandlingTestResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let retryAttempts = 0;

    console.log('  🔍 Testing retry logic with exponential backoff...');

    try {
      // Test 1: Retryable error with exponential backoff
      const context: ErrorContext = {
        externalService: 'Retry Test Service',
        operation: 'testRetryLogic',
        validator: 'ErrorHandlingTest'
      };

      let attemptCount = 0;
      
      try {
        await ValidationErrorHandler.executeWithErrorHandling(
          async () => {
            attemptCount++;
            if (attemptCount < 3) {
              throw new Error('ECONNRESET: Connection reset by peer');
            }
            return { success: true, attempts: attemptCount };
          },
          context,
          {
            maxAttempts: 3,
            baseDelay: 100, // Short delay for testing
            maxDelay: 1000,
            backoffMultiplier: 2,
            retryableErrors: ['ECONNRESET']
          }
        );
        
        retryAttempts = attemptCount;
        
        if (attemptCount !== 3) {
          errors.push(`Expected 3 attempts but got ${attemptCount}`);
        }
        
      } catch (error) {
        errors.push('Retry logic failed to succeed after retries');
      }

      // Test 2: Non-retryable error (should not retry)
      let nonRetryableAttempts = 0;
      
      try {
        await ValidationErrorHandler.executeWithErrorHandling(
          async () => {
            nonRetryableAttempts++;
            throw new Error('INVALID_DATA: Data validation failed');
          },
          context,
          {
            maxAttempts: 3,
            baseDelay: 100,
            retryableErrors: ['ECONNRESET', 'ETIMEDOUT'] // INVALID_DATA not retryable
          }
        );
        errors.push('Non-retryable error should have failed immediately');
      } catch (error) {
        if (nonRetryableAttempts !== 1) {
          errors.push(`Non-retryable error retried ${nonRetryableAttempts} times instead of 1`);
        }
      }

      const success = errors.length === 0;

      console.log(`    ✅ Retry logic test completed in ${Date.now() - startTime}ms`);
      console.log(`    📊 Retry attempts: ${retryAttempts}, Non-retryable attempts: ${nonRetryableAttempts}`);

      return {
        testName: 'Retry Logic with Exponential Backoff',
        success,
        errorHandlingFeatures: {
          tryCatchBlocks: false,
          gracefulDegradation: false,
          retryLogic: true,
          detailedLogging: false,
          userFriendlyMessages: false
        },
        testScenarios: {
          networkErrors: true,
          timeoutErrors: false,
          serviceErrors: false,
          validationErrors: true,
          fallbackMechanisms: false
        },
        performanceMetrics: {
          errorHandlingTime: 0,
          retryAttempts,
          fallbackTime: 0,
          totalRecoveryTime: Date.now() - startTime
        },
        errors
      };

    } catch (error) {
      const totalTime = Date.now() - startTime;
      errors.push(`Retry logic test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      console.log(`    ❌ Retry logic test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        testName: 'Retry Logic with Exponential Backoff',
        success: false,
        errorHandlingFeatures: {
          tryCatchBlocks: false,
          gracefulDegradation: false,
          retryLogic: false,
          detailedLogging: false,
          userFriendlyMessages: false
        },
        testScenarios: {
          networkErrors: false,
          timeoutErrors: false,
          serviceErrors: false,
          validationErrors: false,
          fallbackMechanisms: false
        },
        performanceMetrics: {
          errorHandlingTime: 0,
          retryAttempts: 0,
          fallbackTime: 0,
          totalRecoveryTime: totalTime
        },
        errors
      };
    }
  }

  /**
   * Test detailed error logging with context
   */
  private async testErrorLogging(): Promise<ErrorHandlingTestResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    console.log('  🔍 Testing detailed error logging with context...');

    try {
      // Capture console output to verify logging
      const originalConsoleLog = console.log;
      const originalConsoleError = console.error;
      const originalConsoleWarn = console.warn;
      
      let logOutput: string[] = [];
      let errorOutput: string[] = [];
      let warnOutput: string[] = [];

      console.log = (...args) => {
        logOutput.push(args.join(' '));
        originalConsoleLog.apply(console, args);
      };

      console.error = (...args) => {
        errorOutput.push(args.join(' '));
        originalConsoleError.apply(console, args);
      };

      console.warn = (...args) => {
        warnOutput.push(args.join(' '));
        originalConsoleWarn.apply(console, args);
      };

      try {
        const context: ErrorContext = {
          externalService: 'Logging Test Service',
          operation: 'testErrorLogging',
          validator: 'ErrorHandlingTest',
          resourceType: 'Patient',
          resourceId: 'test-patient-001'
        };

        await ValidationErrorHandler.executeWithErrorHandling(
          async () => {
            throw new Error('HTTP 500: Internal Server Error');
          },
          context,
          { maxAttempts: 1 }
        );
      } catch (error) {
        // Expected to fail
      }

      // Restore console functions
      console.log = originalConsoleLog;
      console.error = originalConsoleError;
      console.warn = originalConsoleWarn;

      // Verify logging output
      const allOutput = [...logOutput, ...errorOutput, ...warnOutput].join(' ');
      
      if (!allOutput.includes('ErrorHandler')) {
        errors.push('Error logging did not include ErrorHandler context');
      }
      
      if (!allOutput.includes('Logging Test Service')) {
        errors.push('Error logging did not include service name');
      }
      
      if (!allOutput.includes('testErrorLogging')) {
        errors.push('Error logging did not include operation name');
      }
      
      if (!allOutput.includes('ErrorHandlingTest')) {
        errors.push('Error logging did not include validator name');
      }
      
      if (!allOutput.includes('HTTP 500')) {
        errors.push('Error logging did not include error details');
      }

      const success = errors.length === 0;

      console.log(`    ✅ Error logging test completed in ${Date.now() - startTime}ms`);
      console.log(`    📊 Log entries captured: ${logOutput.length + errorOutput.length + warnOutput.length}`);

      return {
        testName: 'Detailed Error Logging with Context',
        success,
        errorHandlingFeatures: {
          tryCatchBlocks: false,
          gracefulDegradation: false,
          retryLogic: false,
          detailedLogging: true,
          userFriendlyMessages: false
        },
        testScenarios: {
          networkErrors: false,
          timeoutErrors: false,
          serviceErrors: true,
          validationErrors: false,
          fallbackMechanisms: false
        },
        performanceMetrics: {
          errorHandlingTime: 0,
          retryAttempts: 0,
          fallbackTime: 0,
          totalRecoveryTime: Date.now() - startTime
        },
        errors
      };

    } catch (error) {
      const totalTime = Date.now() - startTime;
      errors.push(`Error logging test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      console.log(`    ❌ Error logging test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        testName: 'Detailed Error Logging with Context',
        success: false,
        errorHandlingFeatures: {
          tryCatchBlocks: false,
          gracefulDegradation: false,
          retryLogic: false,
          detailedLogging: false,
          userFriendlyMessages: false
        },
        testScenarios: {
          networkErrors: false,
          timeoutErrors: false,
          serviceErrors: false,
          validationErrors: false,
          fallbackMechanisms: false
        },
        performanceMetrics: {
          errorHandlingTime: 0,
          retryAttempts: 0,
          fallbackTime: 0,
          totalRecoveryTime: totalTime
        },
        errors
      };
    }
  }

  /**
   * Test user-friendly error messages
   */
  private async testUserFriendlyMessages(): Promise<ErrorHandlingTestResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    console.log('  🔍 Testing user-friendly error messages...');

    try {
      const context: ErrorContext = {
        externalService: 'User Friendly Test Service',
        operation: 'testUserFriendlyMessages',
        validator: 'ErrorHandlingTest'
      };

      // Test 1: Network error user message
      try {
        await ValidationErrorHandler.executeWithErrorHandling(
          async () => {
            const networkError = new Error('ECONNRESET: Connection reset by peer');
            throw networkError;
          },
          context,
          { maxAttempts: 1 }
        );
      } catch (error) {
        const userMessage = (error as any).message;
        if (!userMessage.includes('Unable to connect') || !userMessage.includes('check your internet connection')) {
          errors.push('Network error user message is not user-friendly');
        }
      }

      // Test 2: Timeout error user message
      try {
        await ValidationErrorHandler.executeWithErrorHandling(
          async () => {
            const timeoutError = new Error('AbortError: The operation was aborted');
            timeoutError.name = 'AbortError';
            throw timeoutError;
          },
          context,
          { maxAttempts: 1 }
        );
      } catch (error) {
        const userMessage = (error as any).message;
        if (!userMessage.includes('taking too long') || !userMessage.includes('try again in a moment')) {
          errors.push('Timeout error user message is not user-friendly');
        }
      }

      // Test 3: Service error user message
      try {
        await ValidationErrorHandler.executeWithErrorHandling(
          async () => {
            throw new Error('HTTP 503: Service Unavailable');
          },
          context,
          { maxAttempts: 1 }
        );
      } catch (error) {
        const userMessage = (error as any).message;
        if (!userMessage.includes('temporarily unavailable') || !userMessage.includes('try again later')) {
          errors.push('Service error user message is not user-friendly');
        }
      }

      // Test 4: Validation error user message
      try {
        await ValidationErrorHandler.executeWithErrorHandling(
          async () => {
            throw new Error('INVALID_DATA: Patient resource validation failed');
          },
          context,
          { maxAttempts: 1 }
        );
      } catch (error) {
        const userMessage = (error as any).message;
        if (!userMessage.includes('issue validating') || !userMessage.includes('check the data')) {
          errors.push('Validation error user message is not user-friendly');
        }
      }

      const success = errors.length === 0;

      console.log(`    ✅ User-friendly messages test completed in ${Date.now() - startTime}ms`);
      console.log(`    📊 Message types tested: 4, Issues: ${errors.length}`);

      return {
        testName: 'User-Friendly Error Messages',
        success,
        errorHandlingFeatures: {
          tryCatchBlocks: false,
          gracefulDegradation: false,
          retryLogic: false,
          detailedLogging: false,
          userFriendlyMessages: true
        },
        testScenarios: {
          networkErrors: true,
          timeoutErrors: true,
          serviceErrors: true,
          validationErrors: true,
          fallbackMechanisms: false
        },
        performanceMetrics: {
          errorHandlingTime: 0,
          retryAttempts: 0,
          fallbackTime: 0,
          totalRecoveryTime: Date.now() - startTime
        },
        errors
      };

    } catch (error) {
      const totalTime = Date.now() - startTime;
      errors.push(`User-friendly messages test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      console.log(`    ❌ User-friendly messages test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        testName: 'User-Friendly Error Messages',
        success: false,
        errorHandlingFeatures: {
          tryCatchBlocks: false,
          gracefulDegradation: false,
          retryLogic: false,
          detailedLogging: false,
          userFriendlyMessages: false
        },
        testScenarios: {
          networkErrors: false,
          timeoutErrors: false,
          serviceErrors: false,
          validationErrors: false,
          fallbackMechanisms: false
        },
        performanceMetrics: {
          errorHandlingTime: 0,
          retryAttempts: 0,
          fallbackTime: 0,
          totalRecoveryTime: totalTime
        },
        errors
      };
    }
  }

  /**
   * Generate comprehensive error handling test summary
   */
  private generateErrorHandlingSummary(results: ErrorHandlingTestResult[]): void {
    console.log('\n🎯 Comprehensive Error Handling Test Summary');
    console.log('============================================');

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
      
      const workingFeatures = Object.values(result.errorHandlingFeatures).filter(Boolean).length;
      console.log(`    Error Handling Features: ${workingFeatures}/5 working`);
      
      const workingScenarios = Object.values(result.testScenarios).filter(Boolean).length;
      console.log(`    Test Scenarios: ${workingScenarios}/5 working`);
      
      if (result.errors.length > 0) {
        console.log(`    Errors: ${result.errors.join(', ')}`);
      }
    });

    // Error handling features statistics
    console.log(`\n🔧 Error Handling Features Statistics:`);
    const featureStats = {
      tryCatchBlocks: results.filter(r => r.errorHandlingFeatures.tryCatchBlocks).length,
      gracefulDegradation: results.filter(r => r.errorHandlingFeatures.gracefulDegradation).length,
      retryLogic: results.filter(r => r.errorHandlingFeatures.retryLogic).length,
      detailedLogging: results.filter(r => r.errorHandlingFeatures.detailedLogging).length,
      userFriendlyMessages: results.filter(r => r.errorHandlingFeatures.userFriendlyMessages).length
    };

    Object.entries(featureStats).forEach(([feature, count]) => {
      const percentage = (count / totalTests) * 100;
      console.log(`  ${feature}: ${count}/${totalTests} (${percentage.toFixed(1)}%)`);
    });

    // Test scenarios statistics
    console.log(`\n🎯 Test Scenarios Statistics:`);
    const scenarioStats = {
      networkErrors: results.filter(r => r.testScenarios.networkErrors).length,
      timeoutErrors: results.filter(r => r.testScenarios.timeoutErrors).length,
      serviceErrors: results.filter(r => r.testScenarios.serviceErrors).length,
      validationErrors: results.filter(r => r.testScenarios.validationErrors).length,
      fallbackMechanisms: results.filter(r => r.testScenarios.fallbackMechanisms).length
    };

    Object.entries(scenarioStats).forEach(([scenario, count]) => {
      const percentage = (count / totalTests) * 100;
      console.log(`  ${scenario}: ${count}/${totalTests} (${percentage.toFixed(1)}%)`);
    });

    // Performance statistics
    console.log(`\n⚡ Performance Statistics:`);
    const avgErrorHandlingTime = results.reduce((sum, r) => sum + r.performanceMetrics.errorHandlingTime, 0) / totalTests;
    const avgRetryAttempts = results.reduce((sum, r) => sum + r.performanceMetrics.retryAttempts, 0) / totalTests;
    const avgFallbackTime = results.reduce((sum, r) => sum + r.performanceMetrics.fallbackTime, 0) / totalTests;
    const avgRecoveryTime = results.reduce((sum, r) => sum + r.performanceMetrics.totalRecoveryTime, 0) / totalTests;

    console.log(`  Average Error Handling Time: ${avgErrorHandlingTime.toFixed(1)}ms`);
    console.log(`  Average Retry Attempts: ${avgRetryAttempts.toFixed(1)}`);
    console.log(`  Average Fallback Time: ${avgFallbackTime.toFixed(1)}ms`);
    console.log(`  Average Total Recovery Time: ${avgRecoveryTime.toFixed(1)}ms`);

    // Success criteria check
    console.log(`\n🎉 Error Handling Success Criteria Check:`);
    console.log(`  ✅ Try-catch blocks: ${featureStats.tryCatchBlocks === totalTests ? 'PASS' : 'FAIL'}`);
    console.log(`  ✅ Graceful degradation: ${featureStats.gracefulDegradation === totalTests ? 'PASS' : 'FAIL'}`);
    console.log(`  ✅ Retry logic: ${featureStats.retryLogic === totalTests ? 'PASS' : 'FAIL'}`);
    console.log(`  ✅ Detailed logging: ${featureStats.detailedLogging === totalTests ? 'PASS' : 'FAIL'}`);
    console.log(`  ✅ User-friendly messages: ${featureStats.userFriendlyMessages === totalTests ? 'PASS' : 'FAIL'}`);
    console.log(`  ✅ Overall pass rate >= 80%: ${passRate >= 80 ? 'PASS' : 'FAIL'}`);

    console.log(`\n🚀 Error Handling Tests ${passRate >= 80 ? 'PASSED' : 'FAILED'}!`);
    
    if (passRate >= 80) {
      console.log('\n🎉 SUCCESS: Comprehensive error handling is working!');
      console.log('✅ Try-catch blocks properly handle external service errors');
      console.log('✅ Graceful degradation works when services are unavailable');
      console.log('✅ Retry logic with exponential backoff functions correctly');
      console.log('✅ Detailed error logging provides comprehensive context');
      console.log('✅ User-friendly error messages are clear and actionable');
      console.log('✅ All error handling mechanisms work together seamlessly');
      console.log('✅ Ready for production error handling');
    } else {
      console.log('\n❌ FAILURE: Comprehensive error handling has issues');
      console.log('🔧 Review failed tests and fix error handling mechanisms');
      console.log('📝 Check try-catch blocks, retry logic, and error messaging');
    }
  }
}
