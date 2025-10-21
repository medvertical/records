import { BusinessRulesTab } from '../business-rules-tab';
import { TabHeader } from '../shared';

interface RulesTabProps {
  onDirtyChange?: (isDirty: boolean) => void;
  hideHeader?: boolean;
  saveCounter?: number;
}

export function RulesTab({ onDirtyChange, hideHeader = false, saveCounter = 0 }: RulesTabProps) {
  return (
    <div className={hideHeader ? "" : "space-y-6"}>
      {!hideHeader && (
        <TabHeader 
          title="Business Rules"
          subtitle="Manage custom validation rules and FHIRPath expressions"
        />
      )}
      
      <BusinessRulesTab />
    </div>
  );
}

