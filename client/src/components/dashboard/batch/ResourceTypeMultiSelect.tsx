import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Check, ChevronsUpDown, X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getResourceTypeIcon } from '@/lib/resource-type-icons';

// Most common FHIR resource types - preselected by default
const COMMON_RESOURCE_TYPES = [
  'Patient',
  'Observation',
  'Encounter',
  'Condition',
];

// Comprehensive list of FHIR R4 resource types
const ALL_FHIR_R4_RESOURCE_TYPES = [
  'Account', 'ActivityDefinition', 'AdverseEvent', 'AllergyIntolerance', 'Appointment',
  'AppointmentResponse', 'AuditEvent', 'Basic', 'Binary', 'BiologicallyDerivedProduct',
  'BodyStructure', 'Bundle', 'CapabilityStatement', 'CarePlan', 'CareTeam',
  'CatalogEntry', 'ChargeItem', 'ChargeItemDefinition', 'Claim', 'ClaimResponse',
  'ClinicalImpression', 'CodeSystem', 'Communication', 'CommunicationRequest', 'CompartmentDefinition',
  'Composition', 'ConceptMap', 'Condition', 'Consent', 'Contract',
  'Coverage', 'CoverageEligibilityRequest', 'CoverageEligibilityResponse', 'DetectedIssue', 'Device',
  'DeviceDefinition', 'DeviceMetric', 'DeviceRequest', 'DeviceUseStatement', 'DiagnosticReport',
  'DocumentManifest', 'DocumentReference', 'EffectEvidenceSynthesis', 'Encounter', 'Endpoint',
  'EnrollmentRequest', 'EnrollmentResponse', 'EpisodeOfCare', 'EventDefinition', 'Evidence',
  'EvidenceVariable', 'ExampleScenario', 'ExplanationOfBenefit', 'FamilyMemberHistory', 'Flag',
  'Goal', 'GraphDefinition', 'Group', 'GuidanceResponse', 'HealthcareService',
  'ImagingStudy', 'Immunization', 'ImmunizationEvaluation', 'ImmunizationRecommendation', 'ImplementationGuide',
  'InsurancePlan', 'Invoice', 'Library', 'Linkage', 'List',
  'Location', 'Measure', 'MeasureReport', 'Media', 'Medication',
  'MedicationAdministration', 'MedicationDispense', 'MedicationKnowledge', 'MedicationRequest', 'MedicationStatement',
  'MedicinalProduct', 'MedicinalProductAuthorization', 'MedicinalProductContraindication', 'MedicinalProductIndication', 'MedicinalProductIngredient',
  'MedicinalProductInteraction', 'MedicinalProductManufactured', 'MedicinalProductPackaged', 'MedicinalProductPharmaceutical', 'MedicinalProductUndesirableEffect',
  'MessageDefinition', 'MessageHeader', 'MolecularSequence', 'NamingSystem', 'NutritionOrder',
  'Observation', 'ObservationDefinition', 'OperationDefinition', 'OperationOutcome', 'Organization',
  'OrganizationAffiliation', 'Parameters', 'Patient', 'PaymentNotice', 'PaymentReconciliation',
  'Person', 'PlanDefinition', 'Practitioner', 'PractitionerRole', 'Procedure',
  'Provenance', 'Questionnaire', 'QuestionnaireResponse', 'RelatedPerson', 'RequestGroup',
  'ResearchDefinition', 'ResearchElementDefinition', 'ResearchStudy', 'ResearchSubject', 'RiskAssessment',
  'RiskEvidenceSynthesis', 'Schedule', 'SearchParameter', 'ServiceRequest', 'Slot',
  'Specimen', 'SpecimenDefinition', 'StructureDefinition', 'StructureMap', 'Subscription',
  'Substance', 'SubstanceNucleicAcid', 'SubstancePolymer', 'SubstanceProtein', 'SubstanceReferenceInformation',
  'SubstanceSourceMaterial', 'SubstanceSpecification', 'SupplyDelivery', 'SupplyRequest', 'Task',
  'TerminologyCapabilities', 'TestReport', 'TestScript', 'ValueSet', 'VerificationResult',
  'VisionPrescription'
];

interface ResourceTypeMultiSelectProps {
  selectedTypes: string[];
  onChange: (types: string[]) => void;
  autoSelectCommon?: boolean;
}

