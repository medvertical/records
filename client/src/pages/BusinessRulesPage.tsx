/**
 * Business Rules Page
 * Task 9.1: Main page for business rules management
 */

import { useState } from 'react';
import { BusinessRuleEditor, BusinessRule } from '@/components/rules/BusinessRuleEditor';
import { BusinessRuleList } from '@/components/rules/BusinessRuleList';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

/**
 * View modes for the page
 */
type ViewMode = 'list' | 'create' | 'edit';

/**
 * BusinessRulesPage Component
 * 
 * Main page for managing business validation rules with list and editor views
 */
export function BusinessRulesPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedRule, setSelectedRule] = useState<BusinessRule | undefined>();
  const [rules, setRules] = useState<BusinessRule[]>([
    // Sample rules for demonstration
    {
      id: '1',
      name: 'Patient must have name',
      description: 'Ensures every Patient resource has at least one name with a family name',
      fhirPathExpression: 'name.exists() and name.family.exists()',
      resourceTypes: ['Patient'],
      severity: 'error',
      enabled: true,
      category: 'Required Fields',
      version: '1.0.0',
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:00:00Z',
    },
    {
      id: '2',
      name: 'Observation must have effective date',
      description: 'Clinical observations must include when the observation was made',
      fhirPathExpression: 'effectiveDateTime.exists() or effectivePeriod.exists()',
      resourceTypes: ['Observation'],
      severity: 'warning',
      enabled: true,
      category: 'Data Quality',
      version: '1.0.0',
      createdAt: '2024-01-16T14:30:00Z',
      updatedAt: '2024-01-16T14:30:00Z',
    },
    {
      id: '3',
      name: 'MedicationRequest dosage validation',
      description: 'Medication orders should specify dosage instructions',
      fhirPathExpression: 'dosageInstruction.exists() and dosageInstruction.all(text.exists() or timing.exists())',
      resourceTypes: ['MedicationRequest'],
      severity: 'warning',
      enabled: true,
      category: 'Business Logic',
      version: '1.0.0',
      createdAt: '2024-01-17T09:15:00Z',
      updatedAt: '2024-01-17T09:15:00Z',
    },
    {
      id: '4',
      name: 'AllergyIntolerance criticality for severe reactions',
      description: 'Severe allergic reactions should be marked as high criticality',
      fhirPathExpression: 'reaction.where(severity = \'severe\').exists() implies criticality = \'high\'',
      resourceTypes: ['AllergyIntolerance'],
      severity: 'info',
      enabled: false,
      category: 'Data Quality',
      version: '1.0.0',
      createdAt: '2024-01-18T16:45:00Z',
      updatedAt: '2024-01-18T16:45:00Z',
    },
  ]);

  /**
   * Handle creating a new rule
   */
  const handleCreateRule = () => {
    setSelectedRule(undefined);
    setViewMode('create');
  };

  /**
   * Handle editing an existing rule
   */
  const handleEditRule = (rule: BusinessRule) => {
    setSelectedRule(rule);
    setViewMode('edit');
  };

  /**
   * Handle saving a rule (create or update)
   */
  const handleSaveRule = (rule: BusinessRule) => {
    if (viewMode === 'create') {
      // Create new rule
      const newRule: BusinessRule = {
        ...rule,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setRules((prev) => [...prev, newRule]);
    } else if (viewMode === 'edit' && selectedRule) {
      // Update existing rule
      setRules((prev) =>
        prev.map((r) =>
          r.id === selectedRule.id
            ? { ...rule, id: r.id, updatedAt: new Date().toISOString() }
            : r
        )
      );
    }

    // Return to list view
    setViewMode('list');
    setSelectedRule(undefined);
  };

  /**
   * Handle canceling editor
   */
  const handleCancelEdit = () => {
    setViewMode('list');
    setSelectedRule(undefined);
  };

  /**
   * Handle deleting a rule
   */
  const handleDeleteRule = (ruleId: string) => {
    if (confirm('Are you sure you want to delete this rule?')) {
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
    }
  };

  /**
   * Handle toggling rule enabled status
   */
  const handleToggleRule = (ruleId: string, enabled: boolean) => {
    setRules((prev) =>
      prev.map((r) =>
        r.id === ruleId
          ? { ...r, enabled, updatedAt: new Date().toISOString() }
          : r
      )
    );
  };

  /**
   * Handle duplicating a rule
   */
  const handleDuplicateRule = (rule: BusinessRule) => {
    const duplicated: BusinessRule = {
      ...rule,
      id: Date.now().toString(),
      name: `${rule.name} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setRules((prev) => [...prev, duplicated]);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header with back button when in editor view */}
      {viewMode !== 'list' && (
        <Button
          variant="ghost"
          onClick={handleCancelEdit}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Rules
        </Button>
      )}

      {/* Render appropriate view */}
      {viewMode === 'list' ? (
        <BusinessRuleList
          rules={rules}
          onCreateRule={handleCreateRule}
          onEditRule={handleEditRule}
          onDeleteRule={handleDeleteRule}
          onToggleRule={handleToggleRule}
          onDuplicateRule={handleDuplicateRule}
        />
      ) : (
        <BusinessRuleEditor
          rule={selectedRule}
          onSave={handleSaveRule}
          onCancel={handleCancelEdit}
          mode={viewMode}
        />
      )}
    </div>
  );
}


