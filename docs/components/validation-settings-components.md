# Validation Settings Components Documentation

## Overview

The Validation Settings components provide a simplified interface for managing validation configuration. The components focus on essential functionality: 6 validation aspects, performance settings, and resource type filtering.

## Components

### 1. ValidationSettingsTab

Main settings tab component for the simplified validation settings interface.

**Location:** `client/src/components/settings/validation-settings-tab.tsx`

**Props:**
```typescript
interface ValidationSettingsTabProps {
  serverId?: number;
  onSettingsChange?: (settings: ValidationSettings) => void;
  className?: string;
}
```

**Features:**
- 6 validation aspects toggle and severity configuration
- Performance settings (maxConcurrent, batchSize)
- Resource type filtering with FHIR version awareness
- Reset to defaults functionality
- Auto-save with validation
- Migration warnings for FHIR version changes

**Usage:**
```tsx
import { ValidationSettingsTab } from '@/components/settings/validation-settings-tab';

function SettingsPage() {
  return (
    <ValidationSettingsTab 
      serverId={1}
      onSettingsChange={(settings) => console.log('Settings changed:', settings)}
    />
  );
}
```

### 2. ValidationAspectsDropdown

Quick access dropdown for validation aspects in the app header.

**Location:** `client/src/components/ui/validation-aspects-dropdown.tsx`

**Props:**
```typescript
interface ValidationAspectsDropdownProps {
  serverId?: number;
  onAspectToggle?: (aspectId: string, enabled: boolean) => void;
  onPerformanceChange?: (performance: PerformanceSettings) => void;
  className?: string;
}
```

**Features:**
- Quick toggle for all 6 validation aspects
- Performance settings adjustment
- Compact header-friendly design
- Real-time updates

**Usage:**
```tsx
import { ValidationAspectsDropdown } from '@/components/ui/validation-aspects-dropdown';

function AppHeader() {
  return (
    <ValidationAspectsDropdown 
      serverId={1}
      onAspectToggle={(aspectId, enabled) => {
        console.log(`Aspect ${aspectId} toggled: ${enabled}`);
      }}
    />
  );
}
```

### 3. ValidationAspectsPanel

Detailed panel for managing validation aspects with advanced options.

**Location:** `client/src/components/dashboard/controls/ValidationAspectsPanel.tsx`

**Props:**
```typescript
interface ValidationAspectsPanelProps {
  serverId?: number;
  showAdvanced?: boolean;
  onSettingsChange?: (settings: ValidationSettings) => void;
  className?: string;
}
```

**Features:**
- Individual aspect configuration
- Severity level adjustment
- Bulk operations (enable/disable all)
- Settings validation and error display
- Change tracking and undo functionality

**Usage:**
```tsx
import { ValidationAspectsPanel } from '@/components/dashboard/controls/ValidationAspectsPanel';

function DashboardPage() {
  return (
    <ValidationAspectsPanel 
      serverId={1}
      showAdvanced={true}
      onSettingsChange={(settings) => {
        // Handle settings changes
      }}
    />
  );
}
```

## Hooks

### 1. useValidationSettings

Main hook for managing validation settings state and operations.

**Location:** `client/src/hooks/use-validation-settings.ts`

**Interface:**
```typescript
interface UseValidationSettingsReturn {
  // State
  settings: ValidationSettings | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  
  // Actions
  updateSettings: (updates: Partial<ValidationSettings>) => Promise<void>;
  saveSettings: () => Promise<void>;
  resetToDefaults: () => Promise<void>;
  validateSettings: (settings: ValidationSettings) => Promise<boolean>;
  
  // Utilities
  isDirty: boolean;
  hasChanges: boolean;
  canSave: boolean;
}
```

