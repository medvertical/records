/**
 * FHIRPath Code Editor with Syntax Highlighting
 * Task 9.2: Implement FHIRPath syntax highlighting in code editor
 */

import { useRef, useEffect, useState } from 'react';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css'; // Dark theme for code editor
import { cn } from '@/lib/utils';
import {
  FHIRPathAutocomplete,
  useFHIRPathAutocomplete,
  type AutocompleteSuggestion,
} from './FHIRPathAutocomplete';

/**
 * Define FHIRPath language grammar for Prism.js
 * Based on FHIRPath specification and common patterns
 */
if (typeof window !== 'undefined' && !Prism.languages.fhirpath) {
  Prism.languages.fhirpath = {
    // Comments
    'comment': {
      pattern: /\/\*[\s\S]*?\*\/|\/\/.*/,
      greedy: true,
    },
    // String literals (single and double quotes)
    'string': {
      pattern: /'(?:\\.|[^\\'])*'|"(?:\\.|[^\\"])*"/,
      greedy: true,
    },
    // Numbers (integers and decimals)
    'number': /\b\d+\.?\d*\b/,
    // Boolean literals
    'boolean': /\b(?:true|false)\b/,
    // Null literal
    'null': {
      pattern: /\b(?:null|empty)\b/,
      alias: 'keyword',
    },
    // Keywords and operators
    'keyword': /\b(?:and|or|xor|implies|as|is|div|mod|in|contains|if|then|else|where|select|all|any|exists|count|distinct|first|last|tail|skip|take|union|combine|intersect|exclude|iif|toInteger|toDecimal|toString|convertsToInteger|convertsToDecimal|convertsToString|convertsToDateTime|convertsToTime)\b/i,
    // Functions (common FHIRPath functions)
    'function': /\b(?:empty|exists|all|any|count|distinct|first|last|tail|skip|take|union|combine|intersect|exclude|where|select|iif|matches|contains|startsWith|endsWith|length|substring|replace|indexOf|toInteger|toDecimal|toString|toBoolean|toDateTime|toTime|convertsTo|ofType|conformsTo|memberOf|subsumes|subsumedBy|now|today|hasValue|getValue|trace|log|extension)\b/i,
    // Resource types (common FHIR resources)
    'class-name': /\b(?:Patient|Observation|Condition|Procedure|MedicationRequest|AllergyIntolerance|Immunization|DiagnosticReport|Encounter|Practitioner|Organization|Bundle|Composition|DocumentReference|Provenance|Consent|Claim|Coverage)\b/,
    // Field paths and properties
    'property': /\b[a-zA-Z_][a-zA-Z0-9_]*(?=\s*[.[])/,
    // Operators
    'operator': /[+\-*/%<>=!&|]+|\.\.|\$this|\$index|\$total/,
    // Punctuation
    'punctuation': /[()[\]{}.,:;]/,
  };
}

/**
 * Props for the FHIRPathEditor component
 */
interface FHIRPathEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  minHeight?: number;
  maxHeight?: number;
  showLineNumbers?: boolean;
  readOnly?: boolean;
  resourceTypes?: string[]; // For context-aware autocomplete
  enableAutocomplete?: boolean;
}

/**
 * FHIRPathEditor Component
 * 
 * A code editor with FHIRPath syntax highlighting using Prism.js
 * Provides a rich editing experience for FHIRPath expressions
 */
