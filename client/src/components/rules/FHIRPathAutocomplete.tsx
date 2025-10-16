/**
 * FHIRPath Autocomplete Component
 * Task 9.3: Add FHIRPath autocomplete for resource fields and functions
 */

import { useState, useEffect, useRef } from 'react';
import { Command, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Autocomplete suggestion types
 */
export type SuggestionType = 'field' | 'function' | 'keyword' | 'operator' | 'resourceType';

/**
 * Autocomplete suggestion interface
 */
export interface AutocompleteSuggestion {
  label: string;
  type: SuggestionType;
  description?: string;
  insertText?: string;
  detail?: string;
}

/**
 * Common FHIR resource fields by resource type
 */
export const FHIR_RESOURCE_FIELDS: Record<string, string[]> = {
  Patient: [
    'id', 'meta', 'identifier', 'active', 'name', 'telecom', 'gender',
    'birthDate', 'deceased', 'address', 'maritalStatus', 'multipleBirth',
    'photo', 'contact', 'communication', 'generalPractitioner', 'managingOrganization',
    'link', 'text', 'extension', 'modifierExtension',
  ],
  Observation: [
    'id', 'meta', 'identifier', 'basedOn', 'partOf', 'status', 'category',
    'code', 'subject', 'focus', 'encounter', 'effective', 'effectiveDateTime',
    'effectivePeriod', 'issued', 'performer', 'value', 'valueQuantity',
    'valueCodeableConcept', 'valueString', 'dataAbsentReason', 'interpretation',
    'note', 'bodySite', 'method', 'specimen', 'device', 'referenceRange',
    'hasMember', 'derivedFrom', 'component', 'text', 'extension',
  ],
  Condition: [
    'id', 'meta', 'identifier', 'clinicalStatus', 'verificationStatus',
    'category', 'severity', 'code', 'bodySite', 'subject', 'encounter',
    'onset', 'onsetDateTime', 'onsetAge', 'onsetPeriod', 'abatement',
    'abatementDateTime', 'recordedDate', 'recorder', 'asserter', 'stage',
    'evidence', 'note', 'text', 'extension',
  ],
  MedicationRequest: [
    'id', 'meta', 'identifier', 'status', 'statusReason', 'intent',
    'category', 'priority', 'doNotPerform', 'reported', 'medication',
    'medicationCodeableConcept', 'medicationReference', 'subject', 'encounter',
    'supportingInformation', 'authoredOn', 'requester', 'performer',
    'performerType', 'recorder', 'reasonCode', 'reasonReference',
    'instantiatesCanonical', 'instantiatesUri', 'basedOn', 'groupIdentifier',
    'courseOfTherapyType', 'insurance', 'note', 'dosageInstruction',
    'dispenseRequest', 'substitution', 'priorPrescription', 'detectedIssue',
    'eventHistory', 'text', 'extension',
  ],
  AllergyIntolerance: [
    'id', 'meta', 'identifier', 'clinicalStatus', 'verificationStatus',
    'type', 'category', 'criticality', 'code', 'patient', 'encounter',
    'onset', 'onsetDateTime', 'recordedDate', 'recorder', 'asserter',
    'lastOccurrence', 'note', 'reaction', 'text', 'extension',
  ],
};

/**
 * FHIRPath functions with descriptions
 */
export const FHIRPATH_FUNCTIONS: AutocompleteSuggestion[] = [
  { label: 'exists()', type: 'function', description: 'Returns true if the collection has any elements', insertText: 'exists()' },
  { label: 'empty()', type: 'function', description: 'Returns true if the collection is empty', insertText: 'empty()' },
  { label: 'all()', type: 'function', description: 'Returns true if all elements match the condition', insertText: 'all()' },
  { label: 'any()', type: 'function', description: 'Returns true if any element matches the condition', insertText: 'any()' },
  { label: 'where()', type: 'function', description: 'Filters collection by condition', insertText: 'where()' },
  { label: 'select()', type: 'function', description: 'Transforms each element', insertText: 'select()' },
  { label: 'count()', type: 'function', description: 'Returns number of elements', insertText: 'count()' },
  { label: 'distinct()', type: 'function', description: 'Returns unique elements', insertText: 'distinct()' },
  { label: 'first()', type: 'function', description: 'Returns first element', insertText: 'first()' },
  { label: 'last()', type: 'function', description: 'Returns last element', insertText: 'last()' },
  { label: 'tail()', type: 'function', description: 'Returns all but first element', insertText: 'tail()' },
  { label: 'skip()', type: 'function', description: 'Skips n elements', insertText: 'skip()' },
  { label: 'take()', type: 'function', description: 'Takes first n elements', insertText: 'take()' },
  { label: 'union()', type: 'function', description: 'Combines two collections', insertText: 'union()' },
  { label: 'combine()', type: 'function', description: 'Combines collections allowing duplicates', insertText: 'combine()' },
  { label: 'intersect()', type: 'function', description: 'Returns common elements', insertText: 'intersect()' },
  { label: 'exclude()', type: 'function', description: 'Removes elements present in other collection', insertText: 'exclude()' },
  { label: 'matches()', type: 'function', description: 'Tests string against regex pattern', insertText: 'matches()' },
  { label: 'contains()', type: 'function', description: 'Checks if string contains substring', insertText: 'contains()' },
  { label: 'startsWith()', type: 'function', description: 'Checks if string starts with prefix', insertText: 'startsWith()' },
  { label: 'endsWith()', type: 'function', description: 'Checks if string ends with suffix', insertText: 'endsWith()' },
  { label: 'length()', type: 'function', description: 'Returns string length', insertText: 'length()' },
  { label: 'substring()', type: 'function', description: 'Extracts substring', insertText: 'substring()' },
  { label: 'replace()', type: 'function', description: 'Replaces substring', insertText: 'replace()' },
  { label: 'indexOf()', type: 'function', description: 'Finds position of substring', insertText: 'indexOf()' },
  { label: 'toInteger()', type: 'function', description: 'Converts to integer', insertText: 'toInteger()' },
  { label: 'toDecimal()', type: 'function', description: 'Converts to decimal', insertText: 'toDecimal()' },
  { label: 'toString()', type: 'function', description: 'Converts to string', insertText: 'toString()' },
  { label: 'toBoolean()', type: 'function', description: 'Converts to boolean', insertText: 'toBoolean()' },
  { label: 'toDateTime()', type: 'function', description: 'Converts to datetime', insertText: 'toDateTime()' },
  { label: 'toTime()', type: 'function', description: 'Converts to time', insertText: 'toTime()' },
  { label: 'convertsToInteger()', type: 'function', description: 'Tests if can convert to integer', insertText: 'convertsToInteger()' },
  { label: 'convertsToDecimal()', type: 'function', description: 'Tests if can convert to decimal', insertText: 'convertsToDecimal()' },
  { label: 'convertsToString()', type: 'function', description: 'Tests if can convert to string', insertText: 'convertsToString()' },
  { label: 'convertsToDateTime()', type: 'function', description: 'Tests if can convert to datetime', insertText: 'convertsToDateTime()' },
  { label: 'now()', type: 'function', description: 'Returns current datetime', insertText: 'now()' },
  { label: 'today()', type: 'function', description: 'Returns current date', insertText: 'today()' },
  { label: 'hasValue()', type: 'function', description: 'Checks if element has a value', insertText: 'hasValue()' },
  { label: 'ofType()', type: 'function', description: 'Filters by type', insertText: 'ofType()' },
  { label: 'conformsTo()', type: 'function', description: 'Checks profile conformance', insertText: 'conformsTo()' },
  { label: 'memberOf()', type: 'function', description: 'Checks ValueSet membership', insertText: 'memberOf()' },
  { label: 'iif()', type: 'function', description: 'Inline if: iif(condition, true-result, false-result)', insertText: 'iif()' },
];

/**
 * FHIRPath keywords
 */
export const FHIRPATH_KEYWORDS: AutocompleteSuggestion[] = [
  { label: 'and', type: 'keyword', description: 'Logical AND operator' },
  { label: 'or', type: 'keyword', description: 'Logical OR operator' },
  { label: 'xor', type: 'keyword', description: 'Logical XOR operator' },
  { label: 'implies', type: 'keyword', description: 'Logical implication' },
  { label: 'as', type: 'keyword', description: 'Type cast operator' },
  { label: 'is', type: 'keyword', description: 'Type check operator' },
  { label: 'div', type: 'keyword', description: 'Integer division' },
  { label: 'mod', type: 'keyword', description: 'Modulo operator' },
  { label: 'in', type: 'keyword', description: 'Collection membership' },
  { label: 'contains', type: 'keyword', description: 'Collection contains element' },
];

/**
 * Props for FHIRPathAutocomplete
 */
interface FHIRPathAutocompleteProps {
  value: string;
  cursorPosition: number;
  onSelect: (suggestion: AutocompleteSuggestion, startPos: number, endPos: number) => void;
  resourceTypes?: string[];
  isOpen: boolean;
  onClose: () => void;
  position: { top: number; left: number };
}

/**
 * FHIRPathAutocomplete Component
 * 
 * Provides intelligent autocomplete suggestions for FHIRPath expressions
 */
export function FHIRPathAutocomplete({
  value,
  cursorPosition,
  onSelect,
  resourceTypes = [],
  isOpen,
  onClose,
  position,
}: FHIRPathAutocompleteProps) {
  const [filteredSuggestions, setFilteredSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  /**
   * Get current word being typed
   */
  const getCurrentWord = () => {
    const textBeforeCursor = value.substring(0, cursorPosition);
    const match = textBeforeCursor.match(/[\w.]*$/);
    return match ? match[0] : '';
  };

  /**
   * Get suggestions based on context
   */
  useEffect(() => {
    if (!isOpen) {
      setFilteredSuggestions([]);
      return;
    }

    const currentWord = getCurrentWord();
    const searchTerm = currentWord.toLowerCase();

    // Build suggestions list
    const suggestions: AutocompleteSuggestion[] = [];

    // Add functions
    suggestions.push(...FHIRPATH_FUNCTIONS);

    // Add keywords
    suggestions.push(...FHIRPATH_KEYWORDS);

    // Add resource fields if resource types are specified
    resourceTypes.forEach((resourceType) => {
      const fields = FHIR_RESOURCE_FIELDS[resourceType] || [];
      fields.forEach((field) => {
        suggestions.push({
          label: field,
          type: 'field',
          description: `${resourceType} field`,
          detail: resourceType,
        });
      });
    });

    // Filter by search term
    const filtered = suggestions.filter((s) =>
      s.label.toLowerCase().includes(searchTerm)
    );

    // Sort by relevance (starts with search term first)
    filtered.sort((a, b) => {
      const aStarts = a.label.toLowerCase().startsWith(searchTerm);
      const bStarts = b.label.toLowerCase().startsWith(searchTerm);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return a.label.localeCompare(b.label);
    });

    setFilteredSuggestions(filtered.slice(0, 10)); // Limit to 10 suggestions
    setSelectedIndex(0);
  }, [value, cursorPosition, resourceTypes, isOpen]);

  /**
   * Handle keyboard navigation
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen || filteredSuggestions.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % filteredSuggestions.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev === 0 ? filteredSuggestions.length - 1 : prev - 1
          );
          break;
        case 'Enter':
        case 'Tab':
          e.preventDefault();
          if (filteredSuggestions[selectedIndex]) {
            handleSelect(filteredSuggestions[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredSuggestions, selectedIndex]);

  /**
   * Handle suggestion selection
   */
  const handleSelect = (suggestion: AutocompleteSuggestion) => {
    const currentWord = getCurrentWord();
    const startPos = cursorPosition - currentWord.length;
    const endPos = cursorPosition;
    onSelect(suggestion, startPos, endPos);
    onClose();
  };

  /**
   * Get type badge color
   */
  const getTypeBadgeVariant = (type: SuggestionType) => {
    switch (type) {
      case 'function':
        return 'default';
      case 'field':
        return 'secondary';
      case 'keyword':
        return 'outline';
      default:
        return 'outline';
    }
  };

  if (!isOpen || filteredSuggestions.length === 0) {
    return null;
  }

  return (
    <div
      className="fixed z-50 w-96 bg-popover border rounded-md shadow-md"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      <Command>
        <CommandList ref={listRef} className="max-h-64">
          <CommandGroup>
            {filteredSuggestions.map((suggestion, index) => (
              <CommandItem
                key={`${suggestion.type}-${suggestion.label}`}
                onSelect={() => handleSelect(suggestion)}
                className={cn(
                  'flex items-start gap-2 cursor-pointer',
                  index === selectedIndex && 'bg-accent'
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium">{suggestion.label}</span>
                    <Badge variant={getTypeBadgeVariant(suggestion.type)} className="text-xs">
                      {suggestion.type}
                    </Badge>
                  </div>
                  {suggestion.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {suggestion.description}
                    </p>
                  )}
                  {suggestion.detail && (
                    <p className="text-xs text-muted-foreground italic">
                      {suggestion.detail}
                    </p>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  );
}

/**
 * Hook to manage autocomplete state
 */
export function useFHIRPathAutocomplete() {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const open = (pos: { top: number; left: number }) => {
    setPosition(pos);
    setIsOpen(true);
  };

  const close = () => {
    setIsOpen(false);
  };

  return {
    isOpen,
    position,
    open,
    close,
  };
}