**Usage:**
```tsx
import { useValidationSettings } from '@/hooks/use-validation-settings';

function SettingsComponent() {
  const {
    settings,
    loading,
    error,
    updateSettings,
    saveSettings,
    resetToDefaults,
    isDirty
  } = useValidationSettings({ serverId: 1 });

  const handleAspectToggle = async (aspectId: string, enabled: boolean) => {
    await updateSettings({
      aspects: {
        ...settings?.aspects,
        [aspectId]: { ...settings?.aspects[aspectId], enabled }
      }
    });
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {/* Settings UI */}
      {isDirty && (
        <button onClick={saveSettings}>Save Changes</button>
      )}
    </div>
  );
}
```

### 2. useValidationSettingsMigration

Hook for managing FHIR version migration of validation settings.

**Location:** `client/src/hooks/use-validation-settings-migration.ts`

**Interface:**
```typescript
interface UseValidationSettingsMigrationReturn {
  // State
  detectedVersion: FHIRVersion | null;
  migrationImpact: MigrationImpact | null;
  migrationResult: MigrationResult | null;
  isDetecting: boolean;
  isMigrating: boolean;
  userConfirmed: boolean;
  error: string | null;
  
  // Actions
  detectFhirVersion: () => Promise<void>;
  assessMigrationImpact: (fromVersion: FHIRVersion, toVersion: FHIRVersion) => Promise<void>;
  migrateSettings: (fromVersion: FHIRVersion, toVersion: FHIRVersion) => Promise<void>;
  confirmMigration: () => void;
  cancelMigration: () => void;
}
```

**Usage:**
```tsx
import { useValidationSettingsMigration } from '@/hooks/use-validation-settings-migration';

function MigrationComponent() {
  const {
    detectedVersion,
    migrationImpact,
    isMigrating,
    detectFhirVersion,
    assessMigrationImpact,
    migrateSettings,
    confirmMigration
  } = useValidationSettingsMigration({ 
    serverId: 1, 
    autoMigrate: true,
    currentVersion: 'R4'
  });

  useEffect(() => {
    detectFhirVersion();
  }, []);

  const handleVersionChange = async (newVersion: FHIRVersion) => {
    await assessMigrationImpact('R4', newVersion);
    if (migrationImpact?.settings.compatible) {
      await migrateSettings('R4', newVersion);
    }
  };

  return (
    <div>
      {migrationImpact && (
        <MigrationDialog 
          impact={migrationImpact}
          onConfirm={confirmMigration}
        />
      )}
    </div>
  );
}
```

### 3. useFHIRVersionDetection

Hook for detecting FHIR version from server capabilities.

**Location:** `client/src/hooks/use-fhir-version-detection.ts`

**Interface:**
```typescript
interface UseFHIRVersionDetectionReturn {
  // State
  version: FHIRVersion | null;
  loading: boolean;
  error: string | null;
  
  // Actions
  detectVersion: () => Promise<void>;
  refreshVersion: () => Promise<void>;
  
  // Utilities
  isR4: boolean;
  isR5: boolean;
  resourceTypes: string[];
  getResourceTypesForVersion: (version: FHIRVersion) => string[];
}
```

**Usage:**
```tsx
import { useFHIRVersionDetection } from '@/hooks/use-fhir-version-detection';

function VersionAwareComponent() {
  const {
    version,
    loading,
    resourceTypes,
    detectVersion
  } = useFHIRVersionDetection({ serverId: 1 });

  useEffect(() => {
    detectVersion();
  }, []);

  if (loading) return <div>Detecting FHIR version...</div>;

  return (
    <div>
      <p>FHIR Version: {version}</p>
      <p>Available Resource Types: {resourceTypes.length}</p>
    </div>
  );
}
```

## Utilities

### 1. ValidationSettingsIntegration

Utility functions for integrating validation settings with the UI.

**Location:** `client/src/lib/validation-settings-integration.ts`

