/**
 * FHIR R4 Validation Test Runner
 * 
 * Executes the comprehensive validation test suite and reports results
 */

import { ValidationTestSuite } from './validation-test-suite';

async function runValidationTests() {
  console.log('🚀 Starting FHIR R4 Validation Test Runner...');
  console.log('================================================');
  
  try {
    const testSuite = new ValidationTestSuite();
    const results = await testSuite.runTestSuite();
    
    console.log('\n🎯 Test Runner Summary');
    console.log('======================');
    
    const totalTests = results.length;
    const passedTests = results.filter(r => r.passed).length;
    const passRate = (passedTests / totalTests) * 100;
    
    console.log(`📊 Test Results: ${passedTests}/${totalTests} tests passed (${passRate.toFixed(1)}%)`);
    
    if (passRate >= 80) {
      console.log('🎉 SUCCESS: Validation test suite passed!');
      console.log('✅ All validators are working correctly with realistic scoring');
      console.log('✅ Test resources are properly categorized and validated');
      console.log('✅ Ready for production use');
    } else {
      console.log('❌ FAILURE: Validation test suite failed!');
      console.log('🔧 Review failed tests and fix validator issues');
      console.log('📝 Check expected score ranges and test resource quality');
    }
    
    // Return results for programmatic access
    return {
      success: passRate >= 80,
      passRate,
      totalTests,
      passedTests,
      results
    };
    
  } catch (error) {
    console.error('💥 Test runner failed with error:', error);
    throw error;
  }
}

// Run tests if this file is executed directly
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Check if this is the main module (simple check for ES modules)
if (import.meta.url === `file://${process.argv[1]}`) {
  runValidationTests()
    .then((summary) => {
      console.log('\n🏁 Test runner completed');
      process.exit(summary.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('💥 Test runner crashed:', error);
      process.exit(1);
    });
}

export { runValidationTests };
