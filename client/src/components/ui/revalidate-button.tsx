import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

export interface RevalidateButtonProps {
  onClick: () => void;
  isRevalidating?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'outline' | 'default' | 'ghost' | 'secondary';
  className?: string;
}

export function RevalidateButton({
  onClick,
  isRevalidating = false,
  disabled = false,
  size = 'sm',
  variant = 'outline',
  className,
}: RevalidateButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      onClick={onClick}
      disabled={disabled || isRevalidating}
      className={className}
    >
      <RefreshCw className={`h-4 w-4 mr-2 ${isRevalidating ? 'animate-spin' : ''}`} />
      {isRevalidating ? 'Revalidating...' : 'Revalidate'}
    </Button>
  );
}

