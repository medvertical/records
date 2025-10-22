import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

// ============================================================================
// FHIR Field Templates
// ============================================================================

interface FhirTemplate {
  name: string;
  description: string;
  value: any;
}

const FHIR_TEMPLATES: Record<string, FhirTemplate[]> = {
  name: [
    {
      name: 'Empty Array',
      description: 'An empty array to add names later',
      value: [],
    },
    {
      name: 'Single HumanName',
      description: 'Single name with structure for family and given names',
      value: [{ use: 'official', family: '', given: [''] }],
    },
    {
      name: 'Multiple Names',
      description: 'Array with official and nickname structures',
      value: [
        { use: 'official', family: '', given: [''] },
        { use: 'nickname', given: [''] },
      ],
    },
  ],
  identifier: [
    {
      name: 'Empty Array',
      description: 'An empty array to add identifiers later',
      value: [],
    },
    {
      name: 'Single Identifier',
      description: 'Single identifier with system and value',
      value: [{ system: '', value: '' }],
    },
  ],
  address: [
    {
      name: 'Empty Array',
      description: 'An empty array to add addresses later',
      value: [],
    },
    {
      name: 'Single Address',
      description: 'Single address with common fields',
      value: [{ use: 'home', line: [''], city: '', postalCode: '', country: '' }],
    },
  ],
  telecom: [
    {
      name: 'Empty Array',
      description: 'An empty array to add contact points later',
      value: [],
    },
    {
      name: 'Phone Number',
      description: 'Phone contact point',
      value: [{ system: 'phone', value: '', use: 'mobile' }],
    },
    {
      name: 'Email',
      description: 'Email contact point',
      value: [{ system: 'email', value: '' }],
    },
  ],
  contact: [
    {
      name: 'Empty Array',
      description: 'An empty array to add contacts later',
      value: [],
    },
    {
      name: 'Emergency Contact',
      description: 'Emergency contact with relationship and name',
      value: [
        {
          relationship: [{ coding: [{ system: '', code: '', display: '' }] }],
          name: { family: '', given: [''] },
          telecom: [{ system: 'phone', value: '' }],
        },
      ],
    },
  ],
};

// ============================================================================
// Component
// ============================================================================

interface CreateFieldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fieldName: string;
  onConfirm: (fieldName: string, value: any) => void;
}

export default function CreateFieldDialog({
  open,
  onOpenChange,
  fieldName,
  onConfirm,
}: CreateFieldDialogProps) {
  const [selectedType, setSelectedType] = useState<string>('string');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('0');

  // Check if this field has FHIR templates
  const hasTemplates = fieldName.toLowerCase() in FHIR_TEMPLATES;
  const templates = hasTemplates ? FHIR_TEMPLATES[fieldName.toLowerCase()] : [];

  const handleConfirm = () => {
    let value: any;

    if (hasTemplates && selectedType === 'fhir-template') {
      // Use FHIR template
      const templateIndex = parseInt(selectedTemplate);
      value = templates[templateIndex]?.value;
    } else {
      // Use basic type
      switch (selectedType) {
        case 'string':
          value = '';
          break;
        case 'number':
          value = 0;
          break;
        case 'boolean':
          value = false;
          break;
        case 'null':
          value = null;
          break;
        case 'array':
          value = [];
          break;
        case 'object':
          value = {};
          break;
        default:
          value = '';
      }
    }

    onConfirm(fieldName, value);
    onOpenChange(false);
    // Reset for next time
    setSelectedType('string');
    setSelectedTemplate('0');
  };

  const handleCancel = () => {
    onOpenChange(false);
    // Reset for next time
    setSelectedType('string');
    setSelectedTemplate('0');
  };

  // Get preview of what will be created
  const getPreview = () => {
    if (hasTemplates && selectedType === 'fhir-template') {
      const templateIndex = parseInt(selectedTemplate);
      const template = templates[templateIndex];
      return JSON.stringify(template?.value, null, 2);
    }

    switch (selectedType) {
      case 'string':
        return '""';
      case 'number':
        return '0';
      case 'boolean':
        return 'false';
      case 'null':
        return 'null';
      case 'array':
        return '[]';
      case 'object':
        return '{}';
      default:
        return '""';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Field: {fieldName}</DialogTitle>
          <DialogDescription>
            Choose the type and initial value for this field. This will add the field to your resource.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Type Selection */}
          <div className="space-y-2">
            <Label>Field Type</Label>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {hasTemplates && (
                  <SelectItem value="fhir-template">
                    <div className="flex items-center gap-2">
                      <span>FHIR Template</span>
                      <Badge className="text-xs bg-blue-100 text-blue-800 border-0">Recommended</Badge>
                    </div>
                  </SelectItem>
                )}
                <SelectItem value="string">String</SelectItem>
                <SelectItem value="number">Number</SelectItem>
                <SelectItem value="boolean">Boolean</SelectItem>
                <SelectItem value="array">Array (empty)</SelectItem>
                <SelectItem value="object">Object (empty)</SelectItem>
                <SelectItem value="null">Null</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Template Selection (if FHIR templates available) */}
          {hasTemplates && selectedType === 'fhir-template' && (
            <div className="space-y-2">
              <Label>Template</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template, index) => (
                    <SelectItem key={index} value={String(index)}>
                      <div>
                        <div className="font-medium">{template.name}</div>
                        <div className="text-xs text-gray-500">{template.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Preview */}
          <div className="space-y-2">
            <Label>Preview</Label>
            <div className="border rounded-md p-3 bg-gray-50">
              <pre className="text-xs font-mono overflow-x-auto">{getPreview()}</pre>
            </div>
          </div>

          {/* FHIR Hint */}
          {hasTemplates && (
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <div className="text-xs text-blue-800">
                <strong>💡 FHIR Hint:</strong> The field <code className="px-1 py-0.5 bg-blue-100 rounded">{fieldName}</code> has predefined FHIR templates that match the expected structure for this resource type.
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>Create Field</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

