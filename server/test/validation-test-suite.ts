/**
 * FHIR R4 Validation Test Suite
 * 
 * Comprehensive test suite for validating the FHIR validation engine
 * using the test resource suite with expected score ranges.
 */

import { testResourceSuite } from './test-resources';
import { StructuralValidator } from '../services/validation/engine/structural-validator';
import { ProfileValidator } from '../services/validation/engine/profile-validator';
import { TerminologyValidator } from '../services/validation/engine/terminology-validator';
import { ReferenceValidator } from '../services/validation/engine/reference-validator';
import { BusinessRuleValidator } from '../services/validation/engine/business-rule-validator';
import { MetadataValidator } from '../services/validation/engine/metadata-validator';

export interface ValidationTestResult {
  resourceId: string;
  resourceType: string;
  category: string;
  expectedScoreRange: { min: number; max: number };
  actualScore: number;
  totalIssues: number;
  errors: number;
  warnings: number;
  info: number;
  issuesByAspect: Record<string, number>;
  validationTime: number;
  passed: boolean;
  details: {
    structuralIssues: number;
    profileIssues: number;
    terminologyIssues: number;
    referenceIssues: number;
    businessRuleIssues: number;
    metadataIssues: number;
  };
}

export class ValidationTestSuite {
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
   * Run comprehensive validation test suite
   */
  async runTestSuite(): Promise<ValidationTestResult[]> {
    console.log('🧪 Starting FHIR R4 Validation Test Suite...');
    console.log('📊 Testing all validators with comprehensive test resource suite');

    const results: ValidationTestResult[] = [];
    const expectedRanges = testResourceSuite.getExpectedScoreRanges();

    // Test valid resources
    console.log('\n✅ Testing Valid Resources (Expected: 90-100%)');
    const validResources = testResourceSuite.getByCategory('valid');
    for (const resource of validResources) {
      const result = await this.testResource(resource, 'valid', expectedRanges.valid);
      results.push(result);
      this.logTestResult(result);
    }

    // Test invalid resources
    console.log('\n❌ Testing Invalid Resources (Expected: 20-50%)');
    const invalidResources = testResourceSuite.getByCategory('invalid');
    for (const resource of invalidResources) {
      const result = await this.testResource(resource, 'invalid', expectedRanges.invalid);
      results.push(result);
      this.logTestResult(result);
    }

    // Test terminology issue resources
    console.log('\n⚠️ Testing Terminology Issue Resources (Expected: 60-80%)');
    const terminologyResources = testResourceSuite.getByCategory('terminologyIssues');
    for (const resource of terminologyResources) {
      const result = await this.testResource(resource, 'terminologyIssues', expectedRanges.terminologyIssues);
      results.push(result);
      this.logTestResult(result);
    }

    // Test reference issue resources
    console.log('\n🔗 Testing Reference Issue Resources (Expected: 70-90%)');
    const referenceResources = testResourceSuite.getByCategory('referenceIssues');
    for (const resource of referenceResources) {
      const result = await this.testResource(resource, 'referenceIssues', expectedRanges.referenceIssues);
      results.push(result);
      this.logTestResult(result);
    }

    // Generate summary
    this.generateTestSummary(results);
    
    return results;
  }

