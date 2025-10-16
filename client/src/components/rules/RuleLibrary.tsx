/**
 * Rule Library Component
 * Task 9.5: Implement rule library with pre-built rules for common scenarios
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Library,
  Search,
  Copy,
  Check,
  Info,
  X,
} from 'lucide-react';
import { BusinessRule } from './BusinessRuleEditor';
import { cn } from '@/lib/utils';

/**
 * Pre-built rule templates organized by category
 */
export const RULE_LIBRARY: Record<string, BusinessRule[]> = {
  'Required Fields': [
    {
      name: 'Patient must have name',
      description: 'Every Patient resource must have at least one name with a family name',
      fhirPathExpression: 'name.exists() and name.family.exists()',
      resourceTypes: ['Patient'],
      severity: 'error',
      enabled: true,
      category: 'Required Fields',
      version: '1.0.0',
    },
    {
      name: 'Patient must have gender',
      description: 'Patient resources must specify administrative gender',
      fhirPathExpression: 'gender.exists() and gender.memberOf(\'http://hl7.org/fhir/ValueSet/administrative-gender\')',
      resourceTypes: ['Patient'],
      severity: 'error',
      enabled: true,
      category: 'Required Fields',
      version: '1.0.0',
    },
    {
      name: 'Observation must have status',
      description: 'Clinical observations must have a valid status',
      fhirPathExpression: 'status.exists() and status.memberOf(\'http://hl7.org/fhir/ValueSet/observation-status\')',
      resourceTypes: ['Observation'],
      severity: 'error',
      enabled: true,
      category: 'Required Fields',
      version: '1.0.0',
    },
    {
      name: 'MedicationRequest must have intent',
      description: 'Medication requests must specify intent (order, plan, etc.)',
      fhirPathExpression: 'intent.exists() and intent.memberOf(\'http://hl7.org/fhir/ValueSet/medicationrequest-intent\')',
      resourceTypes: ['MedicationRequest'],
      severity: 'error',
      enabled: true,
      category: 'Required Fields',
      version: '1.0.0',
    },
  ],
  'Data Quality': [
    {
      name: 'Patient contact must be valid',
      description: 'If contact information is provided, it must include a value',
      fhirPathExpression: 'telecom.all(value.exists() and system.exists())',
      resourceTypes: ['Patient'],
      severity: 'warning',
      enabled: true,
      category: 'Data Quality',
      version: '1.0.0',
    },
    {
      name: 'Observation value must match type',
      description: 'If observation has a value, it must match the expected type',
      fhirPathExpression: '(value.exists() and dataAbsentReason.empty()) or (value.empty() and dataAbsentReason.exists())',
      resourceTypes: ['Observation'],
      severity: 'error',
      enabled: true,
      category: 'Data Quality',
      version: '1.0.0',
    },
    {
      name: 'Address must be complete',
      description: 'Addresses should include city and postal code',
      fhirPathExpression: 'address.all(city.exists() and postalCode.exists())',
      resourceTypes: ['Patient', 'Organization', 'Practitioner'],
      severity: 'warning',
      enabled: true,
      category: 'Data Quality',
      version: '1.0.0',
    },
    {
      name: 'Identifier must have system and value',
      description: 'All identifiers must specify both system and value',
      fhirPathExpression: 'identifier.all(system.exists() and value.exists())',
      resourceTypes: ['Patient', 'Observation', 'Condition', 'Procedure', 'MedicationRequest'],
      severity: 'warning',
      enabled: true,
      category: 'Data Quality',
      version: '1.0.0',
    },
  ],
  'Business Logic': [
    {
      name: 'Deceased patient cannot be active',
      description: 'If a patient is deceased, active status should be false',
      fhirPathExpression: 'deceased.exists() and deceased = true implies active = false',
      resourceTypes: ['Patient'],
      severity: 'warning',
      enabled: true,
      category: 'Business Logic',
      version: '1.0.0',
    },
    {
      name: 'Final observation cannot be amended',
      description: 'Observations with final status cannot have entered-in-error or corrected status',
      fhirPathExpression: 'status = \'final\' implies (status != \'entered-in-error\' and status != \'cancelled\')',
      resourceTypes: ['Observation'],
      severity: 'error',
      enabled: true,
      category: 'Business Logic',
      version: '1.0.0',
    },
    {
      name: 'Allergy criticality for severe reactions',
      description: 'Severe allergic reactions should be marked as high criticality',
      fhirPathExpression: 'reaction.where(severity = \'severe\').exists() implies criticality = \'high\'',
      resourceTypes: ['AllergyIntolerance'],
      severity: 'warning',
      enabled: true,
      category: 'Business Logic',
      version: '1.0.0',
    },
    {
      name: 'MedicationRequest requires dosage',
      description: 'Active medication orders must include dosage instructions',
      fhirPathExpression: 'status = \'active\' implies dosageInstruction.exists()',
      resourceTypes: ['MedicationRequest'],
      severity: 'error',
      enabled: true,
      category: 'Business Logic',
      version: '1.0.0',
    },
  ],
  'Dates & Times': [
    {
      name: 'Birth date must be in past',
      description: 'Patient birth date cannot be in the future',
      fhirPathExpression: 'birthDate.exists() implies birthDate <= today()',
      resourceTypes: ['Patient'],
      severity: 'error',
      enabled: true,
      category: 'Dates & Times',
      version: '1.0.0',
    },
    {
      name: 'Observation effective date required',
      description: 'Clinical observations must specify when they were performed',
      fhirPathExpression: 'effectiveDateTime.exists() or effectivePeriod.exists() or effectiveTiming.exists() or effectiveInstant.exists()',
      resourceTypes: ['Observation'],
      severity: 'warning',
      enabled: true,
      category: 'Dates & Times',
      version: '1.0.0',
    },
    {
      name: 'Procedure date validation',
      description: 'Procedure performed date must be before or equal to today',
      fhirPathExpression: 'performed.exists() implies (performedDateTime <= now() or performedPeriod.end <= now())',
      resourceTypes: ['Procedure'],
      severity: 'error',
      enabled: true,
      category: 'Dates & Times',
      version: '1.0.0',
    },
  ],
  'References': [
    {
      name: 'Patient reference must be valid',
      description: 'References to Patient resources must follow correct format',
      fhirPathExpression: 'subject.reference.exists() and subject.reference.startsWith(\'Patient/\')',
      resourceTypes: ['Observation', 'Condition', 'Procedure', 'MedicationRequest', 'AllergyIntolerance'],
      severity: 'error',
      enabled: true,
      category: 'References',
      version: '1.0.0',
    },
    {
      name: 'Reference must have identifier or reference',
      description: 'References must include either reference or identifier',
      fhirPathExpression: 'reference.exists() or identifier.exists()',
      resourceTypes: ['Patient', 'Observation', 'Condition'],
      severity: 'error',
      enabled: true,
      category: 'References',
      version: '1.0.0',
    },
  ],
  'Terminology': [
    {
      name: 'Coding must have system and code',
      description: 'All Coding elements must specify system and code',
      fhirPathExpression: 'code.coding.all(system.exists() and code.exists())',
      resourceTypes: ['Observation', 'Condition', 'Procedure', 'AllergyIntolerance'],
      severity: 'warning',
      enabled: true,
      category: 'Terminology',
      version: '1.0.0',
    },
    {
      name: 'ValueSet binding validation',
      description: 'Status codes must be from approved ValueSet',
      fhirPathExpression: 'status.memberOf(\'http://hl7.org/fhir/ValueSet/observation-status\')',
      resourceTypes: ['Observation'],
      severity: 'error',
      enabled: true,
      category: 'Terminology',
      version: '1.0.0',
    },
  ],
  'Security & Privacy': [
    {
      name: 'Sensitive data must have security labels',
      description: 'Resources containing sensitive information should have security metadata',
      fhirPathExpression: 'meta.security.exists()',
      resourceTypes: ['Patient', 'Observation', 'Condition', 'AllergyIntolerance', 'MedicationRequest'],
      severity: 'info',
      enabled: true,
      category: 'Security & Privacy',
      version: '1.0.0',
    },
    {
      name: 'Restricted data requires confidentiality code',
      description: 'Resources marked as restricted must have confidentiality coding',
      fhirPathExpression: 'meta.security.where(code = \'R\').exists() implies meta.security.where(system = \'http://terminology.hl7.org/CodeSystem/v3-Confidentiality\').exists()',
      resourceTypes: ['Patient', 'Observation', 'Condition'],
      severity: 'warning',
      enabled: true,
      category: 'Security & Privacy',
      version: '1.0.0',
    },
  ],
};

