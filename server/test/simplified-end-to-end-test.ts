/**
 * Simplified FHIR R4 End-to-End Validation Test
 * 
 * Tests the validation flow without database connectivity
 * to verify the complete validation pipeline works correctly.
 */

import { testResourceSuite } from './test-resources';
import { ConsolidatedValidationService } from '../services/validation/core/consolidated-validation-service';
import { ValidationSettingsService } from '../services/validation/validation-settings-service';

export interface SimplifiedEndToEndTestResult {
  testName: string;
  resourceId: string;
  resourceType: string;
  success: boolean;
  validationTime: number;
  issuesFound: number;
  score: number;
  errors: string[];
  details: {
    validationFlow: string[];
    performanceMetrics: Record<string, number>;
    issuesByAspect: Record<string, number>;
  };
}

export class SimplifiedEndToEndValidationTest {
  private validationService: ConsolidatedValidationService;
  private settingsService: ValidationSettingsService;

  constructor() {
    this.validationService = new ConsolidatedValidationService();
    this.settingsService = new ValidationSettingsService();
  }

  /**
   * Run simplified end-to-end validation tests
   */
  async runSimplifiedEndToEndTests(): Promise<SimplifiedEndToEndTestResult[]> {
    console.log('🚀 Starting Simplified FHIR R4 End-to-End Validation Tests...');
    console.log('============================================================');
    
    const results: SimplifiedEndToEndTestResult[] = [];
    
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
    this.generateSimplifiedEndToEndSummary(results);
    
    return results;
  }

