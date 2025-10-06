import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  AlertTriangle, 
  XCircle, 
  Info, 
  CheckCircle, 
  RefreshCw,
  Undo,
  Redo,
  Save,
  X,
  Clock,
  Zap,
  Settings,
  Activity
} from 'lucide-react';
import { 
  SettingsChange,
  ValidationSettingsChangeDetectorUtils 
} from '@/lib/validation-settings-change-detector';
import { cn } from '@/lib/utils';

interface ValidationSettingsChangesProps {
  changes: SettingsChange[];
  pendingChanges: SettingsChange[];
  hasChanges: boolean;
  isDirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  lastChangeTime: Date | null;
  changeCount: number;
  onUndo: () => void;
  onRedo: () => void;
  onApply: () => void;
  onDiscard: () => void;
  onReset: () => void;
  className?: string;
  showDetails?: boolean;
  compact?: boolean;
}

export const ValidationSettingsChanges: React.FC<ValidationSettingsChangesProps> = ({
  changes,
  pendingChanges,
  hasChanges,
  isDirty,
  canUndo,
  canRedo,
  lastChangeTime,
  changeCount,
  onUndo,
  onRedo,
  onApply,
  onDiscard,
  onReset,
  className,
  showDetails = true,
  compact = false,
}) => {
  const [showAllChanges, setShowAllChanges] = useState(false);
  const [groupedChanges, setGroupedChanges] = useState<Record<string, SettingsChange[]>>({});

  // Group changes by field when component mounts or changes update
  React.useEffect(() => {
    const grouped = ValidationSettingsChangeDetectorUtils.groupChangesByField(changes);
    setGroupedChanges(grouped);
  }, [changes]);

  const getChangeIcon = (change: SettingsChange) => {
    const severityIcon = ValidationSettingsChangeDetectorUtils.getChangeSeverityIcon(change.severity);
    const typeIcon = ValidationSettingsChangeDetectorUtils.getChangeTypeIcon(change.changeType);
    return `${severityIcon} ${typeIcon}`;
  };

  const getChangeColor = (change: SettingsChange) => {
    return ValidationSettingsChangeDetectorUtils.getChangeSeverityColor(change.severity);
  };

  const getAffectedAreaIcon = (area: string) => {
    switch (area) {
      case 'Validation': return <CheckCircle className="h-3 w-3" />;
      case 'Performance': return <Zap className="h-3 w-3" />;
      case 'Server Configuration': return <Settings className="h-3 w-3" />;
      default: return <Activity className="h-3 w-3" />;
    }
  };

  const getChangeStatistics = () => {
    return ValidationSettingsChangeDetectorUtils.getChangeStatistics(changes);
  };

  if (!hasChanges && !isDirty) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center text-green-600">
            <CheckCircle className="h-6 w-6 mr-2" />
            <span>No changes detected</span>
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
            <span>Settings Changes</span>
            <div className="flex items-center gap-2">
              {isDirty && (
                <Badge variant="secondary" className="text-xs">
                  {changeCount} pending
                </Badge>
              )}
              {hasChanges && (
                <Badge variant="outline" className="text-xs">
                  {changeCount} total
                </Badge>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onUndo}
              disabled={!canUndo}
              className="text-xs"
            >
              <Undo className="h-3 w-3 mr-1" />
              Undo
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRedo}
              disabled={!canRedo}
              className="text-xs"
            >
              <Redo className="h-3 w-3 mr-1" />
              Redo
            </Button>
            {isDirty && (
              <>
                <Button
                  variant="default"
                  size="sm"
                  onClick={onApply}
                  className="text-xs"
                >
                  <Save className="h-3 w-3 mr-1" />
                  Apply
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onDiscard}
                  className="text-xs"
                >
                  <X className="h-3 w-3 mr-1" />
                  Discard
                </Button>
              </>
            )}
          </div>

          {/* Recent changes */}
          {changes.slice(0, 3).map((change, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <span>{getChangeIcon(change)}</span>
              <span className="flex-1">{ValidationSettingsChangeDetectorUtils.formatChangeDescription(change)}</span>
            </div>
          ))}
          
          {changes.length > 3 && (
            <div className="text-xs text-muted-foreground">
              +{changes.length - 3} more changes
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            {isDirty ? (
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            ) : (
              <CheckCircle className="h-5 w-5 text-green-500" />
            )}
            Settings Changes
          </span>
          <div className="flex items-center gap-2">
            {isDirty && (
              <Badge variant="secondary" className="text-sm">
                {pendingChanges.length} pending
              </Badge>
            )}
            {hasChanges && (
              <Badge variant="outline" className="text-sm">
                {changeCount} total
              </Badge>
            )}
            {lastChangeTime && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {lastChangeTime.toLocaleTimeString()}
              </div>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            onClick={onUndo}
            disabled={!canUndo}
            className="text-xs"
          >
            <Undo className="h-3 w-3 mr-1" />
            Undo
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRedo}
            disabled={!canRedo}
            className="text-xs"
          >
            <Redo className="h-3 w-3 mr-1" />
            Redo
          </Button>
          {isDirty && (
            <>
              <Button
                variant="default"
                size="sm"
                onClick={onApply}
                className="text-xs"
              >
                <Save className="h-3 w-3 mr-1" />
                Apply Changes
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onDiscard}
                className="text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Discard Changes
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="text-xs"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Reset All
          </Button>
        </div>

        {/* Change statistics */}
        {showDetails && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            {(() => {
              const stats = getChangeStatistics();
              return (
                <>
                  <div>
                    <span className="text-muted-foreground">Total Changes:</span>
                    <span className="ml-2 font-medium">{stats.total}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Critical:</span>
                    <span className="ml-2 font-medium text-red-600">{stats.critical}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">High:</span>
                    <span className="ml-2 font-medium text-orange-600">{stats.high}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Medium:</span>
                    <span className="ml-2 font-medium text-yellow-600">{stats.medium}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Low:</span>
                    <span className="ml-2 font-medium text-blue-600">{stats.low}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Affects Validation:</span>
                    <span className="ml-2 font-medium">{stats.affectsValidation}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Affects Performance:</span>
                    <span className="ml-2 font-medium">{stats.affectsPerformance}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Requires Restart:</span>
                    <span className="ml-2 font-medium text-red-600">{stats.requiresRestart}</span>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* Grouped changes */}
        {showDetails && Object.keys(groupedChanges).length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-muted-foreground">Changes by Category</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllChanges(!showAllChanges)}
                className="text-xs"
              >
                {showAllChanges ? 'Show Summary' : 'Show All'}
              </Button>
            </div>
            
            <div className="space-y-3">
              {Object.entries(groupedChanges).map(([field, fieldChanges]) => (
                <div key={field} className="space-y-2">
                  <h5 className="text-sm font-medium capitalize">{field} Settings</h5>
                  <div className="space-y-2">
                    {(showAllChanges ? fieldChanges : fieldChanges.slice(0, 2)).map((change, index) => (
                      <div
                        key={index}
                        className={cn(
                          'p-2 rounded border text-sm',
                          getChangeColor(change)
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span>{getChangeIcon(change)}</span>
                          <span className="font-medium">{change.field}</span>
                          <Badge variant="outline" className="text-xs">
                            {change.severity}
                          </Badge>
                        </div>
                        <p className="text-xs">{ValidationSettingsChangeDetectorUtils.formatChangeDescription(change)}</p>
                        {change.requiresRestart && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-red-600">
                            <AlertTriangle className="h-3 w-3" />
                            Requires restart
                          </div>
                        )}
                      </div>
                    ))}
                    {!showAllChanges && fieldChanges.length > 2 && (
                      <div className="text-xs text-muted-foreground">
                        +{fieldChanges.length - 2} more changes in {field}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pending changes warning */}
        {isDirty && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2 text-yellow-800">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">Pending Changes</span>
            </div>
            <p className="text-sm text-yellow-700 mt-1">
              You have {pendingChanges.length} pending changes that need to be applied or discarded.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ValidationSettingsChanges;

