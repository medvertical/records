import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Play, Loader2, CheckCircle, AlertCircle, XCircle, AlertTriangle, Info } from 'lucide-react';

interface Rule {
  id: number;
  ruleId: string;
  name: string;
  description?: string | null;
  expression: string;
  resourceTypes: string[];
  severity: 'error' | 'warning' | 'information';
  enabled: boolean;
}

interface RuleEditorModalProps {
  open: boolean;
  onClose: () => void;
  rule: Rule | null;
  onSave: () => void;
}

const FHIR_RESOURCE_TYPES = [
  'Patient', 'Observation', 'Condition', 'Encounter', 'Procedure',
  'Medication', 'MedicationRequest', 'DiagnosticReport', 'AllergyIntolerance',
  'Immunization', 'CarePlan', 'Goal', 'ServiceRequest', 'Practitioner',
  'Organization', 'Location', 'Device', 'Specimen', 'DocumentReference'
];

export function RuleEditorModal({ open, onClose, rule, onSave }: RuleEditorModalProps) {
  const { toast } = useToast();
  const isEditMode = !!rule;

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [severity, setSeverity] = useState<'error' | 'warning' | 'information'>('warning');
  const [expression, setExpression] = useState('');
  const [enabled, setEnabled] = useState(true);

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean;
    errors?: string[];
    warnings?: string[];
  } | null>(null);

  // Populate form when editing
  useEffect(() => {
    if (rule) {
      setName(rule.name);
      setDescription(rule.description || '');
      setResourceType(rule.resourceTypes && rule.resourceTypes.length > 0 ? rule.resourceTypes[0] : '');
      setSeverity(rule.severity);
      setExpression(rule.expression);
      setEnabled(rule.enabled);
    } else {
      // Reset form for new rule
      setName('');
      setDescription('');
      setResourceType('');
      setSeverity('warning');
      setExpression('');
      setEnabled(true);
    }
    setValidationResult(null);
  }, [rule, open]);

  const handleTestExpression = async () => {
    if (!expression.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a FHIRPath expression to test',
        variant: 'destructive',
      });
      return;
    }

    setIsTesting(true);
    setValidationResult(null);

    try {
      const response = await fetch('/api/validation/business-rules/validate-expression', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expression }),
      });

      if (!response.ok) {
        throw new Error('Failed to validate expression');
      }

      const result = await response.json();
      setValidationResult(result);

      if (result.isValid) {
        toast({
          title: 'Expression Valid',
          description: 'FHIRPath expression syntax is correct',
        });
      } else {
        toast({
          title: 'Expression Invalid',
          description: 'FHIRPath expression has syntax errors',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error testing expression:', error);
      toast({
        title: 'Error',
        description: 'Failed to validate expression',
        variant: 'destructive',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const validateForm = (): string | null => {
    if (!name.trim() || name.trim().length < 3) {
      return 'Name is required and must be at least 3 characters';
    }
    if (!resourceType) {
      return 'Resource type is required';
    }
    if (!expression.trim()) {
      return 'FHIRPath expression is required';
    }
    return null;
  };

  const handleSave = async () => {
    const validationError = validateForm();
    if (validationError) {
      toast({
        title: 'Validation Error',
        description: validationError,
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        expression: expression.trim(),
        severity,
        resourceTypes: [resourceType],
        enabled,
        ruleId: isEditMode ? rule.ruleId : `rule-${Date.now()}`,
      };

      const url = isEditMode
        ? `/api/validation/business-rules/${rule.id}`
        : '/api/validation/business-rules';
      
      const method = isEditMode ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to ${isEditMode ? 'update' : 'create'} rule`);
      }

      toast({
        title: 'Success',
        description: `Rule ${isEditMode ? 'updated' : 'created'} successfully`,
      });

      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving rule:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save rule',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getSeverityBadge = (sev: 'error' | 'warning' | 'information') => {
    switch (sev) {
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-500 hover:bg-yellow-600">Warning</Badge>;
      case 'information':
        return <Badge variant="secondary">Info</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Rule' : 'Create New Rule'}</DialogTitle>
          <DialogDescription>
            Define a FHIRPath expression that will be evaluated during validation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">
              Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter rule name"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={2}
            />
          </div>

          {/* Resource Type */}
          <div className="space-y-2">
            <Label htmlFor="resourceType">
              Resource Type <span className="text-red-500">*</span>
            </Label>
            <Select value={resourceType} onValueChange={setResourceType}>
              <SelectTrigger>
                <SelectValue placeholder="Select resource type" />
              </SelectTrigger>
              <SelectContent>
                {FHIR_RESOURCE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Severity */}
          <div className="space-y-2">
            <Label htmlFor="severity">
              Severity <span className="text-red-500">*</span>
            </Label>
            <Select value={severity} onValueChange={(v) => setSeverity(v as any)}>
              <SelectTrigger>
                <SelectValue>
                  <div className="flex items-center gap-2">
                    {severity === 'error' && <XCircle className="h-3.5 w-3.5 text-red-600" />}
                    {severity === 'warning' && <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />}
                    {severity === 'information' && <Info className="h-3.5 w-3.5 text-blue-500" />}
                    <span>{severity === 'error' ? 'Error' : severity === 'warning' ? 'Warning' : 'Info'}</span>
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="error">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-3.5 w-3.5 text-red-600" />
                    <span>Error</span>
                  </div>
                </SelectItem>
                <SelectItem value="warning">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                    <span>Warning</span>
                  </div>
                </SelectItem>
                <SelectItem value="information">
                  <div className="flex items-center gap-2">
                    <Info className="h-3.5 w-3.5 text-blue-500" />
                    <span>Info</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* FHIRPath Expression */}
          <div className="space-y-2">
            <Label htmlFor="expression">
              FHIRPath Expression <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="expression"
              value={expression}
              onChange={(e) => setExpression(e.target.value)}
              placeholder="Enter FHIRPath expression (e.g., Patient.name.exists())"
              rows={4}
              className="font-mono text-sm"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestExpression}
              disabled={isTesting || !expression.trim()}
            >
              {isTesting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Test Expression
                </>
              )}
            </Button>
          </div>

          {/* Validation Result */}
          {validationResult && (
            <Alert variant={validationResult.isValid ? 'default' : 'destructive'}>
              {validationResult.isValid ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription>
                {validationResult.isValid ? (
                  <span className="font-medium">Expression is valid!</span>
                ) : (
                  <div>
                    <span className="font-medium">Expression has errors:</span>
                    <ul className="list-disc list-inside mt-2">
                      {validationResult.errors?.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {validationResult.warnings && validationResult.warnings.length > 0 && (
                  <div className="mt-2">
                    <span className="font-medium">Warnings:</span>
                    <ul className="list-disc list-inside mt-1">
                      {validationResult.warnings.map((warn, idx) => (
                        <li key={idx}>{warn}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Enabled */}
          <div className="flex items-center gap-3">
            <Switch
              id="enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
            <Label htmlFor="enabled" className="cursor-pointer">
              Rule is {enabled ? 'enabled' : 'disabled'}
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>{isEditMode ? 'Update Rule' : 'Create Rule'}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

