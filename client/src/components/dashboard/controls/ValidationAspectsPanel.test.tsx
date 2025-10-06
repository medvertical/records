import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ValidationAspectsPanel } from './ValidationAspectsPanel';
import { useValidationSettingsIntegration } from '@/lib/validation-settings-integration';
import { useValidationSettingsChangeDetection } from '@/lib/validation-settings-change-detector';

// Mock all the hooks and utilities
vi.mock('@/lib/validation-settings-integration');
vi.mock('@/lib/validation-settings-change-detector');
vi.mock('@/lib/validation-settings-validator');
vi.mock('./ValidationSettingsErrors', () => ({
  default: ({ validationResult }: { validationResult: any }) => (
    <div data-testid="validation-settings-errors">
      Errors: {validationResult?.errors?.length || 0}
    </div>
  ),
}));
vi.mock('./ValidationSettingsChanges', () => ({
  default: ({ changes }: { changes: any[] }) => (
    <div data-testid="validation-settings-changes">
      Changes: {changes?.length || 0}
    </div>
  ),
}));

describe('ValidationAspectsPanel', () => {
  const mockUseValidationSettingsIntegration = vi.mocked(useValidationSettingsIntegration);
  const mockUseValidationSettingsChangeDetection = vi.mocked(useValidationSettingsChangeDetection);

  const defaultMockSettings = {
    settings: {
      aspects: {
        structural: { enabled: true, severity: 'error' },
        profile: { enabled: false, severity: 'warning' },
        terminology: { enabled: true, severity: 'info' },
      },
    },
    loading: false,
    error: null,
    aspects: [
      { 
        id: 'structural', 
        name: 'Structural Validation', 
        description: 'Validates structural aspects',
        enabled: true, 
        severity: 'error',
        category: 'core'
      },
      { 
        id: 'profile', 
        name: 'Profile Validation', 
        description: 'Validates profile aspects',
        enabled: false, 
        severity: 'warning',
        category: 'core'
      },
      { 
        id: 'terminology', 
        name: 'Terminology Validation', 
        description: 'Validates terminology aspects',
        enabled: true, 
        severity: 'info',
        category: 'terminology'
      },
    ],
    enabledAspects: [
      { 
        id: 'structural', 
        name: 'Structural Validation', 
        description: 'Validates structural aspects',
        enabled: true, 
        severity: 'error',
        category: 'core'
      },
      { 
        id: 'terminology', 
        name: 'Terminology Validation', 
        description: 'Validates terminology aspects',
        enabled: true, 
        severity: 'info',
        category: 'terminology'
      },
    ],
    disabledAspects: [
      { 
        id: 'profile', 
        name: 'Profile Validation', 
        description: 'Validates profile aspects',
        enabled: false, 
        severity: 'warning',
        category: 'core'
      },
    ],
    updateAspect: vi.fn(),
    toggleAspect: vi.fn(),
    setAspectSeverity: vi.fn(),
    enableAllAspects: vi.fn(),
    disableAllAspects: vi.fn(),
    resetToDefaults: vi.fn(),
    isAspectEnabled: vi.fn((id: string) => id !== 'profile'),
    getAspectSeverity: vi.fn((id: string) => {
      const severityMap: Record<string, string> = {
        structural: 'error',
        profile: 'warning',
        terminology: 'info',
      };
      return severityMap[id] || 'info';
    }),
  };

  const defaultMockChangeDetection = {
    hasChanges: false,
    changes: [],
    pendingChanges: [],
    isDirty: false,
    canUndo: false,
    canRedo: false,
    lastChangeTime: null,
    changeCount: 0,
    undo: vi.fn(),
    redo: vi.fn(),
    reset: vi.fn(),
    applyChanges: vi.fn(),
    discardChanges: vi.fn(),
    getChangeSummary: vi.fn(() => ({})),
    getAffectedAreas: vi.fn(() => []),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockUseValidationSettingsIntegration.mockReturnValue(defaultMockSettings);
    mockUseValidationSettingsChangeDetection.mockReturnValue(defaultMockChangeDetection);

    // Mock validation settings validator
    vi.mocked(require('@/lib/validation-settings-validator').ValidationSettingsValidatorUtils).mockReturnValue({
      validate: vi.fn(() => ({
        isValid: true,
        errors: [],
        warnings: [],
        normalizedSettings: null,
      })),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('renders the validation aspects panel with correct title', () => {
      render(<ValidationAspectsPanel />);
      
      expect(screen.getByText('Validation Aspects Configuration')).toBeInTheDocument();
    });

    it('shows loading state when loading is true', () => {
      mockUseValidationSettingsIntegration.mockReturnValue({
        ...defaultMockSettings,
        loading: true,
      });

      render(<ValidationAspectsPanel />);
      
      expect(screen.getByText('Loading validation aspects...')).toBeInTheDocument();
    });

    it('shows error state when there is an error', () => {
      mockUseValidationSettingsIntegration.mockReturnValue({
        ...defaultMockSettings,
        error: 'Failed to load settings',
      });

      render(<ValidationAspectsPanel />);
      
      expect(screen.getByText('Error loading validation aspects: Failed to load settings')).toBeInTheDocument();
    });

    it('shows enabled aspects count in badge', () => {
      render(<ValidationAspectsPanel />);
      
      expect(screen.getByText('2/3 enabled')).toBeInTheDocument();
    });
  });

  describe('Compact Mode', () => {
    it('renders in compact mode when compact prop is true', () => {
      render(<ValidationAspectsPanel compact={true} />);
      
      expect(screen.getByText('Validation Aspects')).toBeInTheDocument();
      expect(screen.getByText('2/3 enabled')).toBeInTheDocument();
    });

    it('shows all aspects in compact mode', () => {
      render(<ValidationAspectsPanel compact={true} />);
      
      expect(screen.getByText('Structural Validation')).toBeInTheDocument();
      expect(screen.getByText('Profile Validation')).toBeInTheDocument();
      expect(screen.getByText('Terminology Validation')).toBeInTheDocument();
    });

    it('shows switches for each aspect in compact mode', () => {
      render(<ValidationAspectsPanel compact={true} />);
      
      const switches = screen.getAllByRole('switch');
      expect(switches).toHaveLength(3);
    });
  });

  describe('Full Mode', () => {
    it('renders in full mode by default', () => {
      render(<ValidationAspectsPanel />);
      
      expect(screen.getByText('Validation Aspects Configuration')).toBeInTheDocument();
    });

    it('shows enabled aspects section', () => {
      render(<ValidationAspectsPanel />);
      
      expect(screen.getByText('Enabled Aspects (2)')).toBeInTheDocument();
    });

    it('shows disabled aspects section', () => {
      render(<ValidationAspectsPanel />);
      
      expect(screen.getByText('Disabled Aspects (1)')).toBeInTheDocument();
    });

    it('shows control buttons when showControls is true', () => {
      render(<ValidationAspectsPanel showControls={true} />);
      
      expect(screen.getByText('Enable All')).toBeInTheDocument();
      expect(screen.getByText('Disable All')).toBeInTheDocument();
      expect(screen.getByText('Reset')).toBeInTheDocument();
    });

    it('hides control buttons when showControls is false', () => {
      render(<ValidationAspectsPanel showControls={false} />);
      
      expect(screen.queryByText('Enable All')).not.toBeInTheDocument();
      expect(screen.queryByText('Disable All')).not.toBeInTheDocument();
      expect(screen.queryByText('Reset')).not.toBeInTheDocument();
    });
  });

  describe('Aspect Toggle', () => {
    it('calls toggleAspect when switch is clicked', async () => {
      const mockToggleAspect = vi.fn();
      mockUseValidationSettingsIntegration.mockReturnValue({
        ...defaultMockSettings,
        toggleAspect: mockToggleAspect,
      });

      render(<ValidationAspectsPanel />);
      
      const switches = screen.getAllByRole('switch');
      fireEvent.click(switches[0]);

      await waitFor(() => {
        expect(mockToggleAspect).toHaveBeenCalledWith('structural');
      });
    });

    it('shows loading state while updating', async () => {
      const mockToggleAspect = vi.fn(() => new Promise(resolve => setTimeout(resolve, 100)));
      mockUseValidationSettingsIntegration.mockReturnValue({
        ...defaultMockSettings,
        toggleAspect: mockToggleAspect,
      });

      render(<ValidationAspectsPanel />);
      
      const switches = screen.getAllByRole('switch');
      fireEvent.click(switches[0]);

      // Switches should be disabled during update
      await waitFor(() => {
        const disabledSwitches = screen.getAllByRole('switch').filter(switchEl => switchEl.hasAttribute('disabled'));
        expect(disabledSwitches.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Severity Selection', () => {
    it('shows severity selectors for each aspect when showControls is true', () => {
      render(<ValidationAspectsPanel showControls={true} />);
      
      const selectTriggers = screen.getAllByRole('combobox');
      expect(selectTriggers.length).toBeGreaterThan(0);
    });

    it('calls setAspectSeverity when severity is changed', async () => {
      const mockSetAspectSeverity = vi.fn();
      mockUseValidationSettingsIntegration.mockReturnValue({
        ...defaultMockSettings,
        setAspectSeverity: mockSetAspectSeverity,
      });

      render(<ValidationAspectsPanel showControls={true} />);
      
      const selectTriggers = screen.getAllByRole('combobox');
      fireEvent.click(selectTriggers[0]);

      // This would normally open a dropdown, but we're just testing the click
      await waitFor(() => {
        expect(mockSetAspectSeverity).toHaveBeenCalled();
      });
    });
  });

  describe('Bulk Actions', () => {
    it('calls enableAllAspects when Enable All button is clicked', async () => {
      const mockEnableAllAspects = vi.fn();
      mockUseValidationSettingsIntegration.mockReturnValue({
        ...defaultMockSettings,
        enableAllAspects: mockEnableAllAspects,
      });

      render(<ValidationAspectsPanel showControls={true} />);
      
      const enableAllButton = screen.getByText('Enable All');
      fireEvent.click(enableAllButton);

      await waitFor(() => {
        expect(mockEnableAllAspects).toHaveBeenCalled();
      });
    });

    it('calls disableAllAspects when Disable All button is clicked', async () => {
      const mockDisableAllAspects = vi.fn();
      mockUseValidationSettingsIntegration.mockReturnValue({
        ...defaultMockSettings,
        disableAllAspects: mockDisableAllAspects,
      });

      render(<ValidationAspectsPanel showControls={true} />);
      
      const disableAllButton = screen.getByText('Disable All');
      fireEvent.click(disableAllButton);

      await waitFor(() => {
        expect(mockDisableAllAspects).toHaveBeenCalled();
      });
    });

    it('calls resetToDefaults when Reset button is clicked', async () => {
      const mockResetToDefaults = vi.fn();
      mockUseValidationSettingsIntegration.mockReturnValue({
        ...defaultMockSettings,
        resetToDefaults: mockResetToDefaults,
      });

      render(<ValidationAspectsPanel showControls={true} />);
      
      const resetButton = screen.getByText('Reset');
      fireEvent.click(resetButton);

      await waitFor(() => {
        expect(mockResetToDefaults).toHaveBeenCalled();
      });
    });
  });

  describe('Summary Section', () => {
    it('shows summary when showDetails is true', () => {
      render(<ValidationAspectsPanel showDetails={true} />);
      
      expect(screen.getByText('Total Aspects:')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('Enabled:')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('Disabled:')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('Categories:')).toBeInTheDocument();
    });

    it('hides summary when showDetails is false', () => {
      render(<ValidationAspectsPanel showDetails={false} />);
      
      expect(screen.queryByText('Total Aspects:')).not.toBeInTheDocument();
    });
  });

  describe('Validation Errors', () => {
    it('shows validation errors when there are errors', () => {
      const mockValidationResult = {
        isValid: false,
        errors: [{ message: 'Invalid configuration' }],
        warnings: [],
        normalizedSettings: null,
      };

      vi.mocked(require('@/lib/validation-settings-validator').ValidationSettingsValidatorUtils).mockReturnValue({
        validate: vi.fn(() => mockValidationResult),
      });

      render(<ValidationAspectsPanel showDetails={true} />);
      
      expect(screen.getByText('Validation Issues')).toBeInTheDocument();
      expect(screen.getByText('1 error')).toBeInTheDocument();
    });

    it('shows validation warnings when there are warnings', () => {
      const mockValidationResult = {
        isValid: true,
        errors: [],
        warnings: [{ message: 'Configuration warning' }],
        normalizedSettings: null,
      };

      vi.mocked(require('@/lib/validation-settings-validator').ValidationSettingsValidatorUtils).mockReturnValue({
        validate: vi.fn(() => mockValidationResult),
      });

      render(<ValidationAspectsPanel showDetails={true} />);
      
      expect(screen.getByText('Validation Issues')).toBeInTheDocument();
      expect(screen.getByText('1 warning')).toBeInTheDocument();
    });

    it('toggles validation errors display when Show Details button is clicked', () => {
      const mockValidationResult = {
        isValid: false,
        errors: [{ message: 'Invalid configuration' }],
        warnings: [],
        normalizedSettings: null,
      };

      vi.mocked(require('@/lib/validation-settings-validator').ValidationSettingsValidatorUtils).mockReturnValue({
        validate: vi.fn(() => mockValidationResult),
      });

      render(<ValidationAspectsPanel showDetails={true} />);
      
      const showDetailsButton = screen.getByText('Show Details');
      fireEvent.click(showDetailsButton);

      expect(screen.getByText('Hide Details')).toBeInTheDocument();
      expect(screen.getByTestId('validation-settings-errors')).toBeInTheDocument();
    });
  });

  describe('Settings Changes', () => {
    it('shows settings changes when there are changes', () => {
      mockUseValidationSettingsChangeDetection.mockReturnValue({
        ...defaultMockChangeDetection,
        hasChanges: true,
        changeCount: 2,
        isDirty: true,
        pendingChanges: [{ type: 'aspect', id: 'structural' }],
      });

      render(<ValidationAspectsPanel showDetails={true} />);
      
      expect(screen.getByText('Settings Changes')).toBeInTheDocument();
      expect(screen.getByText('1 pending')).toBeInTheDocument();
      expect(screen.getByText('2 total')).toBeInTheDocument();
    });

    it('toggles settings changes display when Show Details button is clicked', () => {
      mockUseValidationSettingsChangeDetection.mockReturnValue({
        ...defaultMockChangeDetection,
        hasChanges: true,
        changeCount: 2,
        changes: [{ type: 'aspect', id: 'structural' }],
      });

      render(<ValidationAspectsPanel showDetails={true} />);
      
      const showDetailsButton = screen.getByText('Show Details');
      fireEvent.click(showDetailsButton);

      expect(screen.getByText('Hide Details')).toBeInTheDocument();
      expect(screen.getByTestId('validation-settings-changes')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('handles toggleAspect errors gracefully', async () => {
      const mockToggleAspect = vi.fn().mockRejectedValue(new Error('Toggle failed'));
      mockUseValidationSettingsIntegration.mockReturnValue({
        ...defaultMockSettings,
        toggleAspect: mockToggleAspect,
      });

      render(<ValidationAspectsPanel />);
      
      const switches = screen.getAllByRole('switch');
      fireEvent.click(switches[0]);

      // Should not throw an error
      await waitFor(() => {
        expect(mockToggleAspect).toHaveBeenCalled();
      });
    });

    it('handles setAspectSeverity errors gracefully', async () => {
      const mockSetAspectSeverity = vi.fn().mockRejectedValue(new Error('Severity change failed'));
      mockUseValidationSettingsIntegration.mockReturnValue({
        ...defaultMockSettings,
        setAspectSeverity: mockSetAspectSeverity,
      });

      render(<ValidationAspectsPanel showControls={true} />);
      
      // Should not throw an error
      expect(() => {
        render(<ValidationAspectsPanel showControls={true} />);
      }).not.toThrow();
    });
  });

  describe('Props Handling', () => {
    it('handles missing props gracefully', () => {
      expect(() => {
        render(<ValidationAspectsPanel className={undefined} />);
      }).not.toThrow();
    });

    it('applies custom className', () => {
      const { container } = render(<ValidationAspectsPanel className="custom-class" />);
      
      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('Component Integration', () => {
    it('integrates with validation settings integration hook', () => {
      render(<ValidationAspectsPanel />);
      
      expect(mockUseValidationSettingsIntegration).toHaveBeenCalled();
    });

    it('integrates with validation settings change detection hook', () => {
      render(<ValidationAspectsPanel />);
      
      expect(mockUseValidationSettingsChangeDetection).toHaveBeenCalled();
    });

    it('validates settings when they change', () => {
      const mockValidate = vi.fn(() => ({
        isValid: true,
        errors: [],
        warnings: [],
        normalizedSettings: null,
      }));

      vi.mocked(require('@/lib/validation-settings-validator').ValidationSettingsValidatorUtils).mockReturnValue({
        validate: mockValidate,
      });

      render(<ValidationAspectsPanel />);
      
      expect(mockValidate).toHaveBeenCalledWith(defaultMockSettings.settings);
    });
  });
});
    });
  });
});

