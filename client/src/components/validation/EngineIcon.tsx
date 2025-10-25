/**
 * Validation Engine Icon Component
 * 
 * Displays icons for different validation engines
 */

import { 
  FileCode2, 
  Server, 
  Database, 
  Code2, 
  CheckCircle2,
  Layers
} from 'lucide-react';

export type ValidationEngine = 
  | 'hapi' 
  | 'schema' 
  | 'server' 
  | 'ontoserver'
  | 'cached'
  | 'internal' 
  | 'fhirpath' 
  | 'custom'
  | 'auto';

interface EngineIconProps {
  engine: ValidationEngine | string;
  className?: string;
  size?: number;
}

/**
 * Get icon component for a validation engine
 */
export function getEngineIconComponent(engine: ValidationEngine | string) {
  const engineLower = engine.toLowerCase();
  
  switch (engineLower) {
    case 'hapi':
      return FileCode2; // HAPI FHIR Validator - document with code
    case 'schema':
      return Layers; // Schema validator - layers/structure
    case 'server':
    case 'ontoserver':
      return Server; // Terminology/FHIR Server
    case 'cached':
      return Database; // Cached terminology
    case 'internal':
      return CheckCircle2; // Internal validator - check circle
    case 'fhirpath':
    case 'custom':
      return Code2; // FHIRPath/Custom - code brackets
    case 'auto':
      return Layers; // Auto detection - layers
    default:
      return FileCode2; // Default fallback
  }
}

/**
 * Engine icon component
 */
export function EngineIcon({ engine, className = '', size = 14 }: EngineIconProps) {
  const IconComponent = getEngineIconComponent(engine);
  
  return <IconComponent className={className} size={size} />;
}

/**
 * Get friendly display name for engine
 */
export function getEngineName(engine: ValidationEngine | string): string {
  const engineLower = engine.toLowerCase();
  
  const nameMap: Record<string, string> = {
    hapi: 'HAPI',
    schema: 'Schema',
    server: 'Server',
    ontoserver: 'OntoServer',
    cached: 'Cached',
    internal: 'Internal',
    fhirpath: 'FHIRPath',
    custom: 'Custom',
    auto: 'Auto'
  };
  
  return nameMap[engineLower] || engine;
}

/**
 * Get description for engine
 */
export function getEngineDescription(engine: ValidationEngine | string): string {
  const engineLower = engine.toLowerCase();
  
  const descriptionMap: Record<string, string> = {
    hapi: 'HAPI FHIR Validator',
    schema: 'Schema Validator',
    server: 'Terminology Server',
    ontoserver: 'OntoServer Terminology',
    cached: 'Cached Terminology',
    internal: 'Internal Validator',
    fhirpath: 'FHIRPath Engine',
    custom: 'Custom Validator',
    auto: 'Auto Detection'
  };
  
  return descriptionMap[engineLower] || engine;
}

