import { DashboardSettingsTab } from '../dashboard-settings-tab';

interface DashboardTabProps {
  onDirtyChange?: (isDirty: boolean) => void;
}

export function DashboardTab({ onDirtyChange }: DashboardTabProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Dashboard Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure dashboard display, auto-refresh, and polling behavior
        </p>
      </div>
      
      <DashboardSettingsTab onSettingsChange={() => onDirtyChange?.(true)} />
    </div>
  );
}

