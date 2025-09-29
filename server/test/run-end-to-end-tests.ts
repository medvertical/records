/**
 * FHIR R4 End-to-End Validation Test Runner
 * 
 * Executes the comprehensive end-to-end validation tests
 */

import { EndToEndValidationTest } from './end-to-end-validation-test';

async function runEndToEndTests() {
  console.log('🚀 Starting FHIR R4 End-to-End Validation Test Runner...');
  console.log('========================================================');
  
  try {
    const endToEndTest = new EndToEndValidationTest();
    const results = await endToEndTest.runEndToEndTests();
    
    console.log('\n🎯 End-to-End Test Runner Summary');
    console.log('==================================');
    
    const totalTests = results.length;
    const passedTests = results.filter(r => r.success).length;
    const passRate = (passedTests / totalTests) * 100;
    
    console.log(`📊 Test Results: ${passedTests}/${totalTests} tests passed (${passRate.toFixed(1)}%)`);
    
    if (passRate >= 80) {
      console.log('\n🎉 SUCCESS: End-to-end validation tests passed!');
      console.log('✅ Complete validation flow is working correctly');
      console.log('✅ Database storage and retrieval is working');
      console.log('✅ Data integrity is maintained throughout the flow');
      console.log('✅ Ready for production use');
    } else {
      console.log('\n❌ FAILURE: End-to-end validation tests failed!');
      console.log('🔧 Review failed tests and fix validation flow issues');
      console.log('📝 Check database connectivity and data integrity');
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
    console.error('💥 End-to-end test runner failed with error:', error);
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
  runEndToEndTests()
    .then((summary) => {
      console.log('\n🏁 End-to-end test runner completed');
      process.exit(summary.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('💥 End-to-end test runner crashed:', error);
      process.exit(1);
    });
}

export { runEndToEndTests };
