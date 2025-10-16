/**
 * Rule Import/Export Component
 * Task 9.13: Implement rule export/import for sharing between systems
 */

import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Download,
  Upload,
  FileJson,
  AlertCircle,
  Check,
  X,
  Info,
} from 'lucide-react';

/**
 * Import result interface
 */
interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
  importedRules: any[];
}

/**
 * Props for RuleImportExport
 */
interface RuleImportExportProps {
  onImportComplete?: (result: ImportResult) => void;
}

/**
 * RuleImportExport Component
 * 
 * Provides UI for exporting rules to JSON and importing rules from JSON files
 */
export function RuleImportExport({ onImportComplete }: RuleImportExportProps) {
  const [exportCategory, setExportCategory] = useState<string>('all');
  const [exportSeverity, setExportSeverity] = useState<string>('all');
  const [exportEnabled, setExportEnabled] = useState<string>('all');
  const [isExporting, setIsExporting] = useState(false);
  
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importOptions, setImportOptions] = useState({
    skipDuplicates: true,
    overwriteExisting: false,
  });
  const [isImporting, setIsImporting] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Handle export rules
   */
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      
      if (exportCategory !== 'all') params.append('category', exportCategory);
      if (exportSeverity !== 'all') params.append('severity', exportSeverity);
      if (exportEnabled !== 'all') params.append('enabled', exportEnabled);

      const url = `/api/validation/rules/export${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `business-rules-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export rules');
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * Handle file selection
   */
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
      setImportResult(null);
    }
  };

  /**
   * Handle import rules
   */
  const handleImport = async () => {
    if (!importFile) return;

    setIsImporting(true);
    setImportResult(null);

    try {
      // Read file content
      const fileContent = await importFile.text();
      const importData = JSON.parse(fileContent);

      // Validate format
      if (!importData.rules || !Array.isArray(importData.rules)) {
        throw new Error('Invalid file format: missing rules array');
      }

      // Send to API
      const params = new URLSearchParams();
      if (!importOptions.skipDuplicates) params.append('skipDuplicates', 'false');
      if (importOptions.overwriteExisting) params.append('overwriteExisting', 'true');

      const url = `/api/validation/rules/import${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(importData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Import failed');
      }

      const result: ImportResult = await response.json();
      setImportResult(result);
      onImportComplete?.(result);

    } catch (error: any) {
      setImportResult({
        imported: 0,
        skipped: 0,
        errors: [error.message || 'Failed to import rules'],
        importedRules: [],
      });
    } finally {
      setIsImporting(false);
    }
  };

  /**
   * Reset import form
   */
  const resetImport = () => {
    setImportFile(null);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Export Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Rules
          </CardTitle>
          <CardDescription>
            Download business rules as JSON for backup or sharing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Filter by Category</Label>
            <Select value={exportCategory} onValueChange={setExportCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="Required Fields">Required Fields</SelectItem>
                <SelectItem value="Data Quality">Data Quality</SelectItem>
                <SelectItem value="Business Logic">Business Logic</SelectItem>
                <SelectItem value="Terminology">Terminology</SelectItem>
                <SelectItem value="References">References</SelectItem>
                <SelectItem value="Security & Privacy">Security & Privacy</SelectItem>
                <SelectItem value="Custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Filter by Severity</Label>
            <Select value={exportSeverity} onValueChange={setExportSeverity}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Filter by Status</Label>
            <Select value={exportEnabled} onValueChange={setExportEnabled}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Rules</SelectItem>
                <SelectItem value="true">Enabled Only</SelectItem>
                <SelectItem value="false">Disabled Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleExport}
            disabled={isExporting}
            className="w-full"
          >
            {isExporting ? (
              <>Exporting...</>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export to JSON
              </>
            )}
          </Button>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Exported files can be imported into other systems or used for backup.
              System-specific IDs and timestamps are excluded for portability.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Import Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Rules
          </CardTitle>
          <CardDescription>
            Upload and import business rules from JSON file
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file-upload">Select JSON File</Label>
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                id="file-upload"
                type="file"
                accept=".json,application/json"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1"
              >
                <FileJson className="h-4 w-4 mr-2" />
                {importFile ? importFile.name : 'Choose File'}
              </Button>
              {importFile && (
                <Button variant="ghost" onClick={resetImport}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <Label>Import Options</Label>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="skip-duplicates"
                checked={importOptions.skipDuplicates}
                onCheckedChange={(checked) =>
                  setImportOptions((prev) => ({ ...prev, skipDuplicates: !!checked }))
                }
              />
              <Label htmlFor="skip-duplicates" className="cursor-pointer text-sm font-normal">
                Skip duplicate rules (by name)
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="overwrite-existing"
                checked={importOptions.overwriteExisting}
                onCheckedChange={(checked) =>
                  setImportOptions((prev) => ({ ...prev, overwriteExisting: !!checked }))
                }
              />
              <Label htmlFor="overwrite-existing" className="cursor-pointer text-sm font-normal">
                Overwrite existing rules
              </Label>
            </div>
          </div>

          <Button
            onClick={handleImport}
            disabled={!importFile || isImporting}
            className="w-full"
          >
            {isImporting ? (
              <>Importing...</>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Import Rules
              </>
            )}
          </Button>

          {/* Import Result */}
          {importResult && (
            <div className="space-y-2 mt-4">
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold">Import Results</h4>
                  {importResult.errors.length === 0 ? (
                    <Badge className="bg-green-500">
                      <Check className="h-3 w-3 mr-1" />
                      Success
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-yellow-500 text-white">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Partial
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-1">
                    <Check className="h-4 w-4 text-green-600" />
                    <span>Imported: {importResult.imported}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <X className="h-4 w-4 text-muted-foreground" />
                    <span>Skipped: {importResult.skipped}</span>
                  </div>
                </div>

                {importResult.errors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-1">
                        <p className="font-medium">Errors:</p>
                        <ul className="list-disc list-inside text-xs space-y-0.5">
                          {importResult.errors.slice(0, 5).map((error, index) => (
                            <li key={index}>{error}</li>
                          ))}
                          {importResult.errors.length > 5 && (
                            <li className="text-muted-foreground">
                              ... and {importResult.errors.length - 5} more
                            </li>
                          )}
                        </ul>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