  /**
   * Test a single resource against all validators
   */
  private async testResource(resource: any, category: string, expectedRange: { min: number; max: number }): Promise<ValidationTestResult> {
    const startTime = Date.now();
    const resourceType = resource.resourceType;
    const resourceId = resource.id;

    console.log(`  🔍 Testing ${resourceType} (${resourceId}) - Category: ${category}`);

    // Run all validators
    const [structuralIssues, profileIssues, terminologyIssues, referenceIssues, businessRuleIssues, metadataIssues] = await Promise.all([
      this.structuralValidator.validate(resource, resourceType),
      this.profileValidator.validate(resource, resourceType, undefined, undefined, undefined),
      this.terminologyValidator.validate(resource, resourceType),
      this.referenceValidator.validate(resource, resourceType),
      this.businessRuleValidator.validate(resource, resourceType),
      this.metadataValidator.validate(resource, resourceType)
    ]);

    // Combine all issues
    const allIssues = [
      ...structuralIssues,
      ...profileIssues,
      ...terminologyIssues,
      ...referenceIssues,
      ...businessRuleIssues,
      ...metadataIssues
    ];

    // Calculate score (100% - (issues * penalty))
    const issuePenalty = 5; // 5% penalty per issue
    const actualScore = Math.max(0, 100 - (allIssues.length * issuePenalty));

    // Count issues by severity
    const errors = allIssues.filter(issue => issue.severity === 'error').length;
    const warnings = allIssues.filter(issue => issue.severity === 'warning').length;
    const info = allIssues.filter(issue => issue.severity === 'info').length;

    // Count issues by aspect
    const issuesByAspect: Record<string, number> = {};
    allIssues.forEach(issue => {
      issuesByAspect[issue.aspect] = (issuesByAspect[issue.aspect] || 0) + 1;
    });

    const validationTime = Date.now() - startTime;

    // Check if test passed (score within expected range)
    const passed = actualScore >= expectedRange.min && actualScore <= expectedRange.max;

    return {
      resourceId,
      resourceType,
      category,
      expectedScoreRange: expectedRange,
      actualScore,
      totalIssues: allIssues.length,
      errors,
      warnings,
      info,
      issuesByAspect,
      validationTime,
      passed,
      details: {
        structuralIssues: structuralIssues.length,
        profileIssues: profileIssues.length,
        terminologyIssues: terminologyIssues.length,
        referenceIssues: referenceIssues.length,
        businessRuleIssues: businessRuleIssues.length,
        metadataIssues: metadataIssues.length
      }
    };
  }

  /**
   * Log individual test result
   */
  private logTestResult(result: ValidationTestResult): void {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    const scoreColor = result.actualScore >= 80 ? '🟢' : result.actualScore >= 60 ? '🟡' : '🔴';
    
    console.log(`    ${status} ${result.resourceType} (${result.resourceId})`);
    console.log(`      Score: ${scoreColor} ${result.actualScore.toFixed(1)}% (Expected: ${result.expectedScoreRange.min}-${result.expectedScoreRange.max}%)`);
    console.log(`      Issues: ${result.totalIssues} (${result.errors} errors, ${result.warnings} warnings, ${result.info} info)`);
    console.log(`      Aspects: Structural(${result.details.structuralIssues}) Profile(${result.details.profileIssues}) Terminology(${result.details.terminologyIssues}) Reference(${result.details.referenceIssues}) Business(${result.details.businessRuleIssues}) Metadata(${result.details.metadataIssues})`);
    console.log(`      Time: ${result.validationTime}ms`);
  }

