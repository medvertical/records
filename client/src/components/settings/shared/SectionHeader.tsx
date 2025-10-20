import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

interface SectionHeaderProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function SectionHeader({ 
  icon: Icon, 
  title, 
  description,
  actions 
}: SectionHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-5 w-5 text-muted-foreground" />}
          <h4 className="text-base font-medium">{title}</h4>
        </div>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && (
        <div>{actions}</div>
      )}
    </div>
  );
}

