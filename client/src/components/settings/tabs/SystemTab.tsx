import { SystemSettingsTab } from '../system-settings-tab';
import { TabHeader } from '../shared';

interface SystemTabProps {
  onDirtyChange?: (isDirty: boolean) => void;
  hideHeader?: boolean;
  saveCounter?: number;
  onSaveComplete?: () => void;
  onSaveError?: (error: string) => void;
  reloadTrigger?: number;  // NEW: Trigger reload when this changes
}

export function SystemTab({ 
  onDirtyChange, 
  hideHeader = false, 
  saveCounter = 0,
  onSaveComplete,
  onSaveError,
  reloadTrigger
}: SystemTabProps) {
  return (
    <div className={hideHeader ? "" : "space-y-6"}>
      {!hideHeader && (
        <TabHeader 
          title="System Settings"
          subtitle="Configure theme, logging, analytics, and system features"
        />
      )}
      
      <SystemSettingsTab 
        onSettingsChange={() => onDirtyChange?.(true)}
        saveCounter={saveCounter}
        onSaveComplete={onSaveComplete}
        onSaveError={onSaveError}
        reloadTrigger={reloadTrigger}
      />
    </div>
  );
}