export function FHIRPathEditor({
  value,
  onChange,
  placeholder = 'Enter FHIRPath expression...',
  className,
  disabled = false,
  minHeight = 100,
  maxHeight = 400,
  showLineNumbers = true,
  readOnly = false,
  resourceTypes = [],
  enableAutocomplete = true,
}: FHIRPathEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [cursorPosition, setCursorPosition] = useState(0);
  const autocomplete = useFHIRPathAutocomplete();

  /**
   * Highlight code using Prism.js
   */
  const highlight = (code: string) => {
    try {
      return Prism.highlight(code, Prism.languages.fhirpath, 'fhirpath');
    } catch (error) {
      console.error('Error highlighting code:', error);
      return code;
    }
  };

  /**
   * Handle Tab key to insert spaces instead of losing focus
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.target as HTMLTextAreaElement;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue = value.substring(0, start) + '  ' + value.substring(end);
      onChange(newValue);
      // Set cursor position after the inserted spaces
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }
  };

  /**
   * Handle value change and trigger autocomplete
   */
  const handleValueChange = (newValue: string) => {
    onChange(newValue);

    // Get cursor position from textarea
    if (textareaRef.current) {
      const cursorPos = textareaRef.current.selectionStart;
      setCursorPosition(cursorPos);

      // Trigger autocomplete if enabled and typing
      if (enableAutocomplete && !readOnly && !disabled) {
        const textBeforeCursor = newValue.substring(0, cursorPos);
        const shouldShowAutocomplete =
          /[\w.]$/.test(textBeforeCursor) && // Typing a word or after a dot
          !autocomplete.isOpen;

        if (shouldShowAutocomplete) {
          // Calculate position for autocomplete popup
          const textarea = textareaRef.current;
          const rect = textarea.getBoundingClientRect();
          
          // Estimate cursor position (simplified)
          const lineHeight = 24; // Approximate line height
          const lines = textBeforeCursor.split('\n');
          const currentLine = lines.length - 1;
          const top = rect.top + (currentLine * lineHeight) + lineHeight + window.scrollY;
          const left = rect.left + 60 + window.scrollX; // 60px for line numbers

          autocomplete.open({ top, left });
        }
      }
    }
  };

  /**
   * Handle autocomplete selection
   */
  const handleAutocompleteSelect = (
    suggestion: AutocompleteSuggestion,
    startPos: number,
    endPos: number
  ) => {
    const insertText = suggestion.insertText || suggestion.label;
    const newValue =
      value.substring(0, startPos) +
      insertText +
      value.substring(endPos);
    
    onChange(newValue);
    
    // Update cursor position
    const newCursorPos = startPos + insertText.length;
    setCursorPosition(newCursorPos);
    
    // Set focus back to editor
    if (textareaRef.current) {
      textareaRef.current.focus();
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = newCursorPos;
          textareaRef.current.selectionEnd = newCursorPos;
        }
      }, 0);
    }
  };

  /**
   * Capture textarea ref for cursor position tracking
   */
  useEffect(() => {
    if (editorRef.current) {
      const textarea = editorRef.current.querySelector('textarea');
      if (textarea) {
        textareaRef.current = textarea;
      }
    }
  }, []);

  /**
   * Get line count for line numbers
   */
  const lineCount = value.split('\n').length;

  return (
    <div className={cn('relative', className)}>
      <div
        className={cn(
          'border rounded-md overflow-hidden',
          'bg-slate-950 text-slate-50',
          disabled && 'opacity-50 cursor-not-allowed',
          'font-mono text-sm'
        )}
        ref={editorRef}
        style={{
          minHeight: `${minHeight}px`,
          maxHeight: `${maxHeight}px`,
        }}
      >
        <div className="flex">
          {/* Line numbers */}
          {showLineNumbers && (
            <div
              className="select-none border-r border-slate-800 bg-slate-900 px-2 py-3 text-right text-slate-500"
              style={{ minWidth: '3em' }}
            >
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i + 1} style={{ height: '1.5em' }}>
                  {i + 1}
                </div>
              ))}
            </div>
          )}

          {/* Code editor */}
          <div className="flex-1">
            <Editor
              value={value}
              onValueChange={handleValueChange}
              highlight={highlight}
              padding={12}
              disabled={disabled || readOnly}
              placeholder={placeholder}
              onKeyDown={handleKeyDown}
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: '14px',
                lineHeight: '1.5em',
                minHeight: `${minHeight}px`,
                maxHeight: `${maxHeight}px`,
                overflow: 'auto',
              }}
              textareaClassName="focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Autocomplete popup */}
      {enableAutocomplete && (
        <FHIRPathAutocomplete
          value={value}
          cursorPosition={cursorPosition}
          onSelect={handleAutocompleteSelect}
          resourceTypes={resourceTypes}
          isOpen={autocomplete.isOpen}
          onClose={autocomplete.close}
          position={autocomplete.position}
        />
      )}

      {/* Helper info */}
      <div className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
        <div className="flex-1 space-y-1">
          <p>
            <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Tab</kbd> to indent •{' '}
            <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Ctrl+Space</kbd> autocomplete
          </p>
          <p className="text-slate-500">
            Syntax highlighting and intelligent autocomplete for FHIRPath
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * FHIRPath expression examples for reference
 */
export const FHIRPATH_EXAMPLES = {
  requiredField: {
    label: 'Required Field',
    expression: 'name.exists() and name.family.exists()',
    description: 'Check if a field exists and has required properties',
  },
  conditional: {
    label: 'Conditional Logic',
    expression: 'reaction.where(severity = \'severe\').exists() implies criticality = \'high\'',
    description: 'If severe reactions exist, criticality must be high',
  },
  collection: {
    label: 'Collection Operations',
    expression: 'dosageInstruction.all(text.exists() or timing.exists())',
    description: 'All items in a collection must meet a condition',
  },
  dateValidation: {
    label: 'Date Validation',
    expression: 'birthDate <= today()',
    description: 'Birth date must be in the past',
  },
  referenceCheck: {
    label: 'Reference Validation',
    expression: 'subject.reference.exists() and subject.reference.startsWith(\'Patient/\')',
    description: 'Check reference exists and points to correct resource type',
  },
  multipleConditions: {
    label: 'Multiple Conditions',
    expression: '(status = \'final\' or status = \'amended\') and effectiveDateTime.exists()',
    description: 'Combine multiple conditions with AND/OR',
  },
  stringOperations: {
    label: 'String Operations',
    expression: 'identifier.where(system = \'http://hl7.org/fhir/sid/us-ssn\' and value.matches(\'^\\d{3}-\\d{2}-\\d{4}$\'))',
    description: 'Filter identifiers and validate format with regex',
  },
  counting: {
    label: 'Counting Elements',
    expression: 'name.count() > 0 and telecom.where(system = \'phone\').count() >= 1',
    description: 'Count elements and ensure minimum requirements',
  },
};

