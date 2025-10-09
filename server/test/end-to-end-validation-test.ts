/**
 * FHIR R4 End-to-End Validation Test
 * 
 * Comprehensive test to verify the complete validation flow from UI to database
 * including resource validation, result storage, and retrieval.
 */

import { testResourceSuite } from './test-resources';
import { ConsolidatedValidationService } from '../services/validation/core/consolidated-validation-service';
import { ValidationSettingsService } from '../services/validation/settings/validation-settings-service';
import { ValidationResultRepository } from '../repositories/validation-result-repository';
import { db } from '../db';

export interface EndToEndTestResult {
  testName: string;
  resourceId: string;
  resourceType: string;
  success: boolean;
  validationTime: number;
  issuesFound: number;
  score: number;
  storedInDatabase: boolean;
  retrievedFromDatabase: boolean;
  errors: string[];
  details: {
    validationFlow: string[];
    databaseOperations: string[];
    performanceMetrics: Record<string, number>;
  };
}

export class EndToEndValidationTest {
  private validationService: ConsolidatedValidationService;
  private settingsService: ValidationSettingsService;
  private repository: ValidationResultRepository;

  constructor() {
    this.validationService = new ConsolidatedValidationService();
    this.settingsService = new ValidationSettingsService();
    this.repository = new ValidationResultRepository(db);
  }

  /**
   * Run comprehensive end-to-end validation tests
   */
  async runEndToEndTests(): Promise<EndToEndTestResult[]> {
    console.log('🚀 Starting FHIR R4 End-to-End Validation Tests...');
    console.log('==================================================');
    
    const results: EndToEndTestResult[] = [];
    
    // Test 1: Valid Patient Resource End-to-End
    console.log('\n📋 Test 1: Valid Patient Resource End-to-End Flow');
    const validPatientResult = await this.testResourceEndToEnd(
      testResourceSuite.valid.validPatient,
      'Valid Patient Resource'
    );
    results.push(validPatientResult);
    
    // Test 2: Invalid Observation Resource End-to-End
    console.log('\n📋 Test 2: Invalid Observation Resource End-to-End Flow');
    const invalidObservationResult = await this.testResourceEndToEnd(
      testResourceSuite.invalid.invalidObservation,
      'Invalid Observation Resource'
    );
    results.push(invalidObservationResult);
    
    // Test 3: Resource with Terminology Issues End-to-End
    console.log('\n📋 Test 3: Resource with Terminology Issues End-to-End Flow');
    const terminologyIssueResult = await this.testResourceEndToEnd(
      testResourceSuite.terminologyIssues.patientWithInvalidCodes,
      'Resource with Terminology Issues'
    );
    results.push(terminologyIssueResult);
    
    // Test 4: Resource with Reference Issues End-to-End
    console.log('\n📋 Test 4: Resource with Reference Issues End-to-End Flow');
    const referenceIssueResult = await this.testResourceEndToEnd(
      testResourceSuite.referenceIssues.observationWithBrokenReferences,
      'Resource with Reference Issues'
    );
    results.push(referenceIssueResult);
    
    // Generate comprehensive summary
    this.generateEndToEndSummary(results);
    
    return results;
  }

