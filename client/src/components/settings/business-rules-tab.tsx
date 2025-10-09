import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { 
  Code2,
  Plus,
  Trash2,
  Edit,
  Play,
  Check,
  X,
  AlertCircle,
  Loader2,
  FileCode
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface BusinessRule {
  id: number;
  name: string;
  description: string | null;
  fhirPath: string;
  severity: 'error' | 'warning' | 'information';
  message: string;
  enabled: boolean;
  resourceType: string | null;
  createdAt: string;
  updatedAt: string;
}

export function BusinessRulesTab() {
  const { toast } = useToast();
  const [rules, setRules] = useState<BusinessRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState<BusinessRule | null>(null);
  const [testingRule, setTestingRule] = useState<number | null>(null);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/validation/business-rules');
      if (!response.ok) throw new Error('Failed to load rules');
      const data = await response.json();
      setRules(data.rules || []);
    } catch (error) {
      console.error('Error loading rules:', error);
      toast({
        title: 'Error',
        description: 'Failed to load business rules',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
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
      
      setRules(rules.map(r => r.id === ruleId ? { ...r, enabled } : r));
      toast({
        title: 'Rule Updated',
        description: `Rule ${enabled ? 'enabled' : 'disabled'} successfully`,
      });
    } catch (error) {
      console.error('Error toggling rule:', error);
      toast({
        title: 'Error',
        description: 'Failed to update rule',
        variant: 'destructive'
      });
    }
  };

  const handleTestRule = async (ruleId: number) => {
    try {
      setTestingRule(ruleId);
      const response = await fetch(`/api/validation/business-rules/${ruleId}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resource: {
            resourceType: 'Patient',
            id: 'test-patient',
            name: [{ family: 'Mustermann', given: ['Max'] }]
          }
        }),
      });
      
      if (!response.ok) throw new Error('Test failed');
      const result = await response.json();
      
      toast({
        title: 'Test Result',
        description: result.passed 
          ? '✅ Rule passed test' 
          : `❌ Rule failed: ${result.message}`,
        variant: result.passed ? 'default' : 'destructive'
      });
    } catch (error) {
      console.error('Error testing rule:', error);
      toast({
        title: 'Error',
        description: 'Failed to test rule',
        variant: 'destructive'
      });
    } finally {
      setTestingRule(null);
    }
  };

  const handleDeleteRule = async (ruleId: number) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;
    
    try {
      const response = await fetch(`/api/validation/business-rules/${ruleId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete rule');
      
      setRules(rules.filter(r => r.id !== ruleId));
      toast({
        title: 'Rule Deleted',
        description: 'Rule deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting rule:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete rule',
        variant: 'destructive'
      });
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'warning':
        return <Badge variant="default" className="bg-yellow-500">Warning</Badge>;
      case 'information':
        return <Badge variant="secondary">Info</Badge>;
      default:
        return <Badge variant="outline">{severity}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Loading Business Rules...</CardTitle>
          </CardHeader>
          <CardContent>
            <Loader2 className="h-8 w-8 animate-spin text-fhir-blue" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Code2 className="h-5 w-5" /> Business Rules Management
              </CardTitle>
              <CardDescription>
                Manage FHIRPath-based business rules for advanced validation
              </CardDescription>
            </div>
            <Button
              onClick={() => {
                toast({
                  title: 'Coming Soon',
                  description: 'Visual rule editor is under development',
                });
              }}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Rule
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Info Alert */}
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="text-sm text-blue-900 dark:text-blue-200">
                <p className="font-medium mb-1">About Business Rules</p>
                <p className="text-xs">
                  Business rules use FHIRPath expressions to validate complex constraints beyond standard FHIR validation.
                  Each rule is evaluated during validation and can generate custom error messages.
                </p>
              </div>
            </div>
          </div>

          {/* Rules List */}
          {rules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileCode className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>No business rules defined</p>
              <p className="text-sm">Create your first rule to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className={cn(
                    "border rounded-lg p-4 space-y-3 transition-colors",
                    rule.enabled 
                      ? "bg-white dark:bg-gray-800/50 border-gray-200 dark:border-gray-700" 
                      : "bg-gray-50 dark:bg-gray-900/30 border-gray-300 dark:border-gray-800 opacity-60"
                  )}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-sm">{rule.name}</h4>
                        {getSeverityBadge(rule.severity)}
                        {rule.resourceType && (
                          <Badge variant="outline" className="text-xs">
                            {rule.resourceType}
                          </Badge>
                        )}
                      </div>
                      {rule.description && (
                        <p className="text-xs text-muted-foreground">{rule.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={(checked) => handleToggleRule(rule.id, checked)}
                        aria-label={`Toggle ${rule.name}`}
                      />
                    </div>
                  </div>

                  {/* FHIRPath Expression */}
                  <div className="bg-gray-100 dark:bg-gray-900 rounded p-3 font-mono text-xs overflow-x-auto">
                    <code className="text-fhir-blue dark:text-blue-400">{rule.fhirPath}</code>
                  </div>

                  {/* Message */}
                  <div className="text-xs">
                    <span className="text-muted-foreground">Message:</span>{' '}
                    <span className="text-gray-900 dark:text-gray-100">{rule.message}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2 border-t dark:border-gray-700">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleTestRule(rule.id)}
                      disabled={testingRule === rule.id}
                    >
                      {testingRule === rule.id ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Testing...
                        </>
                      ) : (
                        <>
                          <Play className="h-3 w-3 mr-1" />
                          Test
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        toast({
                          title: 'Coming Soon',
                          description: 'Rule editing is under development',
                        });
                      }}
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteRule(rule.id)}
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
        </CardContent>
      </Card>
    </div>
  );
}

