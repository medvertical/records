import { Input } from '@/components/ui/input';

interface StringInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  operator?: string;
}

export function StringInput({ value, onChange, disabled, operator }: StringInputProps) {
  const getPlaceholder = () => {
    switch (operator) {
      case 'contains':
        return 'Enter text to search for...';
      case 'exact':
        return 'Enter exact value...';
      case 'startsWith':
        return 'Starts with...';
      case 'endsWith':
        return 'Ends with...';
      default:
        return 'Enter value...';
    }
  };

  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder={getPlaceholder()}
      className="w-full"
    />
  );
}

