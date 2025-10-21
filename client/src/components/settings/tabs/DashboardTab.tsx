import { DashboardSettingsTab } from '../dashboard-settings-tab';
import { TabHeader } from '../shared';

interface DashboardTabProps {
  onDirtyChange?: (isDirty: boolean) => void;
}

export function DashboardTab({ onDirtyChange }: DashboardTabProps) {
  return (
    <div className="space-y-6">
      <TabHeader 
        title="Dashboard Settings"
        subtitle="Configure dashboard display, auto-refresh, and polling behavior"
      />
      
      <DashboardSettingsTab onSettingsChange={() => onDirtyChange?.(true)} />
    </div>
  );
}

