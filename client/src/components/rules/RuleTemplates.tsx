/**
 * Rule Templates Component
 * Task 9.6: Add rule templates for common validation patterns
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  FileTemplate,
  Wand2,
  Info,
  ArrowRight,
} from 'lucide-react';
import { BusinessRule } from './BusinessRuleEditor';

/**
 * Template types
 */
export type RuleTemplateType =
  | 'required-field'
  | 'conditional-logic'
  | 'cross-field-validation'
  | 'value-range'
  | 'collection-validation'
  | 'reference-validation'
  | 'date-comparison'
  | 'string-pattern';

/**
 * Template definition
 */
export interface RuleTemplate {
  id: RuleTemplateType;
  name: string;
  description: string;
  icon?: string;
  parameters: TemplateParameter[];
  generateExpression: (params: Record<string, string>) => string;
  generateName: (params: Record<string, string>) => string;
  generateDescription: (params: Record<string, string>) => string;
  exampleParams: Record<string, string>;
}

/**
 * Template parameter definition
 */
export interface TemplateParameter {
  name: string;
  label: string;
  type: 'text' | 'select' | 'number';
  options?: string[];
  placeholder?: string;
  required?: boolean;
  helpText?: string;
}

/**
 * Pre-defined rule templates
 */
export const RULE_TEMPLATES: Record<RuleTemplateType, RuleTemplate> = {
  'required-field': {
    id: 'required-field',
    name: 'Required Field',
    description: 'Check if a field exists and is not empty',
    icon: '✓',
    parameters: [
      {
        name: 'fieldPath',
        label: 'Field Path',
        type: 'text',
        placeholder: 'e.g., name, identifier, status',
        required: true,
        helpText: 'The path to the field to check (e.g., name, name.family, identifier)',
      },
    ],
    generateExpression: (params) => `${params.fieldPath}.exists()`,
    generateName: (params) => `${params.fieldPath} is required`,
    generateDescription: (params) =>
      `Validates that ${params.fieldPath} field exists and is not empty`,
    exampleParams: {
      fieldPath: 'name',
    },
  },

  'conditional-logic': {
    id: 'conditional-logic',
    name: 'Conditional Logic (If-Then)',
    description: 'If condition A is true, then condition B must be true',
    icon: '→',
    parameters: [
      {
        name: 'condition',
        label: 'If Condition',
        type: 'text',
        placeholder: 'e.g., status = \'active\'',
        required: true,
        helpText: 'The condition that triggers the requirement',
      },
      {
        name: 'requirement',
        label: 'Then Requirement',
        type: 'text',
        placeholder: 'e.g., effectiveDateTime.exists()',
        required: true,
        helpText: 'What must be true when the condition is met',
      },
    ],
    generateExpression: (params) =>
      `${params.condition} implies ${params.requirement}`,
    generateName: (params) =>
      `If ${params.condition}, then ${params.requirement}`,
    generateDescription: (params) =>
      `When ${params.condition}, the resource must satisfy: ${params.requirement}`,
    exampleParams: {
      condition: 'status = \'active\'',
      requirement: 'dosageInstruction.exists()',
    },
  },

  'cross-field-validation': {
    id: 'cross-field-validation',
    name: 'Cross-Field Validation',
    description: 'Compare or relate values between two fields',
    icon: '↔',
    parameters: [
      {
        name: 'field1',
        label: 'First Field',
        type: 'text',
        placeholder: 'e.g., onsetDateTime',
        required: true,
      },
      {
        name: 'operator',
        label: 'Comparison',
        type: 'select',
        options: ['<', '<=', '>', '>=', '=', '!='],
        required: true,
      },
      {
        name: 'field2',
        label: 'Second Field',
        type: 'text',
        placeholder: 'e.g., abatementDateTime',
        required: true,
      },
    ],
    generateExpression: (params) =>
      `${params.field1}.exists() and ${params.field2}.exists() implies ${params.field1} ${params.operator} ${params.field2}`,
    generateName: (params) =>
      `${params.field1} ${params.operator} ${params.field2}`,
    generateDescription: (params) =>
      `Validates that ${params.field1} is ${params.operator} ${params.field2}`,
    exampleParams: {
      field1: 'onsetDateTime',
      operator: '<=',
      field2: 'abatementDateTime',
    },
  },

  'value-range': {
    id: 'value-range',
    name: 'Value Range Check',
    description: 'Validate that a numeric value is within a specified range',
    icon: '≤≥',
    parameters: [
      {
        name: 'fieldPath',
        label: 'Field Path',
        type: 'text',
        placeholder: 'e.g., valueQuantity.value',
        required: true,
      },
      {
        name: 'minValue',
        label: 'Minimum Value',
        type: 'number',
        placeholder: '0',
        required: true,
      },
      {
        name: 'maxValue',
        label: 'Maximum Value',
        type: 'number',
        placeholder: '100',
        required: true,
      },
    ],
    generateExpression: (params) =>
      `${params.fieldPath}.exists() implies (${params.fieldPath} >= ${params.minValue} and ${params.fieldPath} <= ${params.maxValue})`,
    generateName: (params) =>
      `${params.fieldPath} must be between ${params.minValue} and ${params.maxValue}`,
    generateDescription: (params) =>
      `Validates that ${params.fieldPath} is within the range ${params.minValue} to ${params.maxValue}`,
    exampleParams: {
      fieldPath: 'valueQuantity.value',
      minValue: '0',
      maxValue: '200',
    },
  },

  'collection-validation': {
    id: 'collection-validation',
    name: 'Collection Validation',
    description: 'Ensure all items in a collection meet a condition',
    icon: '[]',
    parameters: [
      {
        name: 'collectionPath',
        label: 'Collection Path',
        type: 'text',
        placeholder: 'e.g., identifier, name, telecom',
        required: true,
      },
      {
        name: 'itemCondition',
        label: 'Item Condition',
        type: 'text',
        placeholder: 'e.g., system.exists() and value.exists()',
        required: true,
        helpText: 'Condition that each item must satisfy',
      },
    ],
    generateExpression: (params) =>
      `${params.collectionPath}.all(${params.itemCondition})`,
    generateName: (params) =>
      `All ${params.collectionPath} must satisfy condition`,
    generateDescription: (params) =>
      `Validates that every item in ${params.collectionPath} satisfies: ${params.itemCondition}`,
    exampleParams: {
      collectionPath: 'identifier',
      itemCondition: 'system.exists() and value.exists()',
    },
  },

  'reference-validation': {
    id: 'reference-validation',
    name: 'Reference Validation',
    description: 'Validate reference format and resource type',
    icon: '🔗',
    parameters: [
      {
        name: 'referencePath',
        label: 'Reference Path',
        type: 'text',
        placeholder: 'e.g., subject, performer, requester',
        required: true,
      },
      {
        name: 'expectedType',
        label: 'Expected Resource Type',
        type: 'text',
        placeholder: 'e.g., Patient, Practitioner',
        required: true,
      },
    ],
    generateExpression: (params) =>
      `${params.referencePath}.reference.exists() and ${params.referencePath}.reference.startsWith('${params.expectedType}/')`,
    generateName: (params) =>
      `${params.referencePath} must reference ${params.expectedType}`,
    generateDescription: (params) =>
      `Validates that ${params.referencePath} is a valid reference to a ${params.expectedType} resource`,
    exampleParams: {
      referencePath: 'subject',
      expectedType: 'Patient',
    },
  },

  'date-comparison': {
    id: 'date-comparison',
    name: 'Date Comparison',
    description: 'Compare a date field against current date',
    icon: '📅',
    parameters: [
      {
        name: 'datePath',
        label: 'Date Field',
        type: 'text',
        placeholder: 'e.g., birthDate, effectiveDateTime',
        required: true,
      },
      {
        name: 'comparison',
        label: 'Comparison',
        type: 'select',
        options: ['before today', 'before now', 'after today', 'after now'],
        required: true,
      },
    ],
    generateExpression: (params) => {
      const comparisons: Record<string, string> = {
        'before today': `${params.datePath} <= today()`,
        'before now': `${params.datePath} <= now()`,
        'after today': `${params.datePath} >= today()`,
        'after now': `${params.datePath} >= now()`,
      };
      return `${params.datePath}.exists() implies ${comparisons[params.comparison]}`;
    },
    generateName: (params) =>
      `${params.datePath} must be ${params.comparison}`,
    generateDescription: (params) =>
      `Validates that ${params.datePath} is ${params.comparison}`,
    exampleParams: {
      datePath: 'birthDate',
      comparison: 'before today',
    },
  },

  'string-pattern': {
    id: 'string-pattern',
    name: 'String Pattern Match',
    description: 'Validate string format using regex pattern',
    icon: '.*',
    parameters: [
      {
        name: 'fieldPath',
        label: 'Field Path',
        type: 'text',
        placeholder: 'e.g., identifier.value, telecom.value',
        required: true,
      },
      {
        name: 'pattern',
        label: 'Regex Pattern',
        type: 'text',
        placeholder: 'e.g., ^\\d{3}-\\d{2}-\\d{4}$',
        required: true,
        helpText: 'Regular expression pattern (use \\\\ for backslash)',
      },
      {
        name: 'patternDescription',
        label: 'Pattern Description',
        type: 'text',
        placeholder: 'e.g., SSN format (XXX-XX-XXXX)',
        required: false,
      },
    ],
    generateExpression: (params) =>
      `${params.fieldPath}.exists() implies ${params.fieldPath}.matches('${params.pattern}')`,
    generateName: (params) =>
      `${params.fieldPath} must match pattern${params.patternDescription ? ': ' + params.patternDescription : ''}`,
    generateDescription: (params) =>
      `Validates that ${params.fieldPath} matches the pattern: ${params.pattern}${params.patternDescription ? ' (' + params.patternDescription + ')' : ''}`,
    exampleParams: {
      fieldPath: 'identifier.value',
      pattern: '^\\\\d{3}-\\\\d{2}-\\\\d{4}$',
      patternDescription: 'SSN format (XXX-XX-XXXX)',
    },
  },
};

