import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Plus,
  Trash2,
  Edit,
  Loader2,
  FileCode,
  Download,
  Upload,
  AlertCircle,
  Search,
  Copy,
  XCircle,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { getResourceTypeIcon } from '@/lib/resource-type-icons';
import { SettingSection } from './shared';
import { RuleEditorModal } from './RuleEditorModal';

interface BusinessRule {
  id: number;
  ruleId: string;
  name: string;
  description: string | null;
  expression: string;
  resourceTypes: string[];
  severity: 'error' | 'warning' | 'information';
  enabled: boolean;
  category?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

const FHIR_RESOURCE_TYPES = [
  'Patient', 'Observation', 'Condition', 'Encounter', 'Procedure',
  'Medication', 'MedicationRequest', 'DiagnosticReport', 'AllergyIntolerance',
  'Immunization', 'CarePlan', 'Goal', 'ServiceRequest', 'Practitioner',
  'Organization', 'Location', 'Device', 'Specimen', 'DocumentReference'
];

export function BusinessRulesTab() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Data state
  const [rules, setRules] = useState<BusinessRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoApply, setAutoApply] = useState(false);

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [resourceTypeFilter, setResourceTypeFilter] = useState<string>('all');
  const [enabledFilter, setEnabledFilter] = useState<string>('all');

  // UI state
  const [editingRule, setEditingRule] = useState<BusinessRule | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<number | null>(null);
  const [importResults, setImportResults] = useState<ImportResult | null>(null);

  useEffect(() => {
    loadRules();
    loadAutoApplySetting();
  }, []);

  const loadRules = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/validation/business-rules');
      if (!response.ok) throw new Error('Failed to load rules');
      const data = await response.json();
      // API returns array directly
      setRules(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading rules:', error);
      toast({
        title: 'Error',
        description: 'Failed to load business rules',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAutoApplySetting = async () => {
    try {
      const response = await fetch('/api/validation/settings');
      if (response.ok) {
        const data = await response.json();
        setAutoApply(data.autoApplyBusinessRules || false);
      }
    } catch (error) {
      console.error('Error loading auto-apply setting:', error);
    }
  };

  const handleToggleRule = async (ruleId: number, enabled: boolean) => {
    try {
      const response = await fetch(`/api/validation/business-rules/${ruleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      if (!response.ok) throw new Error('Failed to update rule');
      
      setRules(rules.map((r) => (r.id === ruleId ? { ...r, enabled } : r)));
      toast({
        title: 'Rule Updated',
        description: `Rule ${enabled ? 'enabled' : 'disabled'} successfully`,
      });
    } catch (error) {
      console.error('Error toggling rule:', error);
      toast({
        title: 'Error',
        description: 'Failed to update rule',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteRule = async () => {
    if (!ruleToDelete) return;

    try {
      const response = await fetch(`/api/validation/business-rules/${ruleToDelete}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete rule');
      
      setRules(rules.filter((r) => r.id !== ruleToDelete));
      toast({
        title: 'Rule Deleted',
        description: 'Rule deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting rule:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete rule',
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
      setRuleToDelete(null);
    }
  };

  const handleDuplicateRule = async (ruleId: number) => {
    try {
      const response = await fetch(`/api/validation/business-rules/${ruleId}/duplicate`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to duplicate rule');

      await loadRules();
      toast({
        title: 'Rule Duplicated',
        description: 'Rule duplicated successfully',
      });
    } catch (error) {
      console.error('Error duplicating rule:', error);
      toast({
        title: 'Error',
        description: 'Failed to duplicate rule',
        variant: 'destructive',
      });
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch('/api/validation/business-rules/export');
      if (!response.ok) throw new Error('Failed to export rules');

      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `records-business-rules-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'Export Successful',
        description: `Exported ${data.ruleCount} rules`,
      });
    } catch (error) {
      console.error('Error exporting rules:', error);
      toast({
        title: 'Error',
        description: 'Failed to export rules',
        variant: 'destructive',
      });
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const importData = JSON.parse(text);

      const response = await fetch('/api/validation/business-rules/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(importData),
      });

      if (!response.ok) throw new Error('Failed to import rules');

      const result = await response.json();
      setImportResults(result);

      await loadRules();

      toast({
        title: 'Import Complete',
        description: `Imported: ${result.imported}, Skipped: ${result.skipped}`,
        variant: result.errors.length > 0 ? 'destructive' : 'default',
      });
    } catch (error) {
      console.error('Error importing rules:', error);
      toast({
        title: 'Error',
        description: 'Failed to import rules',
        variant: 'destructive',
      });
    } finally {
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleAutoApplyChange = async (checked: boolean) => {
    try {
      const response = await fetch('/api/validation/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoApplyBusinessRules: checked }),
      });

      if (!response.ok) throw new Error('Failed to update auto-apply setting');

      setAutoApply(checked);
      toast({
        title: 'Setting Updated',
        description: `Auto-apply ${checked ? 'enabled' : 'disabled'}`,
      });
    } catch (error) {
      console.error('Error updating auto-apply:', error);
      toast({
        title: 'Error',
        description: 'Failed to update auto-apply setting',
        variant: 'destructive',
      });
    }
  };

  const openRuleEditor = (rule: BusinessRule | null) => {
    setEditingRule(rule);
    setIsEditorOpen(true);
  };

  const closeRuleEditor = () => {
    setIsEditorOpen(false);
    setEditingRule(null);
  };

  const handleRuleSaved = () => {
    loadRules();
  };

  const confirmDelete = (ruleId: number) => {
    setRuleToDelete(ruleId);
    setDeleteDialogOpen(true);
  };

  // Filter rules
  const filteredRules = rules.filter((rule) => {
    // Search filter
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      rule.name.toLowerCase().includes(searchLower) ||
      rule.description?.toLowerCase().includes(searchLower) ||
      rule.fhirPath.toLowerCase().includes(searchLower);

    // Severity filter
    const matchesSeverity = severityFilter === 'all' || rule.severity === severityFilter;

    // Resource type filter
    const matchesResourceType =
      resourceTypeFilter === 'all' || rule.resourceType === resourceTypeFilter;

    // Enabled filter
    const matchesEnabled =
      enabledFilter === 'all' ||
      (enabledFilter === 'enabled' && rule.enabled) ||
      (enabledFilter === 'disabled' && !rule.enabled);

    return matchesSearch && matchesSeverity && matchesResourceType && matchesEnabled;
  });

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'error':
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            Error
          </Badge>
        );
      case 'warning':
        return (
          <Badge className="bg-orange-500 hover:bg-orange-600 text-white flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Warning
          </Badge>
        );
      case 'information':
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Info className="h-3 w-3" />
            Info
          </Badge>
        );
      default:
        return <Badge variant="outline">{severity}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search rules..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="All Severities">
              {severityFilter === 'all' && 'All Severities'}
              {severityFilter === 'error' && (
                <div className="flex items-center gap-2">
                  <XCircle className="h-3.5 w-3.5 text-red-600" />
                  <span>Error</span>
                </div>
              )}
              {severityFilter === 'warning' && (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                  <span>Warning</span>
                </div>
              )}
              {severityFilter === 'information' && (
                <div className="flex items-center gap-2">
                  <Info className="h-3.5 w-3.5 text-blue-500" />
                  <span>Info</span>
                </div>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
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
        <Select value={resourceTypeFilter} onValueChange={setResourceTypeFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="All Resources">
              {resourceTypeFilter !== 'all' && (() => {
                const ResourceIcon = getResourceTypeIcon(resourceTypeFilter);
                return (
                  <div className="flex items-center gap-2">
                    <ResourceIcon className="h-3.5 w-3.5" />
                    <span>{resourceTypeFilter}</span>
                  </div>
                );
              })()}
              {resourceTypeFilter === 'all' && 'All Resources'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Resources</SelectItem>
            {FHIR_RESOURCE_TYPES.map((type) => {
              const ResourceIcon = getResourceTypeIcon(type);
              return (
                <SelectItem key={type} value={type}>
                  <div className="flex items-center gap-2">
                    <ResourceIcon className="h-3.5 w-3.5" />
                    <span>{type}</span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        <Select value={enabledFilter} onValueChange={setEnabledFilter}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="enabled">Enabled Only</SelectItem>
            <SelectItem value="disabled">Disabled Only</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => openRuleEditor(null)} className="whitespace-nowrap">
          <Plus className="mr-2 h-4 w-4" />
          Add Rule
        </Button>
      </div>

      {/* Rules List */}
      {filteredRules.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileCode className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-muted-foreground mb-2">
              {searchTerm || severityFilter !== 'all' || resourceTypeFilter !== 'all'
                ? 'No rules match your filters'
                : 'No business rules defined'}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              {searchTerm || severityFilter !== 'all' || resourceTypeFilter !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Create your first rule to get started'}
            </p>
            {!searchTerm && severityFilter === 'all' && resourceTypeFilter === 'all' && (
              <Button onClick={() => openRuleEditor(null)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Rule
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredRules.map((rule) => (
            <div
              key={rule.id}
              className={cn(
                'border rounded-lg p-4 space-y-3 transition-colors',
                rule.enabled 
                  ? 'bg-white dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'
                  : 'bg-gray-50 dark:bg-gray-900/30 border-gray-300 dark:border-gray-800 opacity-60'
              )}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold text-sm">{rule.name}</h4>
                    {getSeverityBadge(rule.severity)}
                    {rule.resourceTypes && rule.resourceTypes.length > 0 && (() => {
                      const ResourceIcon = getResourceTypeIcon(rule.resourceTypes[0]);
                      return (
                        <Badge variant="outline" className="text-xs flex items-center gap-1">
                          <ResourceIcon className="h-3 w-3" />
                          {rule.resourceTypes[0]}
                        </Badge>
                      );
                    })()}
                  </div>
                  {rule.description && (
                    <p className="text-xs text-muted-foreground">{rule.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Switch
                    checked={rule.enabled}
                    onCheckedChange={(checked) => handleToggleRule(rule.id, checked)}
                    aria-label={`Toggle ${rule.name}`}
                  />
                </div>
              </div>

              {/* FHIRPath Expression */}
              <div className="bg-gray-100 dark:bg-gray-900 rounded p-3 font-mono text-xs overflow-x-auto">
                <code className="text-blue-600 dark:text-blue-400">{rule.expression}</code>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2 border-t dark:border-gray-700 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openRuleEditor(rule)}
                >
                  <Edit className="h-3 w-3 mr-1" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDuplicateRule(rule.id)}
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Duplicate
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => confirmDelete(rule.id)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Delete
                </Button>
                <div className="ml-auto text-xs text-muted-foreground">
                  Updated: {new Date(rule.updatedAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Section 2: Import/Export */}
      <SettingSection
        title="Import / Export"
        description="Export all rules as JSON or import existing rule sets from file."
      >
        <div className="space-y-4">
          <div className="flex gap-4">
            <Button variant="secondary" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Export Rules
            </Button>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              Import Rules
            </Button>
            <input
              type="file"
              accept="application/json"
              hidden
              ref={fileInputRef}
              onChange={handleImport}
            />
          </div>

          {/* Import Results */}
          {importResults && (
            <Alert variant={importResults.errors.length > 0 ? 'destructive' : 'default'}>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div>
                  <strong>Import Complete:</strong> Imported {importResults.imported} rules, Skipped{' '}
                  {importResults.skipped}
                </div>
                {importResults.errors.length > 0 && (
                  <div className="mt-2">
                    <strong>Errors:</strong>
                    <ul className="list-disc list-inside mt-1">
                      {importResults.errors.map((err, idx) => (
                        <li key={idx} className="text-sm">
                          {err}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </SettingSection>

      {/* Section 3: Auto-Apply Rules */}
      <SettingSection
        title="Auto-Apply Rules"
        description="When enabled, all active rules will automatically be executed after FHIR validation."
      >
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-3">
            <Switch
              checked={autoApply}
              onCheckedChange={handleAutoApplyChange}
              id="auto-apply"
            />
            <div>
              <p className="text-sm font-medium">
                {autoApply ? 'Auto-application enabled' : 'Manual application only'}
              </p>
              <p className="text-xs text-muted-foreground">
                {autoApply
                  ? 'Rules will run automatically after every validation.'
                  : 'Rules will only run when manually triggered.'}
              </p>
            </div>
          </div>
          {autoApply && <Badge variant="default">Active</Badge>}
        </div>
      </SettingSection>

      {/* Rule Editor Modal */}
      <RuleEditorModal
        open={isEditorOpen}
        onClose={closeRuleEditor}
        rule={editingRule}
        onSave={handleRuleSaved}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this rule? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRule} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
