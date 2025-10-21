import { SystemSettingsTab } from '../system-settings-tab';
import { TabHeader } from '../shared';

interface SystemTabProps {
  onDirtyChange?: (isDirty: boolean) => void;
  hideHeader?: boolean;
  saveCounter?: number;
}

export function SystemTab({ onDirtyChange, hideHeader = false, saveCounter = 0 }: SystemTabProps) {
  return (
    <div className={hideHeader ? "" : "space-y-6"}>
      {!hideHeader && (
        <TabHeader 
          title="System Settings"
          subtitle="Configure theme, logging, analytics, and system features"
        />
      )}
      
      <SystemSettingsTab onSettingsChange={() => onDirtyChange?.(true)} />
    </div>
  );
}