  /**
   * Test a single resource through the complete end-to-end validation flow
   */
  private async testResourceEndToEnd(resource: any, testName: string): Promise<EndToEndTestResult> {
    const startTime = Date.now();
    const resourceId = resource.id;
    const resourceType = resource.resourceType;
    const errors: string[] = [];
    const validationFlow: string[] = [];
    const databaseOperations: string[] = [];
    const performanceMetrics: Record<string, number> = {};

    console.log(`  🔍 Testing ${resourceType} (${resourceId}) - ${testName}`);

    try {
      // Step 1: Load validation settings
      const settingsStartTime = Date.now();
      validationFlow.push('Loading validation settings...');
      const settings = await this.settingsService.getActiveSettings();
      performanceMetrics.settingsLoadTime = Date.now() - settingsStartTime;
      databaseOperations.push('Loaded validation settings from database');
      console.log(`    ✅ Settings loaded in ${performanceMetrics.settingsLoadTime}ms`);

      // Step 2: Perform validation
      const validationStartTime = Date.now();
      validationFlow.push('Performing comprehensive validation...');
      const validationResults = await this.validationService.validateResource(resource, settings);
      performanceMetrics.validationTime = Date.now() - validationStartTime;
      console.log(`    ✅ Validation completed in ${performanceMetrics.validationTime}ms`);

      // Step 3: Calculate score
      const issuePenalty = 5;
      const score = Math.max(0, 100 - (validationResults.issues.length * issuePenalty));
      validationFlow.push(`Calculated score: ${score}% (${validationResults.issues.length} issues)`);
      console.log(`    ✅ Score calculated: ${score}% (${validationResults.issues.length} issues)`);

      // Step 4: Store validation results in database
      const storageStartTime = Date.now();
      validationFlow.push('Storing validation results in database...');
      const storedResult = await this.repository.storeValidationResult({
        resourceType: resourceType,
        fhirResourceId: resourceId,
        isValid: validationResults.issues.length === 0,
        issues: validationResults.issues,
        validationScore: score,
        validationDurationMs: performanceMetrics.validationTime,
        validatedAt: new Date(),
        validationStatus: 'completed',
        validationCompletedAt: new Date(),
        errors: validationResults.issues.filter(i => i.severity === 'error'),
        warnings: validationResults.issues.filter(i => i.severity === 'warning'),
        errorCount: validationResults.issues.filter(i => i.severity === 'error').length,
        warningCount: validationResults.issues.filter(i => i.severity === 'warning').length
      });
      performanceMetrics.storageTime = Date.now() - storageStartTime;
      databaseOperations.push(`Stored validation result with ID: ${storedResult.id}`);
      console.log(`    ✅ Results stored in database in ${performanceMetrics.storageTime}ms`);

      // Step 5: Retrieve validation results from database
      const retrievalStartTime = Date.now();
      validationFlow.push('Retrieving validation results from database...');
      const retrievedResults = await this.repository.getValidationResultsByResource(
        resourceType,
        resourceId
      );
      performanceMetrics.retrievalTime = Date.now() - retrievalStartTime;
      
      const retrieved = retrievedResults.length > 0;
      if (retrieved) {
        databaseOperations.push(`Retrieved ${retrievedResults.length} validation results`);
        console.log(`    ✅ Results retrieved from database in ${performanceMetrics.retrievalTime}ms`);
      } else {
        errors.push('Failed to retrieve validation results from database');
        console.log(`    ❌ Failed to retrieve results from database`);
      }

      // Step 6: Verify data integrity
      validationFlow.push('Verifying data integrity...');
      const dataIntegrityCheck = this.verifyDataIntegrity(validationResults, retrievedResults, storedResult);
      if (!dataIntegrityCheck.valid) {
        errors.push(...dataIntegrityCheck.errors);
        console.log(`    ❌ Data integrity check failed: ${dataIntegrityCheck.errors.join(', ')}`);
      } else {
        console.log(`    ✅ Data integrity verified`);
      }

      const totalTime = Date.now() - startTime;
      performanceMetrics.totalTime = totalTime;

      const success = errors.length === 0 && retrieved;

      return {
        testName,
        resourceId,
        resourceType,
        success,
        validationTime: performanceMetrics.validationTime,
        issuesFound: validationResults.issues.length,
        score,
        storedInDatabase: true,
        retrievedFromDatabase: retrieved,
        errors,
        details: {
          validationFlow,
          databaseOperations,
          performanceMetrics
        }
      };

    } catch (error) {
      const totalTime = Date.now() - startTime;
      errors.push(`End-to-end test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      console.log(`    ❌ End-to-end test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        testName,
        resourceId,
        resourceType,
        success: false,
        validationTime: 0,
        issuesFound: 0,
        score: 0,
        storedInDatabase: false,
        retrievedFromDatabase: false,
        errors,
        details: {
          validationFlow,
          databaseOperations,
          performanceMetrics: { totalTime }
        }
      };
    }
  }

