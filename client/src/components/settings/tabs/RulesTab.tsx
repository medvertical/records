import { BusinessRulesTab } from '../business-rules-tab';
import { TabHeader } from '../shared';

interface RulesTabProps {
  onDirtyChange?: (isDirty: boolean) => void;
}

export function RulesTab({ onDirtyChange }: RulesTabProps) {
  return (
    <div className="space-y-6">
      <TabHeader 
        title="Business Rules"
        subtitle="Manage custom validation rules and FHIRPath expressions"
      />
      
      <BusinessRulesTab />
    </div>
  );
}

