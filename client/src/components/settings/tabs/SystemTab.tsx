import { SystemSettingsTab } from '../system-settings-tab';
import { TabHeader } from '../shared';

interface SystemTabProps {
  onDirtyChange?: (isDirty: boolean) => void;
}

export function SystemTab({ onDirtyChange }: SystemTabProps) {
  return (
    <div className="space-y-6">
      <TabHeader 
        title="System Settings"
        subtitle="Configure theme, logging, analytics, and system features"
      />
      
      <SystemSettingsTab onSettingsChange={() => onDirtyChange?.(true)} />
    </div>
  );
}

