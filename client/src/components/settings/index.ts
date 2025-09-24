/**
 * Settings Components - Unified Export
 * 
 * Exports all settings related components for easy importing.
 */

// Main components
export { default as ServerConnectionModal } from './server-connection-modal-new';

// Server management components
export { ServerList } from './server-list';
export { ServerForm } from './server-form';

// Server operations and utilities
export { useServerOperations } from './server-operations';
export { 
  testFhirConnection,
  handleConnectionTestError,
  handleConnectionTestSuccess,
  validateFhirUrl,
  getConnectionStatus,
  formatConnectionDuration,
  getServerType,
  getSupportedFhirVersions
} from './connection-testing';

// Settings tab components (simplified)
export { ValidationSettingsTab } from './validation-settings-tab-simplified';
export { ServerManagementTab } from './server-management-tab';
export { DashboardSettingsTab } from './dashboard-settings-tab';
export { SystemSettingsTab } from './system-settings-tab';

// Types (re-exported for convenience)
export type {
  ServerFormData,
  FhirServer,
  ConnectionTestResult
} from './server-connection-modal-new';