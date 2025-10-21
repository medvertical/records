import { Input } from '@/components/ui/input';

interface ReferenceInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function ReferenceInput({ value, onChange, disabled }: ReferenceInputProps) {
  return (
    <div className="w-full">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="e.g., Patient/123"
        className="w-full"
      />
      <p className="text-xs text-muted-foreground mt-1">
        Format: ResourceType/id
      </p>
    </div>
  );
}