/**
 * Props for RuleTemplates
 */
interface RuleTemplatesProps {
  onApplyTemplate: (rule: BusinessRule) => void;
  currentResourceTypes?: string[];
}

/**
 * RuleTemplates Component
 * 
 * Provides template-based rule generation with parameterized forms
 */
export function RuleTemplates({
  onApplyTemplate,
  currentResourceTypes = [],
}: RuleTemplatesProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<RuleTemplateType | null>(null);
  const [parameters, setParameters] = useState<Record<string, string>>({});

  /**
   * Get template object
   */
  const template = selectedTemplate ? RULE_TEMPLATES[selectedTemplate] : null;

  /**
   * Reset form
   */
  const resetForm = () => {
    setSelectedTemplate(null);
    setParameters({});
  };

  /**
   * Load example parameters
   */
  const loadExample = () => {
    if (template) {
      setParameters(template.exampleParams);
    }
  };

  /**
   * Update parameter value
   */
  const updateParameter = (name: string, value: string) => {
    setParameters((prev) => ({ ...prev, [name]: value }));
  };

  /**
   * Validate parameters
   */
  const validateParameters = (): boolean => {
    if (!template) return false;

    for (const param of template.parameters) {
      if (param.required && !parameters[param.name]?.trim()) {
        return false;
      }
    }

    return true;
  };

  /**
   * Generate and apply rule from template
   */
  const generateRule = () => {
    if (!template || !validateParameters()) return;

    const generatedRule: BusinessRule = {
      name: template.generateName(parameters),
      description: template.generateDescription(parameters),
      fhirPathExpression: template.generateExpression(parameters),
      resourceTypes: currentResourceTypes.length > 0 ? currentResourceTypes : ['Patient'],
      severity: 'warning',
      enabled: true,
      category: 'Custom',
    };

    onApplyTemplate(generatedRule);
    resetForm();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileTemplate className="h-5 w-5" />
          Rule Templates
        </CardTitle>
        <CardDescription>
          Generate validation rules from templates with custom parameters
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Template selection */}
        {!selectedTemplate ? (
          <div className="space-y-3">
            <Label>Select a Template</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(RULE_TEMPLATES).map(([id, tmpl]) => (
                <button
                  key={id}
                  onClick={() => setSelectedTemplate(id as RuleTemplateType)}
                  className="text-left p-4 border rounded-lg hover:bg-accent hover:border-primary transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">{tmpl.icon}</div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm">{tmpl.name}</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {tmpl.description}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Template header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  <span className="text-xl">{template?.icon}</span>
                  {template?.name}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {template?.description}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={resetForm}>
                Change Template
              </Button>
            </div>

            {/* Parameter form */}
            <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
              {template?.parameters.map((param) => (
                <div key={param.name} className="space-y-2">
                  <Label htmlFor={`param-${param.name}`}>
                    {param.label}
                    {param.required && <span className="text-destructive ml-1">*</span>}
                  </Label>

                  {param.type === 'select' ? (
                    <Select
                      value={parameters[param.name] || ''}
                      onValueChange={(value) => updateParameter(param.name, value)}
                    >
                      <SelectTrigger id={`param-${param.name}`}>
                        <SelectValue placeholder={`Select ${param.label.toLowerCase()}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {param.options?.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id={`param-${param.name}`}
                      type={param.type === 'number' ? 'number' : 'text'}
                      placeholder={param.placeholder}
                      value={parameters[param.name] || ''}
                      onChange={(e) => updateParameter(param.name, e.target.value)}
                    />
                  )}

                  {param.helpText && (
                    <p className="text-xs text-muted-foreground">{param.helpText}</p>
                  )}
                </div>
              ))}

              <Button variant="outline" size="sm" onClick={loadExample} className="w-full">
                Load Example Parameters
              </Button>
            </div>

            {/* Preview */}
            {Object.keys(parameters).length > 0 && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium text-sm">Generated Rule Preview:</p>
                    <div className="space-y-1 text-xs">
                      <div>
                        <span className="text-muted-foreground">Name:</span>
                        <span className="ml-2">{template?.generateName(parameters)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Expression:</span>
                        <code className="ml-2 bg-slate-950 text-slate-50 px-2 py-1 rounded text-xs block mt-1">
                          {template?.generateExpression(parameters)}
                        </code>
                      </div>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
              <Button
                onClick={generateRule}
                disabled={!validateParameters()}
                className="flex-1"
              >
                <Wand2 className="h-4 w-4 mr-1" />
                Generate Rule
              </Button>
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


