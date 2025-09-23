// Dashboard Control Components - Single responsibility: Export control components
// Follows global rules: Simple exports, no custom logic, single responsibility

// Clean control components (renamed from WiredWireframe for better naming)
export { ValidationControlPanel } from './ValidationControlPanel';
export { ValidationAspectsPanel } from './ValidationAspectsPanel';

// Legacy exports for backward compatibility (deprecated)
export { WiredWireframeValidationControlPanel } from './WiredWireframeValidationControlPanel';
export { WiredWireframeValidationAspectsPanel } from './WiredWireframeValidationAspectsPanel';