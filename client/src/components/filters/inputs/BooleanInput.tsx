import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useEffect, useRef } from 'react';

interface BooleanInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function BooleanInput({ value, onChange, disabled }: BooleanInputProps) {
  const isTrue = value === 'true';
  const initializedRef = useRef(false);
  
  // If value is empty or invalid on first render, default to 'false'
  useEffect(() => {
    if (!initializedRef.current && value !== 'true' && value !== 'false') {
      initializedRef.current = true;
      onChange('false');
    }
  }, []);
  
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