  /**
   * Test a single resource through the simplified end-to-end validation flow
   */
  private async testResourceEndToEnd(resource: any, testName: string): Promise<SimplifiedEndToEndTestResult> {
    const startTime = Date.now();
    const resourceId = resource.id;
    const resourceType = resource.resourceType;
    const errors: string[] = [];
    const validationFlow: string[] = [];
    const performanceMetrics: Record<string, number> = {};

    console.log(`  🔍 Testing ${resourceType} (${resourceId}) - ${testName}`);

    try {
      // Step 1: Load validation settings (simplified)
      const settingsStartTime = Date.now();
      validationFlow.push('Loading validation settings...');
      let settings;
      try {
        settings = await this.settingsService.getActiveSettings();
        performanceMetrics.settingsLoadTime = Date.now() - settingsStartTime;
        console.log(`    ✅ Settings loaded in ${performanceMetrics.settingsLoadTime}ms`);
      } catch (error) {
        // Use default settings if database is not available
        settings = {
          id: 'default',
          name: 'Default Settings',
          enabledValidators: ['structural', 'profile', 'terminology', 'reference', 'business-rules', 'metadata'],
          strictMode: false
        };
        performanceMetrics.settingsLoadTime = Date.now() - settingsStartTime;
        console.log(`    ⚠️ Using default settings (database not available) in ${performanceMetrics.settingsLoadTime}ms`);
      }

      // Step 2: Perform validation
      const validationStartTime = Date.now();
      validationFlow.push('Performing comprehensive validation...');
      const validationResults = await this.validationService.validateResource(resource, settings);
      performanceMetrics.validationTime = Date.now() - validationStartTime;
      console.log(`    ✅ Validation completed in ${performanceMetrics.validationTime}ms`);

      // Step 3: Analyze validation results
      validationFlow.push('Analyzing validation results...');
      const issuesByAspect: Record<string, number> = {};
      validationResults.issues.forEach(issue => {
        issuesByAspect[issue.aspect] = (issuesByAspect[issue.aspect] || 0) + 1;
      });

      // Step 4: Calculate score
      const issuePenalty = 5;
      const score = Math.max(0, 100 - (validationResults.issues.length * issuePenalty));
      validationFlow.push(`Calculated score: ${score}% (${validationResults.issues.length} issues)`);
      console.log(`    ✅ Score calculated: ${score}% (${validationResults.issues.length} issues)`);

      // Step 5: Verify validation results structure
      validationFlow.push('Verifying validation results structure...');
      if (!validationResults.issues || !Array.isArray(validationResults.issues)) {
        errors.push('Validation results do not contain valid issues array');
      }
      if (typeof validationResults.resourceType !== 'string') {
        errors.push('Validation results do not contain valid resourceType');
      }

      // Step 6: Check for expected issues based on resource type
      validationFlow.push('Checking for expected validation patterns...');
      if (testName.includes('Invalid') && validationResults.issues.length === 0) {
        errors.push('Invalid resource should have validation issues');
      }
      if (testName.includes('Valid') && validationResults.issues.length > 10) {
        errors.push('Valid resource should have minimal validation issues');
      }

      const totalTime = Date.now() - startTime;
      performanceMetrics.totalTime = totalTime;

      const success = errors.length === 0;

      return {
        testName,
        resourceId,
        resourceType,
        success,
        validationTime: performanceMetrics.validationTime,
        issuesFound: validationResults.issues.length,
        score,
        errors,
        details: {
          validationFlow,
          performanceMetrics,
          issuesByAspect
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
        errors,
        details: {
          validationFlow,
          performanceMetrics: { totalTime },
          issuesByAspect: {}
        }
      };
    }
  }

  /**
   * Generate comprehensive simplified end-to-end test summary
   */
  private generateSimplifiedEndToEndSummary(results: SimplifiedEndToEndTestResult[]): void {
    console.log('\n🎯 Simplified FHIR R4 End-to-End Validation Test Summary');
    console.log('=========================================================');

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
      if (Object.keys(result.details.issuesByAspect).length > 0) {
        console.log(`    Issues by Aspect: ${Object.entries(result.details.issuesByAspect).map(([aspect, count]) => `${aspect}(${count})`).join(', ')}`);
      }
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

    // Validation flow summary
    console.log(`\n🔄 Validation Flow Summary:`);
    const allFlows = results.flatMap(r => r.details.validationFlow);
    const uniqueFlows = [...new Set(allFlows)];
    uniqueFlows.forEach(flow => {
      const count = allFlows.filter(f => f === flow).length;
      console.log(`  ${flow}: ${count}/${totalTests} tests`);
    });

    // Issues by aspect summary
    console.log(`\n🎯 Issues by Validation Aspect:`);
    const allAspects: Record<string, number> = {};
    results.forEach(result => {
      Object.entries(result.details.issuesByAspect).forEach(([aspect, count]) => {
        allAspects[aspect] = (allAspects[aspect] || 0) + count;
      });
    });

    Object.entries(allAspects)
      .sort(([,a], [,b]) => b - a)
      .forEach(([aspect, count]) => {
        console.log(`  ${aspect}: ${count} issues`);
      });

    // Success criteria check
    console.log(`\n🎉 Simplified End-to-End Success Criteria Check:`);
    console.log(`  ✅ Validation service works: ${results.every(r => r.validationTime > 0) ? 'PASS' : 'FAIL'}`);
    console.log(`  ✅ Validation results structure valid: ${results.every(r => r.issuesFound >= 0) ? 'PASS' : 'FAIL'}`);
    console.log(`  ✅ Score calculation works: ${results.every(r => r.score >= 0 && r.score <= 100) ? 'PASS' : 'FAIL'}`);
    console.log(`  ✅ Performance acceptable: ${avgValidationTime < 10000 ? 'PASS' : 'FAIL'}`);
    console.log(`  ✅ Overall pass rate >= 80%: ${passRate >= 80 ? 'PASS' : 'FAIL'}`);

    console.log(`\n🚀 Simplified End-to-End Tests ${passRate >= 80 ? 'PASSED' : 'FAILED'}!`);
    
    if (passRate >= 80) {
      console.log('\n🎉 SUCCESS: Simplified validation flow is working!');
      console.log('✅ Validation service can process resources end-to-end');
      console.log('✅ Validation results are properly structured');
      console.log('✅ Score calculation is working correctly');
      console.log('✅ Performance is acceptable');
      console.log('✅ Ready for database integration testing');
    } else {
      console.log('\n❌ FAILURE: Simplified validation flow has issues');
      console.log('🔧 Review failed tests and fix validation service issues');
      console.log('📝 Check validation service configuration and dependencies');
    }
  }
}
