import { Input } from '@/components/ui/input';

interface NumberInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function NumberInput({ value, onChange, disabled }: NumberInputProps) {
  return (
    <Input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder="Enter number..."
      className="w-full"
    />
  );
}

