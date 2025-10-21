import { Input } from '@/components/ui/input';

interface TokenInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  paramName?: string;
}

export function TokenInput({ value, onChange, disabled, paramName }: TokenInputProps) {
  // Provide helpful examples based on common token parameters
  const getPlaceholder = () => {
    switch (paramName) {
      case 'gender':
        return 'e.g., male, female, other, unknown';
      case 'status':
        return 'e.g., active, inactive, completed';
      case 'active':
        return 'true or false';
      default:
        return 'Enter value (or system|value)';
    }
  };

  return (
    <div className="w-full">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={getPlaceholder()}
        className="w-full"
      />
      <p className="text-xs text-muted-foreground mt-1">
        Format: value or system|value
      </p>
    </div>
  );
}

