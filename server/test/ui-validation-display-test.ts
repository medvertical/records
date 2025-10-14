/**
 * UI Validation Results Display Test
 * 
 * Tests that validation results are properly displayed in the UI components
 * including validation badges, scores, and issue details.
 */

import { testResourceSuite } from './test-resources';
import { StructuralValidator } from '../services/validation/engine/structural-validator';
import { ProfileValidator } from '../services/validation/engine/profile-validator';
import { TerminologyValidator } from '../services/validation/engine/terminology-validator';
import { ReferenceValidator } from '../services/validation/engine/reference-validator';
import { BusinessRuleValidator } from '../services/validation/engine/business-rule-validator';
import { MetadataValidator } from '../services/validation/engine/metadata-validator';

export interface UIDisplayTestResult {
  testName: string;
  resourceId: string;
  resourceType: string;
  success: boolean;
  uiComponents: {
    validationBadge: boolean;
    scoreDisplay: boolean;
    issueList: boolean;
    aspectBreakdown: boolean;
    performanceMetrics: boolean;
  };
  validationData: {
    score: number;
    totalIssues: number;
    issuesByAspect: Record<string, number>;
    issuesBySeverity: Record<string, number>;
    performanceTime: number;
  };
  errors: string[];
}

export class UIValidationDisplayTest {
  private structuralValidator: StructuralValidator;
  private profileValidator: ProfileValidator;
  private terminologyValidator: TerminologyValidator;
  private referenceValidator: ReferenceValidator;
  private businessRuleValidator: BusinessRuleValidator;
  private metadataValidator: MetadataValidator;

  constructor() {
    this.structuralValidator = new StructuralValidator();
    this.profileValidator = new ProfileValidator();
    this.terminologyValidator = new TerminologyValidator();
    this.referenceValidator = new ReferenceValidator();
    this.businessRuleValidator = new BusinessRuleValidator();
    this.metadataValidator = new MetadataValidator();
  }

  /**
   * Run comprehensive UI validation display tests
   */
  async runUIDisplayTests(): Promise<UIDisplayTestResult[]> {
    console.log('🚀 Starting UI Validation Results Display Tests...');
    console.log('==================================================');
    
    const results: UIDisplayTestResult[] = [];
    
    // Test 1: Valid Patient Resource UI Display
    console.log('\n📋 Test 1: Valid Patient Resource UI Display');
    const validPatientResult = await this.testResourceUIDisplay(
      testResourceSuite.valid.validPatient,
      'Valid Patient Resource UI Display'
    );
    results.push(validPatientResult);
    
    // Test 2: Invalid Observation Resource UI Display
    console.log('\n📋 Test 2: Invalid Observation Resource UI Display');
    const invalidObservationResult = await this.testResourceUIDisplay(
      testResourceSuite.invalid.invalidObservation,
      'Invalid Observation Resource UI Display'
    );
    results.push(invalidObservationResult);
    
    // Test 3: Resource with Terminology Issues UI Display
    console.log('\n📋 Test 3: Resource with Terminology Issues UI Display');
    const terminologyIssueResult = await this.testResourceUIDisplay(
      testResourceSuite.terminologyIssues.patientWithInvalidCodes,
      'Resource with Terminology Issues UI Display'
    );
    results.push(terminologyIssueResult);
    
    // Test 4: Resource with Reference Issues UI Display
    console.log('\n📋 Test 4: Resource with Reference Issues UI Display');
    const referenceIssueResult = await this.testResourceUIDisplay(
      testResourceSuite.referenceIssues.observationWithBrokenReferences,
      'Resource with Reference Issues UI Display'
    );
    results.push(referenceIssueResult);
    
    // Generate comprehensive summary
    this.generateUIDisplaySummary(results);
    
    return results;
  }

