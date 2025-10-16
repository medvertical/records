/**
 * Rule Tester Component
 * Task 9.4: Create rule testing interface for FHIRPath expressions
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  AlertCircle,
  Check,
  FileJson,
  Play,
  RefreshCw,
  TestTube,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Test result interface
 */
interface TestResult {
  success: boolean;
  result?: any;
  error?: string;
  executionTime?: number;
  evaluationResult?: boolean;
  details?: string;
}

/**
 * Sample FHIR resources for testing
 */
const SAMPLE_RESOURCES: Record<string, any> = {
  Patient: {
    resourceType: 'Patient',
    id: 'example',
    meta: {
      versionId: '1',
      lastUpdated: '2024-01-15T10:00:00Z',
    },
    identifier: [
      {
        system: 'http://example.org/fhir/ids',
        value: '12345',
      },
    ],
    active: true,
    name: [
      {
        use: 'official',
        family: 'Doe',
        given: ['John', 'Michael'],
      },
    ],
    telecom: [
      {
        system: 'phone',
        value: '555-1234',
        use: 'home',
      },
      {
        system: 'email',
        value: 'john.doe@example.com',
      },
    ],
    gender: 'male',
    birthDate: '1980-01-15',
    address: [
      {
        use: 'home',
        line: ['123 Main St'],
        city: 'Springfield',
        state: 'IL',
        postalCode: '62701',
        country: 'USA',
      },
    ],
  },
  Observation: {
    resourceType: 'Observation',
    id: 'example',
    meta: {
      versionId: '1',
      lastUpdated: '2024-01-15T14:30:00Z',
    },
    status: 'final',
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'vital-signs',
            display: 'Vital Signs',
          },
        ],
      },
    ],
    code: {
      coding: [
        {
          system: 'http://loinc.org',
          code: '85354-9',
          display: 'Blood pressure',
        },
      ],
    },
    subject: {
      reference: 'Patient/example',
    },
    effectiveDateTime: '2024-01-15T14:30:00Z',
    component: [
      {
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '8480-6',
              display: 'Systolic blood pressure',
            },
          ],
        },
        valueQuantity: {
          value: 120,
          unit: 'mmHg',
          system: 'http://unitsofmeasure.org',
          code: 'mm[Hg]',
        },
      },
      {
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '8462-4',
              display: 'Diastolic blood pressure',
            },
          ],
        },
        valueQuantity: {
          value: 80,
          unit: 'mmHg',
          system: 'http://unitsofmeasure.org',
          code: 'mm[Hg]',
        },
      },
    ],
  },
  MedicationRequest: {
    resourceType: 'MedicationRequest',
    id: 'example',
    meta: {
      versionId: '1',
      lastUpdated: '2024-01-15T09:00:00Z',
    },
    status: 'active',
    intent: 'order',
    medicationCodeableConcept: {
      coding: [
        {
          system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
          code: '197361',
          display: 'Amoxicillin 250 MG',
        },
      ],
    },
    subject: {
      reference: 'Patient/example',
    },
    authoredOn: '2024-01-15T09:00:00Z',
    requester: {
      reference: 'Practitioner/example',
    },
    dosageInstruction: [
      {
        text: 'Take one tablet three times daily',
        timing: {
          repeat: {
            frequency: 3,
            period: 1,
            periodUnit: 'd',
          },
        },
        doseAndRate: [
          {
            doseQuantity: {
              value: 1,
              unit: 'tablet',
            },
          },
        ],
      },
    ],
  },
};

/**
 * Props for RuleTester
 */
interface RuleTesterProps {
  expression: string;
  resourceTypes: string[];
  onExpressionChange?: (expression: string) => void;
}

/**
 * RuleTester Component
 * 
 * Provides an interactive interface for testing FHIRPath expressions
 * against sample FHIR resources
 */
