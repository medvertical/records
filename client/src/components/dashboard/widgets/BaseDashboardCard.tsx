import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { 
  BaseDashboardCardProps, 
  LoadingCardProps, 
  ErrorCardProps 
} from '@/types/dashboard';

/**
 * Base Dashboard Card - Standardized card component for dashboard widgets
 * Provides consistent structure and styling for all dashboard cards
 */
export const BaseDashboardCard: React.FC<BaseDashboardCardProps> = ({
  title,
  icon: Icon,
  className,
  children,
}) => {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
    </Card>
  );
};

/**
 * Loading Card - Standardized loading state for dashboard cards
 */
export const LoadingCard: React.FC<LoadingCardProps> = ({
  title,
  icon: Icon,
  className,
}) => {
  return (
    <BaseDashboardCard title={title} icon={Icon} className={className}>
      <div className="text-2xl font-bold">Loading...</div>
    </BaseDashboardCard>
  );
};

/**
 * Error Card - Standardized error state for dashboard cards
 */
export const ErrorCard: React.FC<ErrorCardProps> = ({
  title,
  icon: Icon,
  error,
  className,
}) => {
  return (
    <BaseDashboardCard title={title} icon={Icon} className={className}>
      <div className="text-sm text-destructive">{error}</div>
    </BaseDashboardCard>
  );
};
