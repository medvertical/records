import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Settings, 
  ToggleLeft, 
  ToggleRight, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Info,
  RefreshCw,
  RotateCcw
} from 'lucide-react';
import { 
  useValidationSettingsIntegration, 
  ValidationSettingsUtils,
  type ValidationAspectInfo 
} from '@/lib/validation-settings-integration';
import { 
  ValidationSettingsValidatorUtils,
  type ValidationResult 
} from '@/lib/validation-settings-validator';
import { 
  useValidationSettingsChangeDetection,
  ValidationSettingsChangeDetectorUtils 
} from '@/lib/validation-settings-change-detector';
import ValidationSettingsErrors from './ValidationSettingsErrors';
import ValidationSettingsChanges from './ValidationSettingsChanges';
import { cn } from '@/lib/utils';

interface ValidationAspectsPanelProps {
  className?: string;
  showDetails?: boolean;
  showControls?: boolean;
  compact?: boolean;
}

export const ValidationAspectsPanel: React.FC<ValidationAspectsPanelProps> = ({
  className,
  showDetails = true,
  showControls = true,
  compact = false,
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [showSettingsChanges, setShowSettingsChanges] = useState(false);
  const {
    settings,
    loading,
    error,
    aspects,
    enabledAspects,
    disabledAspects,
    updateAspect,
    toggleAspect,
    setAspectSeverity,
    enableAllAspects,
    disableAllAspects,
    resetToDefaults,
    isAspectEnabled,
    getAspectSeverity,
  } = useValidationSettingsIntegration();

  // Settings change detection
  const {
    hasChanges,
    changes,
    pendingChanges,
    isDirty,
    canUndo,
    canRedo,
    lastChangeTime,
    changeCount,
    undo,
    redo,
    reset,
    applyChanges,
    discardChanges,
    getChangeSummary,
    getAffectedAreas,
  } = useValidationSettingsChangeDetection(settings, {
    enableChangeDetection: true,
    debounceDelay: 300,
    trackHistory: true,
    maxHistorySize: 50,
    autoSave: false,
    showNotifications: true,
    highlightChanges: true,
    highlightDuration: 3000,
  });

  // Validate settings when they change
  React.useEffect(() => {
    if (settings) {
      const result = ValidationSettingsValidatorUtils.validate(settings);
      setValidationResult(result);
    }
  }, [settings]);

  const handleToggleAspect = async (aspectId: string) => {
    setIsUpdating(true);
    try {
      await toggleAspect(aspectId);
    } catch (error) {
      console.error('Failed to toggle aspect:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSetSeverity = async (aspectId: string, severity: 'error' | 'warning' | 'info') => {
    setIsUpdating(true);
    try {
      await setAspectSeverity(aspectId, severity);
    } catch (error) {
      console.error('Failed to set aspect severity:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleEnableAll = async () => {
    setIsUpdating(true);
    try {
      await enableAllAspects();
    } catch (error) {
      console.error('Failed to enable all aspects:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDisableAll = async () => {
    setIsUpdating(true);
    try {
      await disableAllAspects();
    } catch (error) {
      console.error('Failed to disable all aspects:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReset = async () => {
    setIsUpdating(true);
    try {
      await resetToDefaults();
    } catch (error) {
      console.error('Failed to reset to defaults:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRetryValidation = () => {
    if (settings) {
      const result = ValidationSettingsValidatorUtils.validate(settings);
      setValidationResult(result);
    }
  };

  const handleFixAll = () => {
    if (settings && validationResult?.normalizedSettings) {
      // Apply normalized settings to fix validation issues
      console.log('Applying normalized settings to fix validation issues');
      // This would typically involve calling the settings update function
      // with the normalized settings
    }
  };

  const getSeverityIcon = (severity: 'error' | 'warning' | 'info') => {
    switch (severity) {
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'info': return <Info className="h-4 w-4 text-blue-500" />;
      default: return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            <span>Loading validation aspects...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center text-red-600">
            <XCircle className="h-6 w-6 mr-2" />
            <span>Error loading validation aspects: {error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center justify-between">
            <span>Validation Aspects</span>
            <Badge variant="outline" className="text-sm">
              {enabledAspects.length}/{aspects.length} enabled
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {aspects.map((aspect) => (
            <div key={aspect.id} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">{ValidationSettingsUtils.getAspectIcon(aspect.id)}</span>
                <span className="text-sm font-medium">{aspect.name}</span>
              </div>
              <div className="flex items-center gap-2">
                {getSeverityIcon(aspect.severity)}
                <Switch
                  checked={aspect.enabled}
                  onCheckedChange={() => handleToggleAspect(aspect.id)}
                  disabled={isUpdating}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Validation Aspects Configuration
          </span>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-sm">
              {enabledAspects.length}/{aspects.length} enabled
            </Badge>
            {showControls && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleEnableAll}
                  disabled={isUpdating}
                  className="text-xs"
                >
                  Enable All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDisableAll}
                  disabled={isUpdating}
                  className="text-xs"
                >
                  Disable All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                  disabled={isUpdating}
                  className="text-xs"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Reset
                </Button>
              </div>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Enabled Aspects */}
        {enabledAspects.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-green-700 mb-3 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Enabled Aspects ({enabledAspects.length})
            </h4>
            <div className="space-y-3">
              {enabledAspects.map((aspect) => (
                <div
                  key={aspect.id}
                  className={cn(
                    'p-3 rounded-lg border',
                    ValidationSettingsUtils.getAspectCategoryColor(aspect.category)
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{ValidationSettingsUtils.getAspectIcon(aspect.id)}</span>
                      <div>
                        <h5 className="font-medium">{aspect.name}</h5>
                        {showDetails && (
                          <p className="text-sm text-muted-foreground">{aspect.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {showControls && (
                        <Select
                          value={aspect.severity}
                          onValueChange={(value: 'error' | 'warning' | 'info') => 
                            handleSetSeverity(aspect.id, value)
                          }
                          disabled={isUpdating}
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="error">
                              <div className="flex items-center gap-2">
                                <XCircle className="h-3 w-3 text-red-500" />
                                Error
                              </div>
                            </SelectItem>
                            <SelectItem value="warning">
                              <div className="flex items-center gap-2">
                                <AlertTriangle className="h-3 w-3 text-yellow-500" />
                                Warning
                              </div>
                            </SelectItem>
                            <SelectItem value="info">
                              <div className="flex items-center gap-2">
                                <Info className="h-3 w-3 text-blue-500" />
                                Info
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      <div className="flex items-center gap-2">
                        {getSeverityIcon(aspect.severity)}
                        <Switch
                          checked={aspect.enabled}
                          onCheckedChange={() => handleToggleAspect(aspect.id)}
                          disabled={isUpdating}
                        />
                      </div>
                    </div>
                  </div>
              </div>
              ))}
            </div>
          </div>
        )}

        {/* Disabled Aspects */}
        {disabledAspects.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-600 mb-3 flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              Disabled Aspects ({disabledAspects.length})
            </h4>
            <div className="space-y-3">
              {disabledAspects.map((aspect) => (
                <div
                  key={aspect.id}
                  className="p-3 rounded-lg border border-gray-200 bg-gray-50"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-lg opacity-50">{ValidationSettingsUtils.getAspectIcon(aspect.id)}</span>
                      <div>
                        <h5 className="font-medium text-gray-600">{aspect.name}</h5>
                        {showDetails && (
                          <p className="text-sm text-gray-500">{aspect.description}</p>
                        )}
                      </div>
                    </div>
            <div className="flex items-center gap-3">
                      {showControls && (
              <Select
                value={aspect.severity}
                          onValueChange={(value: 'error' | 'warning' | 'info') => 
                            handleSetSeverity(aspect.id, value)
                          }
                          disabled={isUpdating}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                            <SelectItem value="error">
                              <div className="flex items-center gap-2">
                                <XCircle className="h-3 w-3 text-red-500" />
                                Error
                              </div>
                            </SelectItem>
                            <SelectItem value="warning">
                              <div className="flex items-center gap-2">
                                <AlertTriangle className="h-3 w-3 text-yellow-500" />
                                Warning
                              </div>
                            </SelectItem>
                            <SelectItem value="info">
                              <div className="flex items-center gap-2">
                                <Info className="h-3 w-3 text-blue-500" />
                                Info
                              </div>
                            </SelectItem>
                </SelectContent>
              </Select>
                      )}
                      <div className="flex items-center gap-2">
                        {getSeverityIcon(aspect.severity)}
              <Switch
                checked={aspect.enabled}
                          onCheckedChange={() => handleToggleAspect(aspect.id)}
                          disabled={isUpdating}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary */}
        {showDetails && (
          <div className="pt-4 border-t border-gray-200">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Total Aspects:</span>
                <span className="ml-2 font-medium">{aspects.length}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Enabled:</span>
                <span className="ml-2 font-medium text-green-600">{enabledAspects.length}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Disabled:</span>
                <span className="ml-2 font-medium text-gray-600">{disabledAspects.length}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Categories:</span>
                <span className="ml-2 font-medium">
                  {Array.from(new Set(aspects.map(a => a.category))).length}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Validation Errors */}
        {validationResult && (validationResult.errors.length > 0 || validationResult.warnings.length > 0) && (
          <div className="pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-muted-foreground">Validation Issues</h4>
              <div className="flex items-center gap-2">
                {validationResult.errors.length > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {validationResult.errors.length} error{validationResult.errors.length !== 1 ? 's' : ''}
                  </Badge>
                )}
                {validationResult.warnings.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {validationResult.warnings.length} warning{validationResult.warnings.length !== 1 ? 's' : ''}
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowValidationErrors(!showValidationErrors)}
                  className="text-xs"
                >
                  {showValidationErrors ? 'Hide' : 'Show'} Details
                </Button>
              </div>
            </div>
            
            {showValidationErrors && (
              <ValidationSettingsErrors
                validationResult={validationResult}
                onRetry={handleRetryValidation}
                onFixAll={handleFixAll}
                compact={true}
                showDetails={false}
              />
            )}
          </div>
        )}

        {/* Settings Changes */}
        {hasChanges && (
          <div className="pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-muted-foreground">Settings Changes</h4>
              <div className="flex items-center gap-2">
                {isDirty && (
                  <Badge variant="secondary" className="text-xs">
                    {pendingChanges.length} pending
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs">
                  {changeCount} total
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSettingsChanges(!showSettingsChanges)}
                  className="text-xs"
                >
                  {showSettingsChanges ? 'Hide' : 'Show'} Details
                </Button>
              </div>
            </div>
            
            {showSettingsChanges && (
              <ValidationSettingsChanges
                changes={changes}
                pendingChanges={pendingChanges}
                hasChanges={hasChanges}
                isDirty={isDirty}
                canUndo={canUndo}
                canRedo={canRedo}
                lastChangeTime={lastChangeTime}
                changeCount={changeCount}
                onUndo={undo}
                onRedo={redo}
                onApply={applyChanges}
                onDiscard={discardChanges}
                onReset={reset}
                compact={true}
                showDetails={false}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ValidationAspectsPanel;