export function ResourceTypeMultiSelect({
  selectedTypes,
  onChange,
  autoSelectCommon = true,
}: ResourceTypeMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [hasAutoSelected, setHasAutoSelected] = useState(false);

  // Fetch resource counts - use ?all=true to get ALL server types (bypass validation settings filter)
  const { data: resourceCounts, isLoading } = useQuery({
    queryKey: ['fhir-resource-counts-all'],
    queryFn: async () => {
      const response = await fetch('/api/fhir/resource-counts?all=true');
      if (!response.ok) throw new Error('Failed to fetch resource counts');
      return response.json();
    },
  });

  // Create a map of server counts
  const serverCounts = resourceCounts?.resourceTypes
    ? resourceCounts.resourceTypes.reduce((acc: Record<string, number>, rt: any) => {
        acc[rt.resourceType] = rt.count;
        return acc;
      }, {})
    : {};

  // Merge all FHIR R4 resource types with server counts
  // Sort: available types (with counts) first, then unavailable types
  const allResourceTypes = ALL_FHIR_R4_RESOURCE_TYPES.map(type => ({
    type,
    count: serverCounts[type] || 0,
    available: (serverCounts[type] || 0) > 0,
  })).sort((a, b) => {
    // First, sort by availability (available first)
    if (a.available && !b.available) return -1;
    if (!a.available && b.available) return 1;
    // Then by count (descending) for available types
    if (a.available && b.available) return b.count - a.count;
    // Alphabetically for unavailable types
    return a.type.localeCompare(b.type);
  });

  // Auto-select common types on mount if they're available on the server
  useEffect(() => {
    if (autoSelectCommon && !hasAutoSelected && resourceCounts && selectedTypes.length === 0) {
      const availableCommonTypes = COMMON_RESOURCE_TYPES.filter(
        type => serverCounts[type] && serverCounts[type] > 0
      );
      if (availableCommonTypes.length > 0) {
        onChange(availableCommonTypes);
        setHasAutoSelected(true);
      }
    }
  }, [autoSelectCommon, hasAutoSelected, resourceCounts, selectedTypes.length, serverCounts, onChange]);

  const handleSelect = (type: string) => {
    if (selectedTypes.includes(type)) {
      onChange(selectedTypes.filter((t) => t !== type));
    } else {
      onChange([...selectedTypes, type]);
    }
  };

  const handleSelectAll = () => {
    // Only select available types (with count > 0)
    const availableTypes = allResourceTypes.filter(rt => rt.available).map(rt => rt.type);
    onChange(availableTypes);
  };

  const handleSelectCommon = () => {
    const availableCommonTypes = COMMON_RESOURCE_TYPES.filter(
      type => serverCounts[type] && serverCounts[type] > 0
    );
    onChange(availableCommonTypes);
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const handleRemove = (type: string) => {
    onChange(selectedTypes.filter((t) => t !== type));
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {selectedTypes.length === 0 ? (
              <span className="text-muted-foreground">
                Select resource types...
              </span>
            ) : (
              <span>{selectedTypes.length} type(s) selected</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput placeholder="Search all FHIR R4 resource types..." />
            <CommandList>
              <CommandEmpty>
                {isLoading ? 'Loading...' : 'No resource types found.'}
              </CommandEmpty>
              <CommandGroup heading="Quick Select">
                <CommandItem
                  onSelect={handleSelectCommon}
                  className="justify-between font-medium text-blue-600"
                >
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Select Common
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {COMMON_RESOURCE_TYPES.filter(t => serverCounts[t] > 0).length}
                  </Badge>
                </CommandItem>
                <CommandItem
                  onSelect={handleSelectAll}
                  className="justify-between font-medium"
                >
                  Select All Available
                  <Badge variant="outline" className="text-xs">
                    {allResourceTypes.filter(rt => rt.available).length}
                  </Badge>
                </CommandItem>
                <CommandItem
                  onSelect={handleClearAll}
                  className="justify-between font-medium"
                >
                  Clear All
                </CommandItem>
              </CommandGroup>
              <CommandGroup heading="Available Types">
                {allResourceTypes
                  .filter(rt => rt.available)
                  .map(({ type, count }) => {
                    const Icon = getResourceTypeIcon(type);
                    const isCommon = COMMON_RESOURCE_TYPES.includes(type);
                    return (
                      <CommandItem
                        key={type}
                        value={type}
                        onSelect={() => handleSelect(type)}
                        className="justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <Check
                            className={cn(
                              'h-4 w-4 flex-shrink-0',
                              selectedTypes.includes(type)
                                ? 'opacity-100'
                                : 'opacity-0'
                            )}
                          />
                          <Icon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                          <span className={isCommon ? 'font-medium' : ''}>
                            {type}
                          </span>
                        </div>
                        <Badge variant="secondary" className="ml-2">
                          {count.toLocaleString()}
                        </Badge>
                      </CommandItem>
                    );
                  })}
              </CommandGroup>
              <CommandGroup heading="Other Types (Not on Server)">
                {allResourceTypes
                  .filter(rt => !rt.available)
                  .map(({ type }) => {
                    const Icon = getResourceTypeIcon(type);
                    return (
                      <CommandItem
                        key={type}
                        value={type}
                        onSelect={() => handleSelect(type)}
                        className="justify-between opacity-50"
                        disabled
                      >
                        <div className="flex items-center gap-2">
                          <Check
                            className={cn(
                              'h-4 w-4 flex-shrink-0',
                              selectedTypes.includes(type)
                                ? 'opacity-100'
                                : 'opacity-0'
                            )}
                          />
                          <Icon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                          <span>{type}</span>
                        </div>
                        <Badge variant="outline" className="ml-2 text-xs">
                          0
                        </Badge>
                      </CommandItem>
                    );
                  })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected Types Display - Chips/Badges */}
      {selectedTypes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTypes.map((type) => {
            const resourceType = allResourceTypes.find((rt) => rt.type === type);
            const Icon = getResourceTypeIcon(type);
            const isCommon = COMMON_RESOURCE_TYPES.includes(type);
            return (
              <Badge
                key={type}
                variant="default"
                className={cn(
                  "gap-1.5 pr-1.5 pl-2 py-1",
                  isCommon && "bg-blue-500 hover:bg-blue-600"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="font-medium">{type}</span>
                {resourceType && resourceType.count > 0 && (
                  <span className="text-xs opacity-80 font-normal">
                    {resourceType.count.toLocaleString()}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 ml-0.5 hover:bg-black/10 rounded-full"
                  onClick={() => handleRemove(type)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}