/**
 * Props for RuleLibrary
 */
interface RuleLibraryProps {
  onSelectRule: (rule: BusinessRule) => void;
  selectedResourceTypes?: string[];
}

/**
 * RuleLibrary Component
 * 
 * Displays a library of pre-built validation rules that users can
 * browse, search, and add to their validation settings
 */
export function RuleLibrary({
  onSelectRule,
  selectedResourceTypes = [],
}: RuleLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  /**
   * Get all categories
   */
  const categories = Object.keys(RULE_LIBRARY);

  /**
   * Get filtered rules
   */
  const getFilteredRules = (category: string) => {
    const rules = RULE_LIBRARY[category] || [];

    return rules.filter((rule) => {
      // Search filter
      const matchesSearch =
        searchQuery === '' ||
        rule.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rule.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rule.fhirPathExpression.toLowerCase().includes(searchQuery.toLowerCase());

      // Resource type filter
      const matchesResourceType =
        selectedResourceTypes.length === 0 ||
        rule.resourceTypes.some((rt) => selectedResourceTypes.includes(rt));

      return matchesSearch && matchesResourceType;
    });
  };

  /**
   * Get total filtered rule count
   */
  const getTotalFilteredRules = () => {
    return categories.reduce((total, category) => {
      return total + getFilteredRules(category).length;
    }, 0);
  };

  /**
   * Handle rule selection
   */
  const handleSelectRule = (rule: BusinessRule) => {
    onSelectRule(rule);
    setCopiedId(rule.name);
    setTimeout(() => setCopiedId(null), 2000);
  };

  /**
   * Categories to display
   */
  const categoriesToDisplay =
    filterCategory === 'all'
      ? categories
      : categories.filter((cat) => cat === filterCategory);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Library className="h-5 w-5" />
          Rule Library
        </CardTitle>
        <CardDescription>
          Browse and use pre-built validation rules for common FHIR scenarios
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search and filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search rules..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {getTotalFilteredRules()} rules available
          </p>
          {(searchQuery || filterCategory !== 'all' || selectedResourceTypes.length > 0) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setFilterCategory('all');
              }}
            >
              <X className="h-3 w-3 mr-1" />
              Clear Filters
            </Button>
          )}
        </div>

        {/* Active resource type filter notice */}
        {selectedResourceTypes.length > 0 && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Showing rules applicable to:{' '}
              <strong>{selectedResourceTypes.join(', ')}</strong>
            </AlertDescription>
          </Alert>
        )}

        {/* Rules by category */}
        {getTotalFilteredRules() === 0 ? (
          <div className="text-center py-8">
            <Library className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No rules match your criteria</p>
          </div>
        ) : (
          <Accordion type="multiple" className="w-full">
            {categoriesToDisplay.map((category) => {
              const filteredRules = getFilteredRules(category);

              if (filteredRules.length === 0) return null;

              return (
                <AccordionItem key={category} value={category}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{category}</span>
                      <Badge variant="secondary">{filteredRules.length}</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 pt-2">
                      {filteredRules.map((rule, index) => (
                        <div
                          key={`${category}-${index}`}
                          className="border rounded-lg p-4 space-y-3 hover:bg-accent/50 transition-colors"
                        >
                          {/* Rule header */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-sm">{rule.name}</h4>
                              <p className="text-sm text-muted-foreground mt-1">
                                {rule.description}
                              </p>
                            </div>
                            <Badge
                              variant={
                                rule.severity === 'error'
                                  ? 'destructive'
                                  : rule.severity === 'warning'
                                  ? 'secondary'
                                  : 'outline'
                              }
                              className={cn(
                                rule.severity === 'warning' && 'bg-yellow-500 text-white'
                              )}
                            >
                              {rule.severity}
                            </Badge>
                          </div>

                          {/* Resource types */}
                          <div className="flex flex-wrap gap-1">
                            {rule.resourceTypes.map((rt) => (
                              <Badge key={rt} variant="outline" className="text-xs">
                                {rt}
                              </Badge>
                            ))}
                          </div>

                          {/* Expression */}
                          <div className="bg-slate-950 text-slate-50 p-3 rounded-md">
                            <code className="text-xs break-all">
                              {rule.fhirPathExpression}
                            </code>
                          </div>

                          {/* Action button */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSelectRule(rule)}
                            className="w-full"
                          >
                            {copiedId === rule.name ? (
                              <>
                                <Check className="h-3 w-3 mr-1" />
                                Added to Editor
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3 mr-1" />
                                Use This Rule
                              </>
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}

        {/* Library statistics */}
        <div className="mt-6 pt-4 border-t">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Total Rules:</span>
              <span className="ml-2 font-medium">
                {Object.values(RULE_LIBRARY).flat().length}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Categories:</span>
              <span className="ml-2 font-medium">{categories.length}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Resource Types:</span>
              <span className="ml-2 font-medium">
                {
                  new Set(
                    Object.values(RULE_LIBRARY)
                      .flat()
                      .flatMap((r) => r.resourceTypes)
                  ).size
                }
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Get rule library statistics
 */
export function getRuleLibraryStats() {
  const allRules = Object.values(RULE_LIBRARY).flat();
  
  return {
    totalRules: allRules.length,
    categories: Object.keys(RULE_LIBRARY).length,
    resourceTypes: new Set(allRules.flatMap((r) => r.resourceTypes)).size,
    byCategory: Object.entries(RULE_LIBRARY).map(([category, rules]) => ({
      category,
      count: rules.length,
    })),
    bySeverity: {
      error: allRules.filter((r) => r.severity === 'error').length,
      warning: allRules.filter((r) => r.severity === 'warning').length,
      info: allRules.filter((r) => r.severity === 'info').length,
    },
  };
}


