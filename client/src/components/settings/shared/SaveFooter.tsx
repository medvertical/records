import { Button } from '@/components/ui/button';
import { Loader2, RotateCcw } from 'lucide-react';

interface SaveFooterProps {
  onSave: () => void;
  onReset: () => void;
  isSaving: boolean;
  isDirty: boolean;
  saveDisabled?: boolean;
}

export function SaveFooter({ 
  onSave, 
  onReset, 
  isSaving, 
  isDirty,
  saveDisabled = false 
}: SaveFooterProps) {
  return (
    <div className="border-t bg-background px-6 py-3 flex justify-between items-center sticky bottom-0">
      <div className="flex items-center gap-2">
        {isDirty && (
          <span className="text-sm text-muted-foreground">
            Unsaved changes
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <Button 
          variant="outline" 
          onClick={onReset}
          disabled={isSaving}
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset to Defaults
        </Button>
        <Button 
          onClick={onSave}
          disabled={isSaving || saveDisabled || !isDirty}
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            "Save"
          )}
        </Button>
      </div>
    </div>
  );
}

