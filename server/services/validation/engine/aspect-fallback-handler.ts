import type { ValidationIssue } from '@shared/types/validation';
import type { ValidationAspect, ValidationSeverity } from '../types/validation-types';

export function aspectUnavailableIssue(aspect: ValidationAspect, reason?: string): ValidationIssue {
  return {
    id: `aspect-unavailable-${Date.now()}`,
    aspect,
    severity: 'info' as ValidationSeverity,
    message: reason || `Aspect '${aspect}' not available; skipped`,
    code: 'ASPECT_UNAVAILABLE'
  } as any;
}


