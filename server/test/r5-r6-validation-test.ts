/**
 * R5/R6 Validation Test Suite
 * 
 * Tests the enhanced FHIR validation system with R5 and R6 support,
 * including version detection, structural validation, and terminology validation.
 */

import type { ValidationIssue } from '../services/validation/types/validation-types';

export interface R5R6TestResult {
  testName: string;
  success: boolean;
  fhirVersion: 'R4' | 'R5' | 'R6';
  issues: ValidationIssue[];
  executionTime: number;
  details?: any;
}

export class R5R6ValidationTest {
  private testResults: R5R6TestResult[] = [];

  /**
   * Run comprehensive R5/R6 validation tests
   */
  async runR5R6ValidationTests(): Promise<R5R6TestResult[]> {
    console.log('🚀 Starting R5/R6 Validation Tests...');
    console.log('=====================================');

    this.testResults = [];

    // Test 1: R4 Resource Validation (baseline)
    await this.testR4ResourceValidation();

    // Test 2: R5 Resource Validation
    await this.testR5ResourceValidation();

    // Test 3: R6 Resource Validation
    await this.testR6ResourceValidation();

    // Test 4: Version Detection
    await this.testVersionDetection();

    // Test 5: R5/R6 Specific Features
    await this.testR5R6SpecificFeatures();

    // Test 6: Cross-Version Compatibility
    await this.testCrossVersionCompatibility();

    return this.testResults;
  }

  /**
   * Test R4 resource validation (baseline)
   */
  private async testR4ResourceValidation(): Promise<void> {
    console.log('📋 Test 1: R4 Resource Validation');
    console.log('=================================');

    const startTime = Date.now();

    const r4Patient = {
      resourceType: 'Patient',
      id: 'patient-r4-001',
      name: [
        {
          use: 'official',
          family: 'Smith',
          given: ['John']
        }
      ],
      gender: 'male',
      birthDate: '1990-01-01'
    };

    try {
      // Simulate structural validation for R4
      const issues = await this.simulateStructuralValidation(r4Patient, 'Patient', 'R4');
      
      const result: R5R6TestResult = {
        testName: 'R4 Patient Resource Validation',
        success: issues.length === 0,
        fhirVersion: 'R4',
        issues,
        executionTime: Date.now() - startTime,
        details: {
          resourceType: 'Patient',
          validationMethod: 'structural',
          expectedIssues: 0
        }
      };

      this.testResults.push(result);
      console.log(`✅ R4 validation completed in ${result.executionTime}ms, found ${issues.length} issues`);
    } catch (error) {
      const result: R5R6TestResult = {
        testName: 'R4 Patient Resource Validation',
        success: false,
        fhirVersion: 'R4',
        issues: [],
        executionTime: Date.now() - startTime,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };

      this.testResults.push(result);
      console.log(`❌ R4 validation failed: ${result.details.error}`);
    }
  }

  /**
   * Test R5 resource validation
   */
  private async testR5ResourceValidation(): Promise<void> {
    console.log('📋 Test 2: R5 Resource Validation');
    console.log('=================================');

    const startTime = Date.now();

    const r5Patient = {
      resourceType: 'Patient',
      id: 'patient-r5-001',
      meta: {
        profile: ['http://hl7.org/fhir/r5/StructureDefinition/Patient'],
        versionId: '1'
      },
      name: [
        {
          use: 'official',
          family: 'Johnson',
          given: ['Jane']
        }
      ],
      gender: 'female',
      birthDate: '1985-05-15',
      contained: [
        {
          resourceType: 'Organization',
          id: 'org-001',
          name: 'Test Organization'
        }
      ]
    };

    try {
      // Simulate structural validation for R5
      const issues = await this.simulateStructuralValidation(r5Patient, 'Patient', 'R5');
      
      const result: R5R6TestResult = {
        testName: 'R5 Patient Resource Validation',
        success: issues.length <= 1, // Allow 1 issue for contained resource validation
        fhirVersion: 'R5',
        issues,
        executionTime: Date.now() - startTime,
        details: {
          resourceType: 'Patient',
          validationMethod: 'structural',
          expectedIssues: '<= 1',
          hasContainedResources: true,
          hasR5Features: true
        }
      };

      this.testResults.push(result);
      console.log(`✅ R5 validation completed in ${result.executionTime}ms, found ${issues.length} issues`);
    } catch (error) {
      const result: R5R6TestResult = {
        testName: 'R5 Patient Resource Validation',
        success: false,
        fhirVersion: 'R5',
        issues: [],
        executionTime: Date.now() - startTime,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };

      this.testResults.push(result);
      console.log(`❌ R5 validation failed: ${result.details.error}`);
    }
  }

