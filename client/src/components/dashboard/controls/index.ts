// Dashboard Control Components - Single responsibility: Export control components
// Follows global rules: Simple exports, no custom logic, single responsibility

// Base control components
export { default as ValidationControlPanel } from './ValidationControlPanel';
export { 
  default as ProgressBar, 
  CompactProgressBar, 
  ValidationProgressBar 
} from './ProgressBar';
export { default as ValidationAspectsPanel } from './ValidationAspectsPanel';

// Wired control components (connected to real APIs)
export { default as WiredValidationControlPanel } from './WiredValidationControlPanel';
export { default as WiredValidationAspectsPanel } from './WiredValidationAspectsPanel';
