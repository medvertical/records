/**
 * Terminology Server Tester
 * 
 * Tests and evaluates FHIR terminology servers for:
 * - Availability and response time
 * - FHIR capabilities (CapabilityStatement)
 * - ValueSet expansion
 * - CodeSystem lookup
 * - Validation operations
 * - Overall quality and performance
 */

import axios, { AxiosError } from 'axios';

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  details?: string;
  error?: string;
}

interface ServerReport {
  serverUrl: string;
  timestamp: string;
  results: TestResult[];
  overallScore: number;
  recommendation: string;
}

class TerminologyServerTester {
  private serverUrl: string;
  private results: TestResult[] = [];

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  /**
   * Run all tests and generate report
   */
  async runAllTests(): Promise<ServerReport> {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Testing Terminology Server: ${this.serverUrl}`);
    console.log(`${'='.repeat(80)}\n`);

    // Run all tests
    await this.testConnectivity();
    await this.testCapabilityStatement();
    await this.testValueSetExpansion();
    await this.testCodeSystemLookup();
    await this.testValidateCode();
    await this.testCommonValueSets();

    // Generate report
    return this.generateReport();
  }

  /**
   * Test 1: Basic Connectivity
   */
  private async testConnectivity(): Promise<void> {
    const testName = 'Basic Connectivity';
    console.log(`\n📡 Test: ${testName}`);
    const startTime = Date.now();

    try {
      const response = await axios.get(`${this.serverUrl}/metadata`, {
        timeout: 10000,
        headers: { 'Accept': 'application/fhir+json' }
      });

      const duration = Date.now() - startTime;
      const passed = response.status === 200;

      this.results.push({
        name: testName,
        passed,
        duration,
        details: `Status: ${response.status}, Response time: ${duration}ms`
      });

      console.log(`   ✅ Connected successfully (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      
      this.results.push({
        name: testName,
        passed: false,
        duration,
        error: errorMsg
      });

      console.log(`   ❌ Connection failed: ${errorMsg}`);
    }
  }

  /**
   * Test 2: CapabilityStatement (Server Metadata)
   */
  private async testCapabilityStatement(): Promise<void> {
    const testName = 'CapabilityStatement';
    console.log(`\n📋 Test: ${testName}`);
    const startTime = Date.now();

    try {
      const response = await axios.get(`${this.serverUrl}/metadata`, {
        timeout: 10000,
        headers: { 'Accept': 'application/fhir+json' }
      });

      const duration = Date.now() - startTime;
      const capability = response.data;

      if (capability.resourceType !== 'CapabilityStatement') {
        throw new Error('Invalid CapabilityStatement response');
      }

      const fhirVersion = capability.fhirVersion;
      const software = capability.software?.name || 'Unknown';
      const version = capability.software?.version || 'Unknown';
      
      // Check for terminology operations
      const operations = capability.rest?.[0]?.operation || [];
      const terminologyOps = operations.filter((op: any) => 
        ['expand', 'validate-code', 'lookup', 'translate', 'subsumes'].includes(op.name)
      );

      this.results.push({
        name: testName,
        passed: true,
        duration,
        details: `FHIR ${fhirVersion}, ${software} ${version}, ${terminologyOps.length} terminology operations`
      });

      console.log(`   ✅ FHIR Version: ${fhirVersion}`);
      console.log(`   ✅ Software: ${software} ${version}`);
      console.log(`   ✅ Terminology Operations: ${terminologyOps.map((op: any) => op.name).join(', ')}`);
      console.log(`   ⏱️  Response time: ${duration}ms`);
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      
      this.results.push({
        name: testName,
        passed: false,
        duration,
        error: errorMsg
      });

      console.log(`   ❌ Failed: ${errorMsg}`);
    }
  }