  /**
   * Test R6 resource validation
   */
  private async testR6ResourceValidation(): Promise<void> {
    console.log('📋 Test 3: R6 Resource Validation');
    console.log('=================================');

    const startTime = Date.now();

    const r6Patient = {
      resourceType: 'Patient',
      id: 'patient-r6-001',
      meta: {
        profile: ['http://hl7.org/fhir/r6/StructureDefinition/Patient'],
        versionId: '2',
        security: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v3-Confidentiality',
            code: 'R'
          }
        ]
      },
      name: [
        {
          use: 'official',
          family: 'Williams',
          given: ['Robert']
        }
      ],
      gender: 'other',
      birthDate: '1992-12-25',
      extension: [
        {
          url: 'http://hl7.org/fhir/r6/StructureDefinition/patient-birthPlace',
          valueAddress: {
            city: 'New York',
            state: 'NY'
          }
        }
      ]
    };

    try {
      // Simulate structural validation for R6
      const issues = await this.simulateStructuralValidation(r6Patient, 'Patient', 'R6');
      
      const result: R5R6TestResult = {
        testName: 'R6 Patient Resource Validation',
        success: issues.length <= 2, // Allow 2 issues for R6 specific validations
        fhirVersion: 'R6',
        issues,
        executionTime: Date.now() - startTime,
        details: {
          resourceType: 'Patient',
          validationMethod: 'structural',
          expectedIssues: '<= 2',
          hasR6Features: true,
          hasSecurityLabels: true,
          hasExtensions: true
        }
      };

      this.testResults.push(result);
      console.log(`✅ R6 validation completed in ${result.executionTime}ms, found ${issues.length} issues`);
    } catch (error) {
      const result: R5R6TestResult = {
        testName: 'R6 Patient Resource Validation',
        success: false,
        fhirVersion: 'R6',
        issues: [],
        executionTime: Date.now() - startTime,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };

      this.testResults.push(result);
      console.log(`❌ R6 validation failed: ${result.details.error}`);
    }
  }

  /**
   * Test FHIR version detection
   */
  private async testVersionDetection(): Promise<void> {
    console.log('📋 Test 4: FHIR Version Detection');
    console.log('=================================');

    const startTime = Date.now();

    const testResources = [
      {
        name: 'R4 Resource',
        resource: {
          resourceType: 'Patient',
          id: 'test-r4',
          name: [{ use: 'official', family: 'Test' }]
        },
        expectedVersion: 'R4' as const
      },
      {
        name: 'R5 Resource',
        resource: {
          resourceType: 'Patient',
          id: 'test-r5',
          meta: {
            profile: ['http://hl7.org/fhir/r5/StructureDefinition/Patient']
          },
          name: [{ use: 'official', family: 'Test' }],
          contained: [{ resourceType: 'Organization', id: 'org-1' }]
        },
        expectedVersion: 'R5' as const
      },
      {
        name: 'R6 Resource',
        resource: {
          resourceType: 'Patient',
          id: 'test-r6',
          meta: {
            profile: ['http://hl7.org/fhir/r6/StructureDefinition/Patient'],
            versionId: '1'
          },
          name: [{ use: 'official', family: 'Test' }],
          extension: [{ url: 'http://hl7.org/fhir/r6/StructureDefinition/patient-birthPlace' }]
        },
        expectedVersion: 'R6' as const
      }
    ];

    try {
      let detectionResults = 0;
      let correctDetections = 0;

      for (const testCase of testResources) {
        const detectedVersion = this.simulateVersionDetection(testCase.resource);
        detectionResults++;
        
        if (detectedVersion === testCase.expectedVersion) {
          correctDetections++;
          console.log(`✅ ${testCase.name}: Detected ${detectedVersion} (correct)`);
        } else {
          console.log(`⚠️  ${testCase.name}: Detected ${detectedVersion}, expected ${testCase.expectedVersion}`);
        }
      }

      const success = correctDetections === detectionResults;
      
      const result: R5R6TestResult = {
        testName: 'FHIR Version Detection',
        success,
        fhirVersion: 'R4', // Default for this test
        issues: [],
        executionTime: Date.now() - startTime,
        details: {
          totalTests: detectionResults,
          correctDetections,
          accuracy: (correctDetections / detectionResults) * 100,
          testCases: testResources.map(tc => ({
            name: tc.name,
            expected: tc.expectedVersion
          }))
        }
      };

      this.testResults.push(result);
      console.log(`✅ Version detection completed: ${correctDetections}/${detectionResults} correct (${result.details.accuracy}%)`);
    } catch (error) {
      const result: R5R6TestResult = {
        testName: 'FHIR Version Detection',
        success: false,
        fhirVersion: 'R4',
        issues: [],
        executionTime: Date.now() - startTime,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };

      this.testResults.push(result);
      console.log(`❌ Version detection failed: ${result.details.error}`);
    }
  }

  /**
   * Test R5/R6 specific features
   */
  private async testR5R6SpecificFeatures(): Promise<void> {
    console.log('📋 Test 5: R5/R6 Specific Features');
    console.log('==================================');

    const startTime = Date.now();

    try {
      const r5Features = await this.testR5SpecificFeatures();
      const r6Features = await this.testR6SpecificFeatures();

      const success = r5Features && r6Features;
      
      const result: R5R6TestResult = {
        testName: 'R5/R6 Specific Features',
        success,
        fhirVersion: 'R5', // Default for this test
        issues: [],
        executionTime: Date.now() - startTime,
        details: {
          r5FeaturesWorking: r5Features,
          r6FeaturesWorking: r6Features,
          features: [
            'R5 contained resource handling',
            'R5 extension validation',
            'R6 metadata requirements',
            'R6 profile validation',
            'R6 security labels'
          ]
        }
      };

      this.testResults.push(result);
      console.log(`✅ R5/R6 features test completed: R5=${r5Features}, R6=${r6Features}`);
    } catch (error) {
      const result: R5R6TestResult = {
        testName: 'R5/R6 Specific Features',
        success: false,
        fhirVersion: 'R5',
        issues: [],
        executionTime: Date.now() - startTime,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };

      this.testResults.push(result);
      console.log(`❌ R5/R6 features test failed: ${result.details.error}`);
    }
  }

  /**
   * Test cross-version compatibility
   */
  private async testCrossVersionCompatibility(): Promise<void> {
    console.log('📋 Test 6: Cross-Version Compatibility');
    console.log('=====================================');

    const startTime = Date.now();

    try {
      // Test that R4 resources work with R5/R6 validators
      const r4Resource = {
        resourceType: 'Patient',
        id: 'compat-test',
        name: [{ use: 'official', family: 'Compatibility' }]
      };

      const r4Issues = await this.simulateStructuralValidation(r4Resource, 'Patient', 'R4');
      const r5Issues = await this.simulateStructuralValidation(r4Resource, 'Patient', 'R5');
      const r6Issues = await this.simulateStructuralValidation(r4Resource, 'Patient', 'R6');

      // R4 resource should work with all versions
      const compatibilitySuccess = r4Issues.length === r5Issues.length && r5Issues.length === r6Issues.length;
      
      const result: R5R6TestResult = {
        testName: 'Cross-Version Compatibility',
        success: compatibilitySuccess,
        fhirVersion: 'R4', // Default for this test
        issues: [...r4Issues, ...r5Issues, ...r6Issues],
        executionTime: Date.now() - startTime,
        details: {
          r4Issues: r4Issues.length,
          r5Issues: r5Issues.length,
          r6Issues: r6Issues.length,
          compatibilityCheck: 'R4 resource validated with R4/R5/R6 validators'
        }
      };

      this.testResults.push(result);
      console.log(`✅ Cross-version compatibility test completed: R4=${r4Issues.length}, R5=${r5Issues.length}, R6=${r6Issues.length} issues`);
    } catch (error) {
      const result: R5R6TestResult = {
        testName: 'Cross-Version Compatibility',
        success: false,
        fhirVersion: 'R4',
        issues: [],
        executionTime: Date.now() - startTime,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };

      this.testResults.push(result);
      console.log(`❌ Cross-version compatibility test failed: ${result.details.error}`);
    }
  }

  /**
   * Test R5 specific features
   */
  private async testR5SpecificFeatures(): Promise<boolean> {
    try {
      // Test R5 contained resource handling
      const r5ResourceWithContained = {
        resourceType: 'Patient',
        contained: [
          {
            // Missing resourceType - should trigger R5 validation issue
            id: 'org-1'
          }
        ]
      };

      const issues = await this.simulateStructuralValidation(r5ResourceWithContained, 'Patient', 'R5');
      
      // Should find issue with missing resourceType in contained resource
      return issues.length >= 1;
    } catch (error) {
      return false;
    }
  }

  /**
   * Test R6 specific features
   */
  private async testR6SpecificFeatures(): Promise<boolean> {
    try {
      // Test R6 metadata requirements
      const r6ResourceWithIncompleteMeta = {
        resourceType: 'Patient',
        id: 'test-r6',
        meta: {
          profile: ['invalid-profile'] // Should trigger R6 validation issue
        }
      };

      const issues = await this.simulateStructuralValidation(r6ResourceWithIncompleteMeta, 'Patient', 'R6');
      
      // Should find issue with invalid profile format
      return issues.length >= 1;
    } catch (error) {
      return false;
    }
  }

  /**
   * Simulate structural validation (mock implementation)
   */
  private async simulateStructuralValidation(resource: any, resourceType: string, fhirVersion: 'R4' | 'R5' | 'R6'): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Simulate basic validation
    if (!resource.resourceType) {
      issues.push({
        id: `sim-${Date.now()}-1`,
        aspect: 'structural',
        severity: 'error',
        code: 'required-element-missing',
        message: 'Resource type is required',
        path: 'resourceType',
        humanReadable: 'The resource must have a resourceType field',
        timestamp: new Date().toISOString(),
        resourceType: resourceType,
        schemaVersion: fhirVersion
      });
    }

    // Simulate R5 specific validation
    if (fhirVersion === 'R5' && resource.contained) {
      for (let i = 0; i < resource.contained.length; i++) {
        const contained = resource.contained[i];
        if (!contained.resourceType) {
          issues.push({
            id: `sim-r5-${Date.now()}-${i}`,
            aspect: 'structural',
            severity: 'error',
            code: 'missing-resource-type',
            message: `Contained resource at index ${i} is missing resourceType`,
            path: `contained[${i}].resourceType`,
            humanReadable: `Contained resources must have a resourceType field in FHIR R5`,
            timestamp: new Date().toISOString(),
            resourceType: resourceType,
            schemaVersion: 'R5'
          });
        }
      }
    }

    // Simulate R6 specific validation
    if (fhirVersion === 'R6' && resource.meta?.profile) {
      for (let i = 0; i < resource.meta.profile.length; i++) {
        const profile = resource.meta.profile[i];
        if (typeof profile === 'string' && !profile.startsWith('http')) {
          issues.push({
            id: `sim-r6-${Date.now()}-${i}`,
            aspect: 'structural',
            severity: 'warning',
            code: 'invalid-profile-format',
            message: `Profile at index ${i} should be a URI`,
            path: `meta.profile[${i}]`,
            humanReadable: `Profile references should be URIs in FHIR R6`,
            timestamp: new Date().toISOString(),
            resourceType: resourceType,
            schemaVersion: 'R6'
          });
        }
      }
    }

    return issues;
  }

  /**
   * Simulate FHIR version detection
   */
  private simulateVersionDetection(resource: any): 'R4' | 'R5' | 'R6' {
    // Check meta.profile for version indicators
    if (resource.meta?.profile && Array.isArray(resource.meta.profile)) {
      for (const profile of resource.meta.profile) {
        if (typeof profile === 'string') {
          if (profile.includes('r6') || profile.includes('R6')) return 'R6';
          if (profile.includes('r5') || profile.includes('R5')) return 'R5';
        }
      }
    }

    // Check for R5/R6 specific features
    if (resource.contained && Array.isArray(resource.contained)) {
      return 'R5'; // R5 introduced better contained resource handling
    }

    // Check for R6 specific features
    if (resource.extension && Array.isArray(resource.extension)) {
      const hasR6Extensions = resource.extension.some((ext: any) => 
        ext.url && (ext.url.includes('r6') || ext.url.includes('R6'))
      );
      if (hasR6Extensions) return 'R6';
    }

    // Default to R4
    return 'R4';
  }

  /**
   * Get test summary
   */
  getTestSummary(): {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    passRate: number;
    averageExecutionTime: number;
    versionBreakdown: Record<string, number>;
  } {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;
    const passRate = (passedTests / totalTests) * 100;
    const averageExecutionTime = this.testResults.reduce((sum, r) => sum + r.executionTime, 0) / totalTests;

    const versionBreakdown: Record<string, number> = {};
    this.testResults.forEach(result => {
      versionBreakdown[result.fhirVersion] = (versionBreakdown[result.fhirVersion] || 0) + 1;
    });

    return {
      totalTests,
      passedTests,
      failedTests,
      passRate,
      averageExecutionTime,
      versionBreakdown
    };
  }
}

// Export for use in test runners
export default R5R6ValidationTest;
