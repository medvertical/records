import { BusinessRulesTab } from '../business-rules-tab';

interface RulesTabProps {
  onDirtyChange?: (isDirty: boolean) => void;
}

export function RulesTab({ onDirtyChange }: RulesTabProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Business Rules</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage custom validation rules and FHIRPath expressions
        </p>
      </div>
      
      <BusinessRulesTab />
    </div>
  );
}