export function RuleTester({
  expression,
  resourceTypes,
  onExpressionChange,
}: RuleTesterProps) {
  const [testResource, setTestResource] = useState<string>(
    resourceTypes.length > 0
      ? JSON.stringify(SAMPLE_RESOURCES[resourceTypes[0]] || {}, null, 2)
      : '{}'
  );
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedResourceType, setSelectedResourceType] = useState<string>(
    resourceTypes[0] || ''
  );

  /**
   * Load sample resource for selected type
   */
  const loadSampleResource = (resourceType: string) => {
    const sample = SAMPLE_RESOURCES[resourceType];
    if (sample) {
      setTestResource(JSON.stringify(sample, null, 2));
      setSelectedResourceType(resourceType);
      setTestResult(null);
    }
  };

  /**
   * Execute FHIRPath expression
   * Note: This is a simulated execution for the UI demo
   * In production, this would call a backend API that uses the fhirpath library
   */
  const executeTest = async () => {
    setIsRunning(true);
    setTestResult(null);

    try {
      // Parse the test resource
      const resource = JSON.parse(testResource);

      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      // In production, this would be:
      // const response = await fetch('/api/validation/test-rule', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ expression, resource }),
      // });
      // const result = await response.json();

      // Simulated result for demo
      const result = simulateFHIRPathExecution(expression, resource);

      setTestResult(result);
    } catch (error: any) {
      setTestResult({
        success: false,
        error: error.message || 'Failed to execute test',
      });
    } finally {
      setIsRunning(false);
    }
  };

  /**
   * Simulate FHIRPath execution (for demo purposes)
   * In production, this would use the actual fhirpath library on the backend
   */
  const simulateFHIRPathExecution = (
    expr: string,
    resource: any
  ): TestResult => {
    const startTime = Date.now();

    try {
      // Simple simulation based on common patterns
      let result: any;
      let evaluationResult = false;

      // exists() check
      if (expr.includes('exists()')) {
        const field = expr.split('.exists()')[0].trim();
        result = evaluateFieldExists(resource, field);
        evaluationResult = result === true;
      }
      // count() check
      else if (expr.includes('count()')) {
        const field = expr.split('.count()')[0].trim();
        const value = getFieldValue(resource, field);
        result = Array.isArray(value) ? value.length : value ? 1 : 0;
        evaluationResult = result > 0;
      }
      // Simple field access
      else if (expr.includes('.') && !expr.includes('(')) {
        result = getFieldValue(resource, expr);
        evaluationResult = !!result;
      }
      // Complex expressions - mark as needing backend
      else {
        return {
          success: true,
          result: 'Complex expression - requires backend evaluation',
          executionTime: Date.now() - startTime,
          evaluationResult: true,
          details: 'This is a demo mode. Full FHIRPath evaluation requires backend API.',
        };
      }

      return {
        success: true,
        result,
        executionTime: Date.now() - startTime,
        evaluationResult,
        details: evaluationResult
          ? 'Expression evaluated to true - rule would pass'
          : 'Expression evaluated to false - rule would fail',
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Execution error',
        executionTime: Date.now() - startTime,
      };
    }
  };

  /**
   * Helper: Check if field exists in resource
   */
  const evaluateFieldExists = (obj: any, path: string): boolean => {
    const value = getFieldValue(obj, path);
    return value !== undefined && value !== null;
  };

  /**
   * Helper: Get field value from nested path
   */
  const getFieldValue = (obj: any, path: string): any => {
    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (current === undefined || current === null) return undefined;
      current = current[part];
    }

    return current;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TestTube className="h-5 w-5" />
          Rule Tester
        </CardTitle>
        <CardDescription>
          Test your FHIRPath expression against sample FHIR resources
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Expression display */}
        <div className="space-y-2">
          <Label>Expression to Test</Label>
          <div className="p-3 bg-slate-950 text-slate-50 rounded-md font-mono text-sm border">
            {expression || 'No expression entered'}
          </div>
        </div>

        <Separator />

        {/* Resource type selector and sample loader */}
        <div className="space-y-2">
          <Label>Test Resource</Label>
          <div className="flex gap-2 flex-wrap">
            {resourceTypes.map((type) => (
              <Button
                key={type}
                variant={selectedResourceType === type ? 'default' : 'outline'}
                size="sm"
                onClick={() => loadSampleResource(type)}
              >
                <FileJson className="h-3 w-3 mr-1" />
                Load {type} Sample
              </Button>
            ))}
          </div>
        </div>

        {/* Resource editor */}
        <Tabs defaultValue="json" className="w-full">
          <TabsList>
            <TabsTrigger value="json">JSON Editor</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>

          <TabsContent value="json" className="space-y-2">
            <Textarea
              value={testResource}
              onChange={(e) => {
                setTestResource(e.target.value);
                setTestResult(null);
              }}
              rows={12}
              className="font-mono text-xs"
              placeholder="Paste or load a FHIR resource JSON..."
            />
          </TabsContent>

          <TabsContent value="preview">
            <div className="border rounded-md p-4 max-h-64 overflow-auto bg-slate-50">
              <pre className="text-xs">
                {testResource
                  ? JSON.stringify(JSON.parse(testResource), null, 2)
                  : 'No resource loaded'}
              </pre>
            </div>
          </TabsContent>
        </Tabs>

        {/* Test button */}
        <div className="flex gap-2">
          <Button
            onClick={executeTest}
            disabled={!expression || !testResource || isRunning}
            className="flex items-center gap-2"
          >
            {isRunning ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Run Test
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setTestResult(null);
              if (selectedResourceType) {
                loadSampleResource(selectedResourceType);
              }
            }}
          >
            Reset
          </Button>
        </div>

        {/* Test results */}
        {testResult && (
          <div className="space-y-2">
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold">Test Results</h4>
                {testResult.success ? (
                  testResult.evaluationResult ? (
                    <Badge className="bg-green-500">
                      <Check className="h-3 w-3 mr-1" />
                      Passed
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-yellow-500 text-white">
                      <X className="h-3 w-3 mr-1" />
                      Failed
                    </Badge>
                  )
                ) : (
                  <Badge variant="destructive">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Error
                  </Badge>
                )}
              </div>

              {testResult.success ? (
                <>
                  <Alert>
                    <AlertDescription>
                      <div className="space-y-2">
                        <p className="font-medium">{testResult.details}</p>
                        <div className="text-sm space-y-1">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Execution Time:</span>
                            <span className="font-mono">{testResult.executionTime}ms</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Result:</span>
                            <span className="font-mono">
                              {JSON.stringify(testResult.result)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                </>
              ) : (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-medium">Execution Error</p>
                    <p className="text-sm mt-1">{testResult.error}</p>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        )}

        {/* Demo notice */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            <strong>Demo Mode:</strong> This tester uses simplified FHIRPath evaluation for
            demonstration. In production, full FHIRPath execution would be performed on the
            backend using the official fhirpath library.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}


