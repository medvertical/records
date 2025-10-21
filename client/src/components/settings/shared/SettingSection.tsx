import { ReactNode } from 'react';

interface SettingSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function SettingSection({ 
  title, 
  description, 
  children,
  className = ''
}: SettingSectionProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      <div className="space-y-0.5">
        <h3 className="text-base font-semibold">{title}</h3>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="space-y-3">
        {children}
      </div>
    </div>
  );
}