  /**
   * Generate comprehensive test summary
   */
  private generateTestSummary(results: ValidationTestResult[]): void {
    console.log('\n🎯 FHIR R4 Validation Test Suite Summary');
    console.log('==========================================');

    // Overall statistics
    const totalTests = results.length;
    const passedTests = results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    const passRate = (passedTests / totalTests) * 100;

    console.log(`\n📊 Overall Results:`);
    console.log(`  Total Tests: ${totalTests}`);
    console.log(`  Passed: ${passedTests} (${passRate.toFixed(1)}%)`);
    console.log(`  Failed: ${failedTests}`);

    // Results by category
    console.log(`\n📋 Results by Category:`);
    const categories = ['valid', 'invalid', 'terminologyIssues', 'referenceIssues'];
    categories.forEach(category => {
      const categoryResults = results.filter(r => r.category === category);
      const categoryPassed = categoryResults.filter(r => r.passed).length;
      const categoryPassRate = categoryResults.length > 0 ? (categoryPassed / categoryResults.length) * 100 : 0;
      const avgScore = categoryResults.length > 0 ? categoryResults.reduce((sum, r) => sum + r.actualScore, 0) / categoryResults.length : 0;
      
      console.log(`  ${category}: ${categoryPassed}/${categoryResults.length} passed (${categoryPassRate.toFixed(1)}%) - Avg Score: ${avgScore.toFixed(1)}%`);
    });

    // Issue statistics
    const totalIssues = results.reduce((sum, r) => sum + r.totalIssues, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);
    const totalWarnings = results.reduce((sum, r) => sum + r.warnings, 0);
    const totalInfo = results.reduce((sum, r) => sum + r.info, 0);

    console.log(`\n🔍 Issue Statistics:`);
    console.log(`  Total Issues Found: ${totalIssues}`);
    console.log(`  Errors: ${totalErrors}`);
    console.log(`  Warnings: ${totalWarnings}`);
    console.log(`  Info: ${totalInfo}`);

    // Issues by aspect
    console.log(`\n🎯 Issues by Validation Aspect:`);
    const aspectTotals: Record<string, number> = {};
    results.forEach(result => {
      Object.entries(result.issuesByAspect).forEach(([aspect, count]) => {
        aspectTotals[aspect] = (aspectTotals[aspect] || 0) + count;
      });
    });

    Object.entries(aspectTotals)
      .sort(([,a], [,b]) => b - a)
      .forEach(([aspect, count]) => {
        console.log(`  ${aspect}: ${count} issues`);
      });

    // Performance statistics
    const totalTime = results.reduce((sum, r) => sum + r.validationTime, 0);
    const avgTime = totalTime / totalTests;

    console.log(`\n⚡ Performance Statistics:`);
    console.log(`  Total Validation Time: ${totalTime}ms`);
    console.log(`  Average Time per Resource: ${avgTime.toFixed(1)}ms`);

    // Failed tests details
    if (failedTests > 0) {
      console.log(`\n❌ Failed Tests Details:`);
      results.filter(r => !r.passed).forEach(result => {
        console.log(`  ${result.resourceType} (${result.resourceId}):`);
        console.log(`    Expected: ${result.expectedScoreRange.min}-${result.expectedScoreRange.max}%`);
        console.log(`    Actual: ${result.actualScore.toFixed(1)}%`);
        console.log(`    Issues: ${result.totalIssues} (${result.errors} errors, ${result.warnings} warnings)`);
      });
    }

    // Success criteria check
    console.log(`\n🎉 Success Criteria Check:`);
    console.log(`  ✅ No more 100% scores for all resources: ${results.some(r => r.actualScore < 100) ? 'PASS' : 'FAIL'}`);
    console.log(`  ✅ Different resource types show different results: ${this.checkDifferentResults(results) ? 'PASS' : 'FAIL'}`);
    console.log(`  ✅ Invalid resources show appropriate error counts: ${this.checkInvalidResourceErrors(results) ? 'PASS' : 'FAIL'}`);
    console.log(`  ✅ Overall pass rate >= 80%: ${passRate >= 80 ? 'PASS' : 'FAIL'}`);

    console.log(`\n🚀 Test Suite ${passRate >= 80 ? 'PASSED' : 'FAILED'}!`);
  }

  /**
   * Check if different resource types show different results
   */
  private checkDifferentResults(results: ValidationTestResult[]): boolean {
    const scoresByType: Record<string, number[]> = {};
    results.forEach(result => {
      if (!scoresByType[result.resourceType]) {
        scoresByType[result.resourceType] = [];
      }
      scoresByType[result.resourceType].push(result.actualScore);
    });

    const avgScores = Object.entries(scoresByType).map(([type, scores]) => ({
      type,
      avgScore: scores.reduce((sum, score) => sum + score, 0) / scores.length
    }));

    // Check if there's variation in scores across resource types
    const scoreVariation = Math.max(...avgScores.map(s => s.avgScore)) - Math.min(...avgScores.map(s => s.avgScore));
    return scoreVariation > 10; // At least 10% variation
  }

  /**
   * Check if invalid resources show appropriate error counts
   */
  private checkInvalidResourceErrors(results: ValidationTestResult[]): boolean {
    const invalidResults = results.filter(r => r.category === 'invalid');
    const validResults = results.filter(r => r.category === 'valid');
    
    if (invalidResults.length === 0 || validResults.length === 0) {
      return false;
    }

    const avgInvalidIssues = invalidResults.reduce((sum, r) => sum + r.totalIssues, 0) / invalidResults.length;
    const avgValidIssues = validResults.reduce((sum, r) => sum + r.totalIssues, 0) / validResults.length;

    // Invalid resources should have significantly more issues than valid ones
    return avgInvalidIssues > avgValidIssues * 2;
  }
}
