import { useState, useCallback, useEffect } from 'react';
import { AlertCircle, Check, Copy, FileJson, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

// ============================================================================
// Types
// ============================================================================

export interface ResourceEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceType: string;
  resourceId: string;
  initialResource: any;
  onSave: (resource: any) => Promise<void>;
  versionId?: string; // For optimistic concurrency control
}

interface ValidationError {
  path: string;
  message: string;
  line?: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

function validateJSON(json: string): { valid: boolean; errors: ValidationError[]; parsed?: any } {
  const errors: ValidationError[] = [];
  
  // Try to parse JSON
  let parsed: any;
  try {
    parsed = JSON.parse(json);
  } catch (error: any) {
    const match = error.message.match(/position (\d+)/);
    const position = match ? parseInt(match[1]) : 0;
    const lines = json.substring(0, position).split('\n');
    const line = lines.length;
    
    errors.push({
      path: 'root',
      message: error.message,
      line,
    });
    return { valid: false, errors };
  }

  // Validate FHIR resource structure
  if (!parsed || typeof parsed !== 'object') {
    errors.push({
      path: 'root',
      message: 'Resource must be a JSON object',
    });
  }

  if (!parsed.resourceType) {
    errors.push({
      path: 'resourceType',
      message: 'Missing required field: resourceType',
    });
  }

  if (!parsed.id) {
    errors.push({
      path: 'id',
      message: 'Missing required field: id',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    parsed,
  };
}

function formatJSON(obj: any): string {
  return JSON.stringify(obj, null, 2);
}

// ============================================================================
// Main Component
// ============================================================================

export function ResourceEditor({
  open,
  onOpenChange,
  resourceType,
  resourceId,
  initialResource,
  onSave,
  versionId,
}: ResourceEditorProps) {
  const [mode, setMode] = useState<'json' | 'form'>('json');
  const [jsonContent, setJsonContent] = useState('');
  const [validation, setValidation] = useState<{ valid: boolean; errors: ValidationError[] }>({
    valid: true,
    errors: [],
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);

  // Initialize JSON content when resource changes
  useEffect(() => {
    if (open && initialResource) {
      const formatted = formatJSON(initialResource);
      setJsonContent(formatted);
      setHasChanges(false);
      setSaveError(null);
      setValidation({ valid: true, errors: [] });
    }
  }, [open, initialResource]);

  // Validate JSON on change
  useEffect(() => {
    if (jsonContent && jsonContent !== formatJSON(initialResource)) {
      const result = validateJSON(jsonContent);
      setValidation(result);
      setHasChanges(true);
    }
  }, [jsonContent, initialResource]);

  const handleJsonChange = useCallback((value: string) => {
    setJsonContent(value);
    setSaveError(null);
  }, []);

  const handleCopyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(jsonContent);
      setCopiedToClipboard(true);
      setTimeout(() => setCopiedToClipboard(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  }, [jsonContent]);

  const handleFormat = useCallback(() => {
    const result = validateJSON(jsonContent);
    if (result.valid && result.parsed) {
      setJsonContent(formatJSON(result.parsed));
    }
  }, [jsonContent]);

  const handleSave = useCallback(async () => {
    // Validate before saving
    const result = validateJSON(jsonContent);
    if (!result.valid) {
      setValidation(result);
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      await onSave(result.parsed!);
      setHasChanges(false);
      onOpenChange(false);
    } catch (error: any) {
      setSaveError(error.message || 'Failed to save resource');
    } finally {
      setIsSaving(false);
    }
  }, [jsonContent, onSave, onOpenChange]);

  const handleCancel = useCallback(() => {
    if (hasChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to close the editor?'
      );
      if (!confirmed) return;
    }
    onOpenChange(false);
  }, [hasChanges, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <FileJson className="h-5 w-5" />
            <span>Edit Resource</span>
            <Badge variant="secondary" className="font-mono">
              {resourceType}/{resourceId}
            </Badge>
            {versionId && (
              <Badge variant="outline" className="text-xs">
                v{versionId}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Make changes to the FHIR resource. The resource will be validated before saving.
          </DialogDescription>
        </DialogHeader>

        {/* Editor Tabs */}
        <Tabs value={mode} onValueChange={(v) => setMode(v as 'json' | 'form')} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="json">JSON Editor</TabsTrigger>
            <TabsTrigger value="form" disabled>
              Form Editor (Coming Soon)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="json" className="flex-1 flex flex-col overflow-hidden mt-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {validation.valid ? (
                  <div className="flex items-center gap-1 text-green-600 text-sm">
                    <Check className="h-4 w-4" />
                    <span>Valid JSON</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-red-600 text-sm">
                    <AlertCircle className="h-4 w-4" />
                    <span>{validation.errors.length} error(s)</span>
                  </div>
                )}
                {hasChanges && (
                  <Badge variant="outline" className="text-yellow-600 border-yellow-300">
                    Unsaved Changes
                  </Badge>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFormat}
                  disabled={!validation.valid}
                >
                  Format
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyToClipboard}
                >
                  {copiedToClipboard ? (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Validation Errors */}
            {!validation.valid && validation.errors.length > 0 && (
              <Alert variant="destructive" className="mb-3">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Validation Errors</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1 mt-2">
                    {validation.errors.map((error, index) => (
                      <li key={index} className="text-sm">
                        {error.line && <span className="font-mono">Line {error.line}: </span>}
                        <span className="font-semibold">{error.path}</span> - {error.message}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Save Error */}
            {saveError && (
              <Alert variant="destructive" className="mb-3">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Save Failed</AlertTitle>
                <AlertDescription>{saveError}</AlertDescription>
              </Alert>
            )}

            {/* JSON Editor */}
            <div className="flex-1 overflow-hidden border rounded-md">
              <Textarea
                value={jsonContent}
                onChange={(e) => handleJsonChange(e.target.value)}
                className="w-full h-full font-mono text-sm resize-none border-0 focus-visible:ring-0"
                placeholder="Enter FHIR resource JSON..."
                spellCheck={false}
              />
            </div>
          </TabsContent>

          <TabsContent value="form" className="flex-1">
            <div className="flex items-center justify-center h-full text-gray-500">
              <p>Form editor coming soon...</p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
            <X className="h-4 w-4 mr-1" />
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!validation.valid || !hasChanges || isSaving}
          >
            <Save className="h-4 w-4 mr-1" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