**Key Functions:**
```typescript
// Aspect management
export const getAspectInfo = (aspectId: string): ValidationAspectInfo;
export const isAspectEnabled = (settings: ValidationSettings, aspectId: string): boolean;
export const toggleAspect = (settings: ValidationSettings, aspectId: string): ValidationSettings;

// Settings validation
export const validateSettings = (settings: ValidationSettings): ValidationResult;
export const getValidationErrors = (settings: ValidationSettings): string[];

// Color coding and display
export const getAspectColor = (aspectId: string): string;
export const getSeverityColor = (severity: string): string;
export const getAspectIcon = (aspectId: string): string;
```

### 2. ValidationScoring

Utility functions for calculating validation scores and metrics.

**Location:** `client/src/lib/validation-scoring.ts`

**Key Functions:**
```typescript
// Score calculation
export const calculateValidationScore = (results: ValidationResult[]): number;
export const calculateAspectScore = (aspectId: string, results: ValidationResult[]): number;
export const calculateAggregatedScore = (scores: AspectScores): number;

// Coverage and quality metrics
export const calculateCoverage = (results: ValidationResult[]): CoverageMetrics;
export const calculateQualityMetrics = (results: ValidationResult[]): QualityMetrics;
export const getResourceValidationSummary = (results: ValidationResult[]): ResourceSummary;
```

### 3. ValidationSettingsMigration

Utility functions for migrating settings between FHIR versions.

**Location:** `client/src/lib/validation-settings-migration.ts`

**Key Functions:**
```typescript
// Migration logic
export const migrateSettingsForVersion = (
  settings: ValidationSettings, 
  fromVersion: FHIRVersion, 
  toVersion: FHIRVersion
): ValidationSettings;

// Impact assessment
export const assessMigrationImpact = (
  settings: ValidationSettings,
  fromVersion: FHIRVersion,
  toVersion: FHIRVersion
): MigrationImpact;

// Resource type adaptation
export const adaptResourceTypesForVersion = (
  resourceTypes: string[],
  fromVersion: FHIRVersion,
  toVersion: FHIRVersion
): string[];
```

## Styling and Theming

### CSS Classes

All components use consistent CSS classes for styling:

```css
/* Main container */
.validation-settings-tab { }

/* Sections */
.validation-aspects-section { }
.performance-settings-section { }
.resource-types-section { }

/* Aspect controls */
.aspect-toggle { }
.aspect-severity { }
.aspect-info { }

/* Performance controls */
.performance-input { }
.performance-label { }

/* Resource type controls */
.resource-types-toggle { }
.resource-types-input { }
.resource-types-list { }

/* States */
.settings-changed { }
.settings-loading { }
.settings-error { }
.settings-success { }

/* Migration */
.migration-dialog { }
.migration-impact { }
.migration-warning { }
```

### Theme Variables

Components support theming through CSS custom properties:

```css
:root {
  --validation-aspect-structural: #ef4444;
  --validation-aspect-profile: #f59e0b;
  --validation-aspect-terminology: #3b82f6;
  --validation-aspect-reference: #8b5cf6;
  --validation-aspect-business-rules: #10b981;
  --validation-aspect-metadata: #6b7280;
  
  --severity-error: #ef4444;
  --severity-warning: #f59e0b;
  --severity-info: #3b82f6;
  
  --settings-bg: #ffffff;
  --settings-border: #e5e7eb;
  --settings-text: #111827;
  --settings-muted: #6b7280;
}
```

## Testing

### Component Tests

Each component includes comprehensive tests:

```typescript
// Example test structure
describe('ValidationSettingsTab', () => {
  it('should render all validation aspects', () => {
    render(<ValidationSettingsTab serverId={1} />);
    
    expect(screen.getByText('Structural Validation')).toBeInTheDocument();
    expect(screen.getByText('Profile Validation')).toBeInTheDocument();
    expect(screen.getByText('Terminology Validation')).toBeInTheDocument();
    expect(screen.getByText('Reference Validation')).toBeInTheDocument();
    expect(screen.getByText('Business Rules Validation')).toBeInTheDocument();
    expect(screen.getByText('Metadata Validation')).toBeInTheDocument();
  });

  it('should update settings when aspect is toggled', async () => {
    const onSettingsChange = vi.fn();
    render(<ValidationSettingsTab serverId={1} onSettingsChange={onSettingsChange} />);
    
    const structuralToggle = screen.getByTestId('aspect-toggle-structural');
    await user.click(structuralToggle);
    
    expect(onSettingsChange).toHaveBeenCalledWith(
      expect.objectContaining({
        aspects: expect.objectContaining({
          structural: expect.objectContaining({ enabled: false })
        })
      })
    );
  });
});
```

### Hook Tests

Hooks are tested with React Testing Library:

```typescript
describe('useValidationSettings', () => {
  it('should load settings on mount', async () => {
    const { result } = renderHook(() => useValidationSettings({ serverId: 1 }));
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    
    expect(result.current.settings).toBeTruthy();
    expect(result.current.loading).toBe(false);
  });

  it('should update settings when updateSettings is called', async () => {
    const { result } = renderHook(() => useValidationSettings({ serverId: 1 }));
    
    await act(async () => {
      await result.current.updateSettings({
        performance: { maxConcurrent: 10, batchSize: 100 }
      });
    });
    
    expect(result.current.settings?.performance.maxConcurrent).toBe(10);
    expect(result.current.settings?.performance.batchSize).toBe(100);
  });
});
```

## Accessibility

All components follow accessibility best practices:

- **ARIA Labels**: All interactive elements have proper ARIA labels
- **Keyboard Navigation**: Full keyboard support for all controls
- **Screen Reader Support**: Semantic HTML and proper roles
- **Focus Management**: Clear focus indicators and logical tab order
- **Color Contrast**: Sufficient contrast ratios for all text and UI elements

### Example ARIA Implementation

```tsx
<button
  aria-label={`Toggle ${aspectName} validation`}
  aria-pressed={enabled}
  aria-describedby={`${aspectId}-description`}
  onClick={() => handleToggle(aspectId)}
>
  {aspectName}
</button>
<div id={`${aspectId}-description`} className="sr-only">
  {aspectDescription}
</div>
```

## Performance Considerations

### Optimization Strategies

1. **Memoization**: Components use React.memo and useMemo for expensive calculations
2. **Lazy Loading**: Large components are loaded on demand
3. **Debounced Updates**: Settings changes are debounced to prevent excessive API calls
4. **Virtual Scrolling**: Large lists use virtual scrolling for better performance

### Bundle Size

Components are optimized for minimal bundle impact:

- Tree-shakeable exports
- Minimal dependencies
- Code splitting for advanced features
- Optimized bundle analysis

## Migration Guide

### From Complex to Simplified Components

The components have been simplified from complex implementations:

**Removed Features:**
- Complex preset management
- Audit trail displays
- Real-time synchronization indicators
- Advanced backup/restore functionality

**Simplified Features:**
- 6 core validation aspects only
- Basic performance settings
- Simple resource type filtering
- FHIR version-aware migration

**Migration Steps:**
1. Update component imports to use new simplified components
2. Remove complex prop configurations
3. Update event handlers to match new simplified interfaces
4. Test functionality with new simplified schema

## Support and Troubleshooting

### Common Issues

1. **Settings not loading**: Check server connectivity and authentication
2. **Migration failures**: Verify FHIR version compatibility
3. **Validation errors**: Check input constraints and data types
4. **Performance issues**: Monitor API call frequency and debouncing

### Debug Mode

Enable debug mode for detailed logging:

```typescript
const { settings, error } = useValidationSettings({ 
  serverId: 1,
  debug: true // Enable detailed logging
});
```

### Error Handling

All components include comprehensive error handling:

- Network error recovery
- Validation error display
- Graceful degradation
- User-friendly error messages

