import { SystemSettingsTab } from '../system-settings-tab';

interface SystemTabProps {
  onDirtyChange?: (isDirty: boolean) => void;
}

export function SystemTab({ onDirtyChange }: SystemTabProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">System Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure theme, logging, analytics, and system features
        </p>
      </div>
      
      <SystemSettingsTab onSettingsChange={() => onDirtyChange?.(true)} />
    </div>
  );
}

