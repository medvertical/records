import { Input } from '@/components/ui/input';

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function DateInput({ value, onChange, disabled }: DateInputProps) {
  return (
    <Input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder="YYYY-MM-DD"
      className="w-full"
    />
  );
}

