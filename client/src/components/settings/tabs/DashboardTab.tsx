import { DashboardSettingsTab } from '../dashboard-settings-tab';
import { TabHeader } from '../shared';

interface DashboardTabProps {
  onDirtyChange?: (isDirty: boolean) => void;
  hideHeader?: boolean;
  saveCounter?: number;
  onSaveComplete?: () => void;
  onSaveError?: (error: string) => void;
  reloadTrigger?: number;  // NEW: Trigger reload when this changes
}

export function DashboardTab({ 
  onDirtyChange, 
  hideHeader = false, 
  saveCounter = 0,
  onSaveComplete,
  onSaveError,
  reloadTrigger
}: DashboardTabProps) {
  return (
    <div className={hideHeader ? "" : "space-y-6"}>
      {!hideHeader && (
        <TabHeader 
          title="Dashboard Settings"
          subtitle="Configure dashboard display, auto-refresh, and polling behavior"
        />
      )}
      
      <DashboardSettingsTab 
        onSettingsChange={() => onDirtyChange?.(true)}
        saveCounter={saveCounter}
        onSaveComplete={onSaveComplete}
        onSaveError={onSaveError}
        reloadTrigger={reloadTrigger}
      />
    </div>
  );
}

