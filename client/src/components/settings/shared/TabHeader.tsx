/**
 * TabHeader Component
 * 
 * Consistent header for settings tabs with title and subtitle
 */

interface TabHeaderProps {
  title: string;
  subtitle: string;
}

export function TabHeader({ title, subtitle }: TabHeaderProps) {
  return (
    <div className="pb-4 mb-6 border-b">
      <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
      <p className="text-sm text-muted-foreground mt-1.5">{subtitle}</p>
    </div>
  );
}