  /**
   * Test 3: ValueSet Expansion
   */
  private async testValueSetExpansion(): Promise<void> {
    const testName = 'ValueSet Expansion';
    console.log(`\n🔍 Test: ${testName}`);
    const startTime = Date.now();

    try {
      // Test with a common FHIR ValueSet (administrative-gender)
      const valueSetUrl = 'http://hl7.org/fhir/ValueSet/administrative-gender';
      const response = await axios.get(
        `${this.serverUrl}/ValueSet/$expand`,
        {
          params: { url: valueSetUrl },
          timeout: 15000,
          headers: { 'Accept': 'application/fhir+json' }
        }
      );

      const duration = Date.now() - startTime;
      const expansion = response.data;

      if (expansion.resourceType !== 'ValueSet') {
        throw new Error('Invalid ValueSet response');
      }

      const conceptCount = expansion.expansion?.contains?.length || 0;

      this.results.push({
        name: testName,
        passed: conceptCount > 0,
        duration,
        details: `Expanded ${conceptCount} concepts from ${valueSetUrl}`
      });

      console.log(`   ✅ Expanded ${conceptCount} concepts`);
      console.log(`   ⏱️  Response time: ${duration}ms`);
      
      if (conceptCount > 0) {
        const sampleCodes = expansion.expansion.contains.slice(0, 3).map((c: any) => c.code);
        console.log(`   📝 Sample codes: ${sampleCodes.join(', ')}`);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = this.formatError(error);
      
      this.results.push({
        name: testName,
        passed: false,
        duration,
        error: errorMsg
      });

      console.log(`   ❌ Failed: ${errorMsg}`);
    }
  }

  /**
   * Test 4: CodeSystem Lookup
   */
  private async testCodeSystemLookup(): Promise<void> {
    const testName = 'CodeSystem Lookup';
    console.log(`\n🔎 Test: ${testName}`);
    const startTime = Date.now();

    try {
      // Test lookup for a common SNOMED CT code (if available)
      const response = await axios.get(
        `${this.serverUrl}/CodeSystem/$lookup`,
        {
          params: {
            system: 'http://snomed.info/sct',
            code: '38341003', // Hypertension
          },
          timeout: 15000,
          headers: { 'Accept': 'application/fhir+json' },
          validateStatus: (status) => status < 500 // Accept 4xx as they're informative
        }
      );

      const duration = Date.now() - startTime;

      if (response.status === 200 && response.data.resourceType === 'Parameters') {
        const params = response.data.parameter || [];
        const display = params.find((p: any) => p.name === 'display')?.valueString;
        
        this.results.push({
          name: testName,
          passed: true,
          duration,
          details: display ? `Found: "${display}"` : 'Lookup successful'
        });

        console.log(`   ✅ Lookup successful${display ? `: "${display}"` : ''}`);
        console.log(`   ⏱️  Response time: ${duration}ms`);
      } else if (response.status === 404 || response.status === 400) {
        // SNOMED might not be loaded, try LOINC
        await this.testLoincLookup();
      } else {
        throw new Error(`Unexpected status: ${response.status}`);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      // Try LOINC as fallback
      await this.testLoincLookup();
    }
  }

  /**
   * Fallback test for LOINC lookup
   */
  private async testLoincLookup(): Promise<void> {
    try {
      const response = await axios.get(
        `${this.serverUrl}/CodeSystem/$lookup`,
        {
          params: {
            system: 'http://loinc.org',
            code: '8867-4', // Heart rate
          },
          timeout: 15000,
          headers: { 'Accept': 'application/fhir+json' }
        }
      );

      const duration = Date.now() - response.config.timeout!;
      const params = response.data.parameter || [];
      const display = params.find((p: any) => p.name === 'display')?.valueString;

      console.log(`   ✅ LOINC lookup successful${display ? `: "${display}"` : ''}`);
    } catch (error) {
      const errorMsg = this.formatError(error);
      console.log(`   ⚠️  CodeSystem lookup limited: ${errorMsg}`);
    }
  }

  /**
   * Test 5: Validate Code
   */
  private async testValidateCode(): Promise<void> {
    const testName = 'Validate Code';
    console.log(`\n✓ Test: ${testName}`);
    const startTime = Date.now();

    try {
      const response = await axios.get(
        `${this.serverUrl}/ValueSet/$validate-code`,
        {
          params: {
            url: 'http://hl7.org/fhir/ValueSet/administrative-gender',
            code: 'male',
            system: 'http://hl7.org/fhir/administrative-gender'
          },
          timeout: 15000,
          headers: { 'Accept': 'application/fhir+json' }
        }
      );

      const duration = Date.now() - startTime;
      const params = response.data;

      if (params.resourceType !== 'Parameters') {
        throw new Error('Invalid validation response');
      }

      const result = params.parameter?.find((p: any) => p.name === 'result')?.valueBoolean;
      const display = params.parameter?.find((p: any) => p.name === 'display')?.valueString;

      this.results.push({
        name: testName,
        passed: result === true,
        duration,
        details: `Validated "male" code${display ? ` (${display})` : ''}`
      });

      console.log(`   ✅ Validation ${result ? 'passed' : 'failed'}${display ? `: "${display}"` : ''}`);
      console.log(`   ⏱️  Response time: ${duration}ms`);
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = this.formatError(error);
      
      this.results.push({
        name: testName,
        passed: false,
        duration,
        error: errorMsg
      });

      console.log(`   ❌ Failed: ${errorMsg}`);
    }
  }

  /**
   * Test 6: Common ValueSets availability
   */
  private async testCommonValueSets(): Promise<void> {
    const testName = 'Common ValueSets';
    console.log(`\n📚 Test: ${testName}`);

    const commonValueSets = [
      'http://hl7.org/fhir/ValueSet/observation-status',
      'http://hl7.org/fhir/ValueSet/condition-clinical',
      'http://hl7.org/fhir/ValueSet/allergyintolerance-clinical',
    ];

    let successCount = 0;
    const startTime = Date.now();

    for (const vsUrl of commonValueSets) {
      try {
        const response = await axios.get(
          `${this.serverUrl}/ValueSet/$expand`,
          {
            params: { url: vsUrl, count: 1 },
            timeout: 10000,
            headers: { 'Accept': 'application/fhir+json' }
          }
        );

        if (response.status === 200) {
          successCount++;
          console.log(`   ✅ ${vsUrl.split('/').pop()}`);
        }
      } catch (error) {
        console.log(`   ⚠️  ${vsUrl.split('/').pop()} - ${this.formatError(error)}`);
      }
    }

    const duration = Date.now() - startTime;
    this.results.push({
      name: testName,
      passed: successCount > 0,
      duration,
      details: `${successCount}/${commonValueSets.length} ValueSets available`
    });
  }

  /**
   * Generate final report with scoring
   */
  private generateReport(): ServerReport {
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.passed).length;
    const avgResponseTime = this.results.reduce((sum, r) => sum + r.duration, 0) / totalTests;

    // Calculate score (0-100)
    const successRate = (passedTests / totalTests) * 100;
    const performanceScore = Math.max(0, 100 - (avgResponseTime / 50)); // Penalty for slow responses
    const overallScore = (successRate * 0.7) + (performanceScore * 0.3);

    // Generate recommendation
    let recommendation = '';
    if (overallScore >= 80) {
      recommendation = '✅ EXCELLENT - Highly recommended for production use';
    } else if (overallScore >= 60) {
      recommendation = '⚠️  GOOD - Suitable for most use cases with minor limitations';
    } else if (overallScore >= 40) {
      recommendation = '⚠️  FAIR - Usable but with significant limitations';
    } else {
      recommendation = '❌ POOR - Not recommended for production use';
    }

    return {
      serverUrl: this.serverUrl,
      timestamp: new Date().toISOString(),
      results: this.results,
      overallScore: Math.round(overallScore),
      recommendation
    };
  }

  /**
   * Format error messages
   */
  private formatError(error: unknown): string {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      if (axiosError.response) {
        return `HTTP ${axiosError.response.status}: ${axiosError.response.statusText}`;
      } else if (axiosError.code === 'ECONNABORTED') {
        return 'Request timeout';
      } else if (axiosError.code === 'ENOTFOUND') {
        return 'Server not found';
      }
      return axiosError.message;
    }
    return error instanceof Error ? error.message : 'Unknown error';
  }
}

