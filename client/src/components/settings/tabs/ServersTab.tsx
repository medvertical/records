import { ServerManagementTab } from '../server-management-tab';

interface ServersTabProps {
  onDirtyChange?: (isDirty: boolean) => void;
}

export function ServersTab({ onDirtyChange }: ServersTabProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Server Management</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage FHIR servers and terminology server connections
        </p>
      </div>
      
      <ServerManagementTab onServersChange={() => onDirtyChange?.(true)} />
    </div>
  );
}