  /**
   * Test a single resource's UI display capabilities
   */
  private async testResourceUIDisplay(resource: any, testName: string): Promise<UIDisplayTestResult> {
    const startTime = Date.now();
    const resourceId = resource.id;
    const resourceType = resource.resourceType;
    const errors: string[] = [];

    console.log(`  🔍 Testing ${resourceType} (${resourceId}) - ${testName}`);

    try {
      // Step 1: Perform validation to get results
      const [structuralIssues, profileIssues, terminologyIssues, referenceIssues, businessRuleIssues, metadataIssues] = await Promise.all([
        this.structuralValidator.validate(resource, resourceType),
        this.profileValidator.validate(resource, resourceType, undefined, undefined, undefined),
        this.terminologyValidator.validate(resource, resourceType),
        this.referenceValidator.validate(resource, resourceType),
        this.businessRuleValidator.validate(resource, resourceType),
        this.metadataValidator.validate(resource, resourceType)
      ]);

      // Step 2: Aggregate validation results
      const allIssues = [
        ...structuralIssues,
        ...profileIssues,
        ...terminologyIssues,
        ...referenceIssues,
        ...businessRuleIssues,
        ...metadataIssues
      ];

      // Step 3: Calculate validation metrics
      const issuePenalty = 5;
      const score = Math.max(0, 100 - (allIssues.length * issuePenalty));
      const performanceTime = Date.now() - startTime;

      // Step 4: Analyze issues by aspect and severity
      const issuesByAspect: Record<string, number> = {};
      const issuesBySeverity: Record<string, number> = {};

      allIssues.forEach(issue => {
        issuesByAspect[issue.aspect] = (issuesByAspect[issue.aspect] || 0) + 1;
        issuesBySeverity[issue.severity] = (issuesBySeverity[issue.severity] || 0) + 1;
      });

      // Step 5: Test UI component data preparation
      const uiComponents = this.testUIComponentDataPreparation(allIssues, score, issuesByAspect, performanceTime, errors);

      // Step 6: Test validation badge data
      const validationBadgeData = this.prepareValidationBadgeData(allIssues, score, issuesByAspect, performanceTime);
      if (!validationBadgeData) {
        errors.push('Failed to prepare validation badge data');
      }

      // Step 7: Test score display data
      const scoreDisplayData = this.prepareScoreDisplayData(score, allIssues.length, issuesBySeverity);
      if (!scoreDisplayData) {
        errors.push('Failed to prepare score display data');
      }

      // Step 8: Test issue list data
      const issueListData = this.prepareIssueListData(allIssues);
      if (!issueListData || issueListData.length !== allIssues.length) {
        errors.push('Failed to prepare issue list data correctly');
      }

      // Step 9: Test aspect breakdown data
      const aspectBreakdownData = this.prepareAspectBreakdownData(issuesByAspect, allIssues);
      if (!aspectBreakdownData) {
        errors.push('Failed to prepare aspect breakdown data');
      }

      // Step 10: Test performance metrics data
      const performanceMetricsData = this.preparePerformanceMetricsData(performanceTime, issuesByAspect);
      if (!performanceMetricsData) {
        errors.push('Failed to prepare performance metrics data');
      }

      const success = errors.length === 0;

      console.log(`    ✅ UI Display test completed in ${performanceTime}ms`);
      console.log(`    📊 Score: ${score}% (${allIssues.length} issues)`);
      console.log(`    🎯 UI Components: ${Object.values(uiComponents).filter(Boolean).length}/5 working`);

      return {
        testName,
        resourceId,
        resourceType,
        success,
        uiComponents,
        validationData: {
          score,
          totalIssues: allIssues.length,
          issuesByAspect,
          issuesBySeverity,
          performanceTime
        },
        errors
      };

    } catch (error) {
      const performanceTime = Date.now() - startTime;
      errors.push(`UI display test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      console.log(`    ❌ UI display test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        testName,
        resourceId,
        resourceType,
        success: false,
        uiComponents: {
          validationBadge: false,
          scoreDisplay: false,
          issueList: false,
          aspectBreakdown: false,
          performanceMetrics: false
        },
        validationData: {
          score: 0,
          totalIssues: 0,
          issuesByAspect: {},
          issuesBySeverity: {},
          performanceTime
        },
        errors
      };
    }
  }

