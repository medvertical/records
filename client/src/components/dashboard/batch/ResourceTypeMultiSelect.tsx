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
import { Check, ChevronsUpDown, X, Plus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getResourceTypeIcon } from '@/lib/resource-type-icons';

// Most common FHIR resource types - preselected by default (26 types)
// Organized by healthcare domain for clarity
const COMMON_RESOURCE_TYPES = [
  // Clinical Core
  'Patient',
  'Practitioner',
  'PractitionerRole',
  'Organization',
  'Location',
  
  // Clinical Observations & Conditions
  'Observation',
  'Condition',
  'Procedure',
  'AllergyIntolerance',
  'FamilyMemberHistory',
  'ClinicalImpression',
  
  // Medications
  'Medication',
  'MedicationRequest',
  'MedicationStatement',
  'MedicationAdministration',
  
  // Encounters & Visits
  'Encounter',
  'EpisodeOfCare',
  
  // Orders & Requests
  'ServiceRequest',
  'DiagnosticReport',
  'Specimen',
  
  // Preventive Care
  'Immunization',
  
  // Appointments & Scheduling
  'Appointment',
  'Schedule',
  'Slot',
  
  // Documents & Plans
  'DocumentReference',
  'CarePlan',
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

  // Fetch ALL resource types from server - separate from sidebar filtered counts
  // This ensures batch validation shows ALL available types, not just validated ones
  const { data: resourceCounts, isLoading: isCountsLoading, isFetching: isCountsFetching } = useQuery({
    queryKey: ["/api/fhir/resource-counts-all"],
    queryFn: async () => {
      const response = await fetch('/api/fhir/resource-counts?all=true');
      if (!response.ok) throw new Error('Failed to fetch resource counts');
      
      const data = await response.json();
      
      // Transform API response to Record<string, number>
      const counts: Record<string, number> = {};
      if (data.resourceTypes && Array.isArray(data.resourceTypes)) {
        data.resourceTypes.forEach((item: { resourceType: string; count: number }) => {
          counts[item.resourceType] = item.count;
        });
      }
      
      return counts;
    },
    enabled: true, // Fetch immediately - non-blocking selection
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: (previousData) => previousData,
  });

  // Resource counts already in correct format from query
  const serverCounts = resourceCounts || {};

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

  // Auto-select common types on mount IMMEDIATELY - don't wait for counts!
  // Counts will populate in the chips once loaded
  useEffect(() => {
    if (autoSelectCommon && !hasAutoSelected && selectedTypes.length === 0) {
      // Select common types immediately, regardless of server availability
      onChange(COMMON_RESOURCE_TYPES);
      setHasAutoSelected(true);
    }
  }, [autoSelectCommon, hasAutoSelected, selectedTypes.length, onChange]);

  const handleSelect = (type: string) => {
    if (selectedTypes.includes(type)) {
      onChange(selectedTypes.filter((t) => t !== type));
    } else {
      onChange([...selectedTypes, type]);
    }
  };

  const handleSelectAll = () => {
    // Select all types immediately - counts will show which are available
    // Still filter by availability if counts are loaded, otherwise select all
    if (isCountsLoading || Object.keys(serverCounts).length === 0) {
      // Counts not loaded yet - select all known types
      onChange(ALL_FHIR_R4_RESOURCE_TYPES);
    } else {
      // Counts loaded - only select available types
      const availableTypes = allResourceTypes.filter(rt => rt.available).map(rt => rt.type);
      onChange(availableTypes);
    }
  };

  const handleSelectCommon = () => {
    // Select common types immediately - counts will follow
    onChange(COMMON_RESOURCE_TYPES);
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
            {isCountsFetching ? (
              <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin opacity-50" />
            ) : (
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput placeholder="Search all FHIR R4 resource types..." />
            <CommandList>
              <CommandEmpty>
                No resource types found.
              </CommandEmpty>
              {/* Always show resource types, counts load in background */}
              <>
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
                          {isCountsLoading ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            count.toLocaleString()
                          )}
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
                          {isCountsLoading ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            0
                          )}
                        </Badge>
                      </CommandItem>
                    );
                  })}
              </CommandGroup>
              </>
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
                variant="outline"
                className="gap-1.5 pr-1.5 pl-2 py-1 bg-white rounded-sm border-gray-300"
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="font-medium">{type}</span>
                {isCountsLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin opacity-60" />
                ) : resourceType && resourceType.count > 0 ? (
                  <span className="text-xs opacity-60 font-normal">
                    {resourceType.count.toLocaleString()}
                  </span>
                ) : null}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 ml-0.5 hover:bg-gray-100 rounded-sm"
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