/**
 * Print detailed report
 */
function printReport(report: ServerReport): void {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`TERMINOLOGY SERVER EVALUATION REPORT`);
  console.log(`${'='.repeat(80)}`);
  console.log(`\nServer: ${report.serverUrl}`);
  console.log(`Tested: ${new Date(report.timestamp).toLocaleString()}`);
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`TEST RESULTS`);
  console.log(`${'─'.repeat(80)}\n`);

  for (const result of report.results) {
    const status = result.passed ? '✅' : '❌';
    console.log(`${status} ${result.name}`);
    console.log(`   Duration: ${result.duration}ms`);
    if (result.details) {
      console.log(`   Details: ${result.details}`);
    }
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    console.log();
  }

  const passedCount = report.results.filter(r => r.passed).length;
  const totalCount = report.results.length;
  const avgTime = Math.round(
    report.results.reduce((sum, r) => sum + r.duration, 0) / totalCount
  );

  console.log(`${'─'.repeat(80)}`);
  console.log(`SUMMARY`);
  console.log(`${'─'.repeat(80)}\n`);
  console.log(`Tests Passed: ${passedCount}/${totalCount} (${Math.round((passedCount/totalCount)*100)}%)`);
  console.log(`Average Response Time: ${avgTime}ms`);
  console.log(`Overall Score: ${report.overallScore}/100`);
  console.log(`\n${report.recommendation}\n`);
  console.log(`${'='.repeat(80)}\n`);
}

/**
 * Main execution
 */
async function main() {
  const serverUrl = process.argv[2] || 'https://r5.ontoserver.csiro.au/fhir';
  
  console.log('FHIR Terminology Server Tester');
  console.log('Testing server quality, capabilities, and performance\n');

  const tester = new TerminologyServerTester(serverUrl);
  const report = await tester.runAllTests();
  printReport(report);

  // Exit with appropriate code
  process.exit(report.overallScore >= 60 ? 0 : 1);
}

// Run main
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

export { TerminologyServerTester, ServerReport, TestResult };

