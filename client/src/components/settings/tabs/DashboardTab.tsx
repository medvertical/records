import { DashboardSettingsTab } from '../dashboard-settings-tab';
import { TabHeader } from '../shared';

interface DashboardTabProps {
  onDirtyChange?: (isDirty: boolean) => void;
  hideHeader?: boolean;
  saveCounter?: number;
}

export function DashboardTab({ onDirtyChange, hideHeader = false, saveCounter = 0 }: DashboardTabProps) {
  return (
    <div className={hideHeader ? "" : "space-y-6"}>
      {!hideHeader && (
        <TabHeader 
          title="Dashboard Settings"
          subtitle="Configure dashboard display, auto-refresh, and polling behavior"
        />
      )}
      
      <DashboardSettingsTab onSettingsChange={() => onDirtyChange?.(true)} />
    </div>
  );
}

