import { useEffect, useState } from 'react';
import { BusinessRulesTab } from '../business-rules-tab';
import { TabHeader } from '../shared';

interface RulesTabProps {
  onDirtyChange?: (isDirty: boolean) => void;
  hideHeader?: boolean;
  saveCounter?: number;
  onSaveComplete?: () => void;
  onSaveError?: (error: string) => void;
}

export function RulesTab({ onDirtyChange, hideHeader = false, saveCounter = 0, onSaveComplete, onSaveError }: RulesTabProps) {
  // Rules use immediate CRUD operations - acknowledge save immediately (only once per saveCounter change)
  const [previousSaveCounter, setPreviousSaveCounter] = useState(0);
  
  useEffect(() => {
    if (saveCounter && saveCounter > 0 && saveCounter !== previousSaveCounter) {
      console.log('[RulesTab] Save acknowledged (rules use immediate CRUD)');
      setPreviousSaveCounter(saveCounter);
      // Rules save immediately via CRUD operations, so just acknowledge
      onSaveComplete?.();
    }
  }, [saveCounter, previousSaveCounter, onSaveComplete]);

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

