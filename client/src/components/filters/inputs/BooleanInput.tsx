import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface BooleanInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function BooleanInput({ value, onChange, disabled }: BooleanInputProps) {
  const isTrue = value === 'true';
  
  return (
    <div className="flex items-center justify-between space-x-2">
      <Label htmlFor="boolean-switch" className="text-sm">
        {isTrue ? 'true' : 'false'}
      </Label>
      <Switch
        id="boolean-switch"
        checked={isTrue}
        onCheckedChange={(checked) => onChange(checked ? 'true' : 'false')}
        disabled={disabled}
      />
    </div>
  );
}