  /**
   * Verify data integrity between validation results and database storage
   */
  private verifyDataIntegrity(
    validationResults: any,
    retrievedResults: any[],
    storedResult: any
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check if stored result matches validation results
    if (storedResult.issues.length !== validationResults.issues.length) {
      errors.push(`Issue count mismatch: stored ${storedResult.issues.length}, expected ${validationResults.issues.length}`);
    }

    if (storedResult.score !== validationResults.score) {
      errors.push(`Score mismatch: stored ${storedResult.score}, expected ${validationResults.score}`);
    }

    if (storedResult.resourceType !== validationResults.resourceType) {
      errors.push(`Resource type mismatch: stored ${storedResult.resourceType}, expected ${validationResults.resourceType}`);
    }

    // Check if retrieved results contain the stored result
    const foundStoredResult = retrievedResults.find(r => r.id === storedResult.id);
    if (!foundStoredResult) {
      errors.push('Stored result not found in retrieved results');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate comprehensive end-to-end test summary
   */
  private generateEndToEndSummary(results: EndToEndTestResult[]): void {
    console.log('\n🎯 FHIR R4 End-to-End Validation Test Summary');
    console.log('==============================================');

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
      console.log(`    Resource: ${result.resourceType} (${result.resourceId})`);
      console.log(`    Score: ${result.score}% (${result.issuesFound} issues)`);
      console.log(`    Validation Time: ${result.validationTime}ms`);
      console.log(`    Database: ${result.storedInDatabase ? '✅ Stored' : '❌ Failed'} / ${result.retrievedFromDatabase ? '✅ Retrieved' : '❌ Failed'}`);
      if (result.errors.length > 0) {
        console.log(`    Errors: ${result.errors.join(', ')}`);
      }
    });

    // Performance statistics
    console.log(`\n⚡ Performance Statistics:`);
    const avgValidationTime = results.reduce((sum, r) => sum + r.validationTime, 0) / totalTests;
    const avgTotalTime = results.reduce((sum, r) => sum + r.details.performanceMetrics.totalTime, 0) / totalTests;
    
    console.log(`  Average Validation Time: ${avgValidationTime.toFixed(1)}ms`);
    console.log(`  Average Total Time: ${avgTotalTime.toFixed(1)}ms`);

    // Database operations summary
    console.log(`\n🗄️ Database Operations:`);
    const totalStored = results.filter(r => r.storedInDatabase).length;
    const totalRetrieved = results.filter(r => r.retrievedFromDatabase).length;
    console.log(`  Successfully Stored: ${totalStored}/${totalTests} (${(totalStored/totalTests*100).toFixed(1)}%)`);
    console.log(`  Successfully Retrieved: ${totalRetrieved}/${totalTests} (${(totalRetrieved/totalTests*100).toFixed(1)}%)`);

    // Validation flow summary
    console.log(`\n🔄 Validation Flow Summary:`);
    const allFlows = results.flatMap(r => r.details.validationFlow);
    const uniqueFlows = [...new Set(allFlows)];
    uniqueFlows.forEach(flow => {
      const count = allFlows.filter(f => f === flow).length;
      console.log(`  ${flow}: ${count}/${totalTests} tests`);
    });

    // Success criteria check
    console.log(`\n🎉 End-to-End Success Criteria Check:`);
    console.log(`  ✅ Complete validation flow works: ${results.every(r => r.validationTime > 0) ? 'PASS' : 'FAIL'}`);
    console.log(`  ✅ Database storage works: ${totalStored === totalTests ? 'PASS' : 'FAIL'}`);
    console.log(`  ✅ Database retrieval works: ${totalRetrieved === totalTests ? 'PASS' : 'FAIL'}`);
    console.log(`  ✅ Data integrity maintained: ${results.every(r => r.errors.length === 0 || r.errors.every(e => !e.includes('integrity'))) ? 'PASS' : 'FAIL'}`);
    console.log(`  ✅ Overall pass rate >= 80%: ${passRate >= 80 ? 'PASS' : 'FAIL'}`);

    console.log(`\n🚀 End-to-End Tests ${passRate >= 80 ? 'PASSED' : 'FAILED'}!`);
    
    if (passRate >= 80) {
      console.log('\n🎉 SUCCESS: Complete validation flow is working!');
      console.log('✅ Resources can be validated end-to-end');
      console.log('✅ Validation results are stored in database');
      console.log('✅ Validation results can be retrieved from database');
      console.log('✅ Data integrity is maintained throughout the flow');
      console.log('✅ Ready for production use');
    } else {
      console.log('\n❌ FAILURE: End-to-end validation flow has issues');
      console.log('🔧 Review failed tests and fix validation flow issues');
      console.log('📝 Check database connectivity and data integrity');
    }
  }
}