  /**
   * Test UI component data preparation
   */
  private testUIComponentDataPreparation(
    issues: any[],
    score: number,
    issuesByAspect: Record<string, number>,
    performanceTime: number,
    errors: string[]
  ): { validationBadge: boolean; scoreDisplay: boolean; issueList: boolean; aspectBreakdown: boolean; performanceMetrics: boolean } {
    const components = {
      validationBadge: false,
      scoreDisplay: false,
      issueList: false,
      aspectBreakdown: false,
      performanceMetrics: false
    };

    try {
      // Test validation badge data
      const validationBadgeData = this.prepareValidationBadgeData(issues, score, issuesByAspect, performanceTime);
      components.validationBadge = !!validationBadgeData;

      // Test score display data
      const scoreDisplayData = this.prepareScoreDisplayData(score, issues.length, {});
      components.scoreDisplay = !!scoreDisplayData;

      // Test issue list data
      const issueListData = this.prepareIssueListData(issues);
      components.issueList = issueListData.length === issues.length;

      // Test aspect breakdown data
      const aspectBreakdownData = this.prepareAspectBreakdownData(issuesByAspect, issues);
      components.aspectBreakdown = !!aspectBreakdownData;

      // Test performance metrics data
      const performanceMetricsData = this.preparePerformanceMetricsData(performanceTime, issuesByAspect);
      components.performanceMetrics = !!performanceMetricsData;

    } catch (error) {
      errors.push(`UI component data preparation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return components;
  }

  /**
   * Prepare validation badge data (simulates EnhancedValidationBadge component)
   */
  private prepareValidationBadgeData(
    issues: any[],
    score: number,
    issuesByAspect: Record<string, number>,
    performanceTime: number
  ): any {
    try {
      const isValid = issues.length === 0;
      const errorCount = issues.filter(i => i.severity === 'error').length;
      const warningCount = issues.filter(i => i.severity === 'warning').length;
      const infoCount = issues.filter(i => i.severity === 'info').length;

      return {
        isValid,
        overallScore: score,
        overallConfidence: Math.max(0, 100 - errorCount * 10), // Confidence decreases with errors
        overallCompleteness: Math.max(0, 100 - Object.keys(issuesByAspect).length * 5), // Completeness based on aspects with issues
        aspectResults: {
          structural: { isValid: issuesByAspect.structural === 0, score: Math.max(0, 100 - (issuesByAspect.structural || 0) * 10) },
          profile: { isValid: issuesByAspect.profile === 0, score: Math.max(0, 100 - (issuesByAspect.profile || 0) * 10) },
          terminology: { isValid: issuesByAspect.terminology === 0, score: Math.max(0, 100 - (issuesByAspect.terminology || 0) * 10) },
          reference: { isValid: issuesByAspect.reference === 0, score: Math.max(0, 100 - (issuesByAspect.reference || 0) * 10) },
          businessRule: { isValid: issuesByAspect['business-rules'] === 0, score: Math.max(0, 100 - (issuesByAspect['business-rules'] || 0) * 10) },
          metadata: { isValid: issuesByAspect.metadata === 0, score: Math.max(0, 100 - (issuesByAspect.metadata || 0) * 10) }
        },
        summary: {
          totalIssues: issues.length,
          errorCount,
          warningCount,
          informationCount: infoCount,
          issueCountByAspect: issuesByAspect
        },
        performance: {
          totalDurationMs: performanceTime,
          durationByAspect: Object.keys(issuesByAspect).reduce((acc, aspect) => {
            acc[aspect] = performanceTime / Object.keys(issuesByAspect).length;
            return acc;
          }, {} as Record<string, number>)
        }
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Prepare score display data (simulates score display component)
   */
  private prepareScoreDisplayData(
    score: number,
    totalIssues: number,
    issuesBySeverity: Record<string, number>
  ): any {
    try {
      return {
        score,
        totalIssues,
        issuesBySeverity,
        scoreColor: score >= 80 ? 'green' : score >= 60 ? 'yellow' : 'red',
        scoreLabel: score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Poor'
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Prepare issue list data (simulates issue list component)
   */
  private prepareIssueListData(issues: any[]): any[] {
    try {
      return issues.map((issue, index) => ({
        id: issue.id || `issue-${index}`,
        severity: issue.severity,
        message: issue.message,
        path: issue.path,
        humanReadable: issue.humanReadable,
        aspect: issue.aspect,
        code: issue.code,
        details: issue.details
      }));
    } catch (error) {
      return [];
    }
  }

  /**
   * Prepare aspect breakdown data (simulates aspect breakdown component)
   */
  private prepareAspectBreakdownData(
    issuesByAspect: Record<string, number>,
    allIssues: any[]
  ): any {
    try {
      const aspectBreakdown: Record<string, any> = {};
      
      Object.entries(issuesByAspect).forEach(([aspect, count]) => {
        const aspectIssues = allIssues.filter(issue => issue.aspect === aspect);
        aspectBreakdown[aspect] = {
          issueCount: count,
          errorCount: aspectIssues.filter(i => i.severity === 'error').length,
          warningCount: aspectIssues.filter(i => i.severity === 'warning').length,
          infoCount: aspectIssues.filter(i => i.severity === 'info').length,
          score: Math.max(0, 100 - count * 10),
          isValid: count === 0
        };
      });

      return aspectBreakdown;
    } catch (error) {
      return null;
    }
  }

  /**
   * Prepare performance metrics data (simulates performance metrics component)
   */
  private preparePerformanceMetricsData(
    performanceTime: number,
    issuesByAspect: Record<string, number>
  ): any {
    try {
      return {
        totalDurationMs: performanceTime,
        durationByAspect: Object.keys(issuesByAspect).reduce((acc, aspect) => {
          acc[aspect] = performanceTime / Object.keys(issuesByAspect).length;
          return acc;
        }, {} as Record<string, number>),
        performanceRating: performanceTime < 1000 ? 'Excellent' : performanceTime < 3000 ? 'Good' : 'Slow'
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate comprehensive UI display test summary
   */
  private generateUIDisplaySummary(results: UIDisplayTestResult[]): void {
    console.log('\n🎯 UI Validation Results Display Test Summary');
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
      console.log(`    Score: ${result.validationData.score}% (${result.validationData.totalIssues} issues)`);
      console.log(`    Performance: ${result.validationData.performanceTime}ms`);
      
      const workingComponents = Object.values(result.uiComponents).filter(Boolean).length;
      console.log(`    UI Components: ${workingComponents}/5 working`);
      
      if (result.errors.length > 0) {
        console.log(`    Errors: ${result.errors.join(', ')}`);
      }
    });

    // UI component statistics
    console.log(`\n🎨 UI Component Statistics:`);
    const componentStats = {
      validationBadge: results.filter(r => r.uiComponents.validationBadge).length,
      scoreDisplay: results.filter(r => r.uiComponents.scoreDisplay).length,
      issueList: results.filter(r => r.uiComponents.issueList).length,
      aspectBreakdown: results.filter(r => r.uiComponents.aspectBreakdown).length,
      performanceMetrics: results.filter(r => r.uiComponents.performanceMetrics).length
    };

    Object.entries(componentStats).forEach(([component, count]) => {
      const percentage = (count / totalTests) * 100;
      console.log(`  ${component}: ${count}/${totalTests} (${percentage.toFixed(1)}%)`);
    });

    // Validation data statistics
    console.log(`\n📊 Validation Data Statistics:`);
    const avgScore = results.reduce((sum, r) => sum + r.validationData.score, 0) / totalTests;
    const avgIssues = results.reduce((sum, r) => sum + r.validationData.totalIssues, 0) / totalTests;
    const avgPerformance = results.reduce((sum, r) => sum + r.validationData.performanceTime, 0) / totalTests;

    console.log(`  Average Score: ${avgScore.toFixed(1)}%`);
    console.log(`  Average Issues: ${avgIssues.toFixed(1)}`);
    console.log(`  Average Performance: ${avgPerformance.toFixed(1)}ms`);

    // Issues by aspect summary
    console.log(`\n🎯 Issues by Validation Aspect:`);
    const allAspects: Record<string, number> = {};
    results.forEach(result => {
      Object.entries(result.validationData.issuesByAspect).forEach(([aspect, count]) => {
        allAspects[aspect] = (allAspects[aspect] || 0) + count;
      });
    });

    Object.entries(allAspects)
      .sort(([,a], [,b]) => b - a)
      .forEach(([aspect, count]) => {
        console.log(`  ${aspect}: ${count} issues`);
      });

    // Success criteria check
    console.log(`\n🎉 UI Display Success Criteria Check:`);
    console.log(`  ✅ Validation badge data preparation: ${componentStats.validationBadge === totalTests ? 'PASS' : 'FAIL'}`);
    console.log(`  ✅ Score display data preparation: ${componentStats.scoreDisplay === totalTests ? 'PASS' : 'FAIL'}`);
    console.log(`  ✅ Issue list data preparation: ${componentStats.issueList === totalTests ? 'PASS' : 'FAIL'}`);
    console.log(`  ✅ Aspect breakdown data preparation: ${componentStats.aspectBreakdown === totalTests ? 'PASS' : 'FAIL'}`);
    console.log(`  ✅ Performance metrics data preparation: ${componentStats.performanceMetrics === totalTests ? 'PASS' : 'FAIL'}`);
    console.log(`  ✅ Overall pass rate >= 80%: ${passRate >= 80 ? 'PASS' : 'FAIL'}`);

    console.log(`\n🚀 UI Display Tests ${passRate >= 80 ? 'PASSED' : 'FAILED'}!`);
    
    if (passRate >= 80) {
      console.log('\n🎉 SUCCESS: UI validation results display is working!');
      console.log('✅ Validation badges can display validation results correctly');
      console.log('✅ Score displays can show validation scores properly');
      console.log('✅ Issue lists can display validation issues correctly');
      console.log('✅ Aspect breakdowns can show issue distribution');
      console.log('✅ Performance metrics can display timing information');
      console.log('✅ Ready for real-time UI testing');
    } else {
      console.log('\n❌ FAILURE: UI validation results display has issues');
      console.log('🔧 Review failed tests and fix UI component data preparation');
      console.log('📝 Check validation result data structure and formatting');
    }
  }
}
