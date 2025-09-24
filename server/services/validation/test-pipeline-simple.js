#!/usr/bin/env node

/**
 * Simple validation pipeline test
 * Tests the basic functionality of the validation pipeline
 */

import { getValidationPipeline } from './core/validation-pipeline';

async function testPipeline() {
  console.log('🧪 Testing Validation Pipeline...\n');

  try {
    const pipeline = getValidationPipeline();
    console.log('✅ Pipeline instance created');

    // Create a simple test resource
    const testResource = {
      resourceType: 'Patient',
      resourceId: 'test-patient-123',
      resource: {
        resourceType: 'Patient',
        id: 'test-patient-123',
        name: [{
          family: 'Doe',
          given: ['John']
        }]
      },
      profileUrl: 'http://hl7.org/fhir/StructureDefinition/Patient',
      context: {
        testMode: true
      }
    };

    console.log('📋 Test resource created:', testResource.resourceType, testResource.resourceId);

    // Test pipeline execution
    const request = {
      resources: [testResource],
      config: {
        enableParallelProcessing: false, // Use sequential for testing
        maxConcurrentValidations: 1,
        defaultTimeoutMs: 30000, // 30 seconds
        enableProgressTracking: true,
        enableResultCaching: false
      },
      context: {
        requestId: 'test-pipeline-001',
        requestedBy: 'test-script',
        metadata: { test: true }
      }
    };

    console.log('🚀 Starting pipeline execution...');
    const startTime = Date.now();

    // Set up progress listener
    pipeline.on('pipelineProgress', (progress) => {
      console.log(`📊 Progress: ${progress.processedResources}/${progress.totalResources} (${progress.status})`);
      console.log(`   Valid: ${progress.validResources}, Errors: ${progress.errorResources}`);
    });

    pipeline.on('resourceProcessed', (event) => {
      console.log(`✅ Resource processed: ${event.resource.resourceType} (${event.resource.resourceId})`);
    });

    pipeline.on('pipelineCompleted', (event) => {
      console.log(`🎉 Pipeline completed: ${event.requestId}`);
    });

    pipeline.on('pipelineFailed', (event) => {
      console.log(`❌ Pipeline failed: ${event.requestId} - ${event.error}`);
    });

    // Execute pipeline
    const result = await pipeline.executePipeline(request);
    const endTime = Date.now();

    console.log('\n📈 Pipeline Results:');
    console.log(`   Status: ${result.status}`);
    console.log(`   Request ID: ${result.requestId}`);
    console.log(`   Total Resources: ${result.summary.totalResources}`);
    console.log(`   Successful: ${result.summary.successfulValidations}`);
    console.log(`   Failed: ${result.summary.failedValidations}`);
    console.log(`   With Errors: ${result.summary.resourcesWithErrors}`);
    console.log(`   With Warnings: ${result.summary.resourcesWithWarnings}`);
    console.log(`   Overall Score: ${result.summary.overallValidationScore.toFixed(2)}%`);
    console.log(`   Total Time: ${result.performance.totalTimeMs}ms`);
    console.log(`   Average Time: ${result.performance.averageValidationTimeMs.toFixed(2)}ms`);
    console.log(`   Throughput: ${result.performance.throughput.toFixed(2)} resources/sec`);

    if (result.results && result.results.length > 0) {
      console.log('\n📋 Individual Results:');
      result.results.forEach((res, index) => {
        console.log(`   ${index + 1}. ${res.resourceType} (${res.resourceId})`);
        console.log(`      Valid: ${res.isValid}`);
        console.log(`      Score: ${res.summary.validationScore}%`);
        console.log(`      Issues: ${res.summary.totalIssues} (${res.summary.errorCount} errors, ${res.summary.warningCount} warnings)`);
        console.log(`      Time: ${res.performance.totalTimeMs}ms`);
        
        if (res.issues && res.issues.length > 0) {
          console.log(`      Issues:`);
          res.issues.forEach(issue => {
            console.log(`        - ${issue.severity.toUpperCase()}: ${issue.code} - ${issue.message}`);
          });
        }
      });
    }

    if (result.error) {
      console.log(`\n❌ Pipeline Error: ${result.error}`);
      return false;
    }

    console.log('\n✅ Pipeline test completed successfully!');
    return true;

  } catch (error) {
    console.error('\n❌ Pipeline test failed:');
    console.error('   Error:', error.message);
    console.error('   Stack:', error.stack);
    return false;
  }
}

// Run the test
testPipeline()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
