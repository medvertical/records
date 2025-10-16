/**
 * Business Rule Editor Component
 * Task 9.1: Design rule editor UI with tabs for rule creation and management
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { FHIRPathEditor, FHIRPATH_EXAMPLES } from './FHIRPathEditor';
import { RuleTester } from './RuleTester';
import { RuleLibrary } from './RuleLibrary';
import { RuleTemplates } from './RuleTemplates';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  AlertCircle,
  Check,
  Code2,
  FileText,
  Info,
  Library,
  Save,
  Settings,
  TestTube,
  Wand2,
  X,
} from 'lucide-react';

/**
 * Business rule interface
 */
export interface BusinessRule {
  id?: string;
  name: string;
  description: string;
  fhirPathExpression: string;
  resourceTypes: string[];
  severity: 'error' | 'warning' | 'info';
  enabled: boolean;
  category?: string;
  version?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Props for the BusinessRuleEditor component
 */
interface BusinessRuleEditorProps {
  rule?: BusinessRule;
  onSave?: (rule: BusinessRule) => void;
  onCancel?: () => void;
  mode?: 'create' | 'edit';
}

/**
 * FHIR resource types for rule targeting
 */
const FHIR_RESOURCE_TYPES = [
  'Patient',
  'Observation',
  'Condition',
  'Procedure',
  'MedicationRequest',
  'AllergyIntolerance',
  'Immunization',
  'DiagnosticReport',
  'Encounter',
  'Practitioner',
  'Organization',
  'Bundle',
  'Composition',
  'DocumentReference',
  'Provenance',
  'Consent',
  'Claim',
  'Coverage',
];

/**
 * Rule categories
 */
const RULE_CATEGORIES = [
  'Required Fields',
  'Data Quality',
  'Business Logic',
  'Terminology',
  'References',
  'Dates & Times',
  'Security & Privacy',
  'Custom',
];

/**
 * BusinessRuleEditor Component
 * 
 * A comprehensive UI for creating and editing FHIRPath business rules
 * with tabs for different configuration aspects.
 */
export function BusinessRuleEditor({
  rule,
  onSave,
  onCancel,
  mode = 'create',
}: BusinessRuleEditorProps) {
  const [formData, setFormData] = useState<BusinessRule>(
    rule || {
      name: '',
      description: '',
      fhirPathExpression: '',
      resourceTypes: [],
      severity: 'warning',
      enabled: true,
      category: 'Custom',
    }
  );

  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('basic');
  const [libraryDialogOpen, setLibraryDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);

  /**
   * Update form field
   */
  const updateField = (field: keyof BusinessRule, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear validation errors when user makes changes
    if (validationErrors.length > 0) {
      setValidationErrors([]);
    }
  };

  /**
   * Toggle resource type selection
   */
  const toggleResourceType = (resourceType: string) => {
    const current = formData.resourceTypes || [];
    const updated = current.includes(resourceType)
      ? current.filter((rt) => rt !== resourceType)
      : [...current, resourceType];
    updateField('resourceTypes', updated);
  };

  /**
   * Validate form before saving
   */
  const validateForm = (): boolean => {
    const errors: string[] = [];

    if (!formData.name.trim()) {
      errors.push('Rule name is required');
    }

    if (!formData.description.trim()) {
      errors.push('Rule description is required');
    }

    if (!formData.fhirPathExpression.trim()) {
      errors.push('FHIRPath expression is required');
    }

    if (formData.resourceTypes.length === 0) {
      errors.push('At least one resource type must be selected');
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  /**
   * Handle save
   */
  const handleSave = () => {
    if (validateForm()) {
      onSave?.(formData);
    }
  };

  /**
   * Handle cancel
   */
  const handleCancel = () => {
    onCancel?.();
  };

  /**
   * Handle rule selection from library
   */
  const handleLibraryRuleSelect = (libraryRule: BusinessRule) => {
    // Merge the library rule into current form data
    setFormData((prev) => ({
      ...prev,
      name: libraryRule.name,
      description: libraryRule.description,
      fhirPathExpression: libraryRule.fhirPathExpression,
      resourceTypes: libraryRule.resourceTypes,
      severity: libraryRule.severity,
      category: libraryRule.category || prev.category,
    }));
    setLibraryDialogOpen(false);
    setActiveTab('expression'); // Switch to expression tab to show the loaded rule
  };

  /**
   * Handle template application
   */
  const handleTemplateApply = (templateRule: BusinessRule) => {
    // Merge the template-generated rule into current form data
    setFormData((prev) => ({
      ...prev,
      name: templateRule.name,
      description: templateRule.description,
      fhirPathExpression: templateRule.fhirPathExpression,
      severity: templateRule.severity,
      category: templateRule.category || prev.category,
      // Keep current resource types since template uses them
    }));
    setTemplateDialogOpen(false);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Code2 className="h-5 w-5" />
          {mode === 'create' ? 'Create Business Rule' : 'Edit Business Rule'}
        </CardTitle>
        <CardDescription>
          Define custom validation rules using FHIRPath expressions
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <ul className="list-disc list-inside space-y-1">
                {validationErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Tabbed Interface */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="basic" className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              Basic
            </TabsTrigger>
            <TabsTrigger value="expression" className="flex items-center gap-1">
              <Code2 className="h-3 w-3" />
              Expression
            </TabsTrigger>
            <TabsTrigger value="target" className="flex items-center gap-1">
              <Settings className="h-3 w-3" />
              Target
            </TabsTrigger>
            <TabsTrigger value="test" className="flex items-center gap-1">
              <TestTube className="h-3 w-3" />
              Test
            </TabsTrigger>
            <TabsTrigger value="advanced" className="flex items-center gap-1">
              <Info className="h-3 w-3" />
              Advanced
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Basic Information */}
          <TabsContent value="basic" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="rule-name">
                Rule Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="rule-name"
                placeholder="e.g., Patient must have name"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                A short, descriptive name for this validation rule
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rule-description">
                Description <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="rule-description"
                placeholder="Describe what this rule validates and why it's important..."
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                rows={4}
              />
              <p className="text-sm text-muted-foreground">
                Detailed explanation of the rule's purpose and expected behavior
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rule-category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => updateField('category', value)}
              >
                <SelectTrigger id="rule-category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {RULE_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rule-severity">Severity</Label>
              <Select
                value={formData.severity}
                onValueChange={(value: 'error' | 'warning' | 'info') =>
                  updateField('severity', value)
                }
              >
                <SelectTrigger id="rule-severity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="error">
                    <span className="flex items-center gap-2">
                      <Badge variant="destructive" className="text-xs">Error</Badge>
                      <span>Validation fails</span>
                    </span>
                  </SelectItem>
                  <SelectItem value="warning">
                    <span className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs bg-yellow-500 text-white">
                        Warning
                      </Badge>
                      <span>Potential issue</span>
                    </span>
                  </SelectItem>
                  <SelectItem value="info">
                    <span className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">Info</Badge>
                      <span>Informational</span>
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="rule-enabled"
                checked={formData.enabled}
                onCheckedChange={(checked) => updateField('enabled', checked)}
              />
              <Label htmlFor="rule-enabled" className="cursor-pointer">
                Enable this rule
              </Label>
            </div>
          </TabsContent>

          {/* Tab 2: FHIRPath Expression */}
          <TabsContent value="expression" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="rule-expression">
                FHIRPath Expression <span className="text-destructive">*</span>
              </Label>
              <FHIRPathEditor
                value={formData.fhirPathExpression}
                onChange={(value) => updateField('fhirPathExpression', value)}
                placeholder="e.g., name.exists() and name.family.exists()"
                minHeight={200}
                maxHeight={400}
                resourceTypes={formData.resourceTypes}
                enableAutocomplete={true}
              />
              <p className="text-sm text-muted-foreground">
                FHIRPath expression that returns true when the resource is valid
              </p>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium">FHIRPath Expression Examples:</p>
                  <div className="space-y-2 mt-2">
                    {Object.entries(FHIRPATH_EXAMPLES).slice(0, 3).map(([key, example]) => (
                      <div key={key} className="text-sm">
                        <button
                          type="button"
                          className="text-primary hover:underline font-medium"
                          onClick={() =>
                            updateField('fhirPathExpression', example.expression)
                          }
                        >
                          {example.label}
                        </button>
                        <p className="text-muted-foreground text-xs mt-0.5">
                          {example.description}
                        </p>
                        <code className="text-xs bg-muted px-1 py-0.5 rounded block mt-1 overflow-x-auto">
                          {example.expression}
                        </code>
                      </div>
                    ))}
                  </div>
                </div>
              </AlertDescription>
            </Alert>

            <div className="flex gap-2 flex-wrap">
              <Dialog open={libraryDialogOpen} onOpenChange={setLibraryDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="default" size="sm" className="flex items-center gap-1">
                    <Library className="h-3 w-3" />
                    Browse Rule Library
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Rule Library</DialogTitle>
                    <DialogDescription>
                      Select a pre-built rule to use as a starting point
                    </DialogDescription>
                  </DialogHeader>
                  <RuleLibrary
                    onSelectRule={handleLibraryRuleSelect}
                    selectedResourceTypes={formData.resourceTypes}
                  />
                </DialogContent>
              </Dialog>

              <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="flex items-center gap-1">
                    <Wand2 className="h-3 w-3" />
                    Use Template
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Rule Templates</DialogTitle>
                    <DialogDescription>
                      Generate a rule from a template with custom parameters
                    </DialogDescription>
                  </DialogHeader>
                  <RuleTemplates
                    onApplyTemplate={handleTemplateApply}
                    currentResourceTypes={formData.resourceTypes}
                  />
                </DialogContent>
              </Dialog>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const examples = Object.values(FHIRPATH_EXAMPLES);
                  const randomExample = examples[Math.floor(Math.random() * examples.length)];
                  updateField('fhirPathExpression', randomExample.expression);
                }}
              >
                Load Random Example
              </Button>
            </div>
          </TabsContent>

          {/* Tab 3: Target Resource Types */}
          <TabsContent value="target" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>
                Target Resource Types <span className="text-destructive">*</span>
              </Label>
              <p className="text-sm text-muted-foreground">
                Select which FHIR resource types this rule applies to
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {FHIR_RESOURCE_TYPES.map((resourceType) => {
                const isSelected = formData.resourceTypes.includes(resourceType);
                return (
                  <Button
                    key={resourceType}
                    variant={isSelected ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => toggleResourceType(resourceType)}
                    className="justify-start"
                  >
                    {isSelected && <Check className="h-3 w-3 mr-1" />}
                    {resourceType}
                  </Button>
                );
              })}
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {formData.resourceTypes.length} resource type(s) selected
              </span>
              <Button
                variant="link"
                size="sm"
                onClick={() => updateField('resourceTypes', [])}
                disabled={formData.resourceTypes.length === 0}
              >
                Clear All
              </Button>
            </div>
          </TabsContent>

          {/* Tab 4: Test Rule */}
          <TabsContent value="test" className="space-y-4 mt-4">
            <RuleTester
              expression={formData.fhirPathExpression}
              resourceTypes={formData.resourceTypes}
              onExpressionChange={(expression) =>
                updateField('fhirPathExpression', expression)
              }
            />
          </TabsContent>

          {/* Tab 5: Advanced Settings */}
          <TabsContent value="advanced" className="space-y-4 mt-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Advanced settings for rule execution and monitoring
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="rule-version">Version</Label>
              <Input
                id="rule-version"
                placeholder="e.g., 1.0.0"
                value={formData.version || ''}
                onChange={(e) => updateField('version', e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Semantic version for tracking rule changes
              </p>
            </div>

            <div className="rounded-lg border p-4 space-y-2">
              <h4 className="font-medium text-sm">Rule Statistics</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Created:</span>
                  <span className="ml-2">
                    {formData.createdAt
                      ? new Date(formData.createdAt).toLocaleDateString()
                      : 'Not saved'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Updated:</span>
                  <span className="ml-2">
                    {formData.updatedAt
                      ? new Date(formData.updatedAt).toLocaleDateString()
                      : 'Not saved'}
                  </span>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 mt-6 pt-6 border-t">
          <Button variant="outline" onClick={handleCancel}>
            <X className="h-4 w-4 mr-1" />
            Cancel
          </Button>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-1" />
            {mode === 'create' ? 'Create Rule' : 'Save Changes'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

