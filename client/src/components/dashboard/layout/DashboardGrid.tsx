import React from 'react';
import { cn } from '@/lib/utils';
import { DashboardGridProps, GridItemProps, ResponsiveLayout } from '@/shared/types/dashboard-new';

/**
 * DashboardGrid Component - Single responsibility: Provide responsive grid layout for dashboard widgets
 * Follows global rules: Under 300 lines, uses existing Tailwind patterns, single responsibility
 */
export const DashboardGrid: React.FC<DashboardGridProps> = ({
  children,
  columns = 4,
  gap = 6,
  className,
}) => {
  const gridClasses = cn(
    'dashboard-grid',
    {
      'dashboard-grid-mobile': columns === 1,
      'dashboard-grid-tablet': columns === 2,
      'dashboard-grid-desktop': columns === 4,
    },
    className
  );

  const gridStyle = {
    gridTemplateColumns: `repeat(${columns}, 1fr)`,
    gap: `${gap * 0.25}rem`, // Convert gap to rem (Tailwind spacing scale)
  };

  return (
    <div 
      className={gridClasses}
      style={gridStyle}
      data-testid="dashboard-grid"
    >
      {children}
    </div>
  );
};

/**
 * GridItem Component - For individual grid items with span control
 */
export const GridItem: React.FC<GridItemProps> = ({
  children,
  span = 1,
  className,
}) => {
  const itemClasses = cn(
    'dashboard-widget',
    className
  );

  const itemStyle = {
    gridColumn: `span ${span}`,
  };

  return (
    <div 
      className={itemClasses}
      style={itemStyle}
      data-testid="grid-item"
    >
      {children}
    </div>
  );
};

/**
 * Responsive Dashboard Grid - Automatically adjusts based on screen size
 */
interface ResponsiveDashboardGridProps {
  children: React.ReactNode;
  className?: string;
  mobileColumns?: number;
  tabletColumns?: number;
  desktopColumns?: number;
  gap?: number;
}

export const ResponsiveDashboardGrid: React.FC<ResponsiveDashboardGridProps> = ({
  children,
  className,
  mobileColumns = 1,
  tabletColumns = 2,
  desktopColumns = 4,
  gap = 6,
}) => {
  const gridClasses = cn(
    'grid gap-4',
    'grid-cols-1', // Mobile default
    'md:grid-cols-2', // Tablet
    'xl:grid-cols-4', // Desktop
    className
  );

  const gridStyle = {
    gap: `${gap * 0.25}rem`,
  };

  return (
    <div 
      className={gridClasses}
      style={gridStyle}
      data-testid="responsive-dashboard-grid"
    >
      {children}
    </div>
  );
};

/**
 * Widget Container - Wrapper for individual widgets with consistent styling
 */
interface WidgetContainerProps {
  children: React.ReactNode;
  className?: string;
  span?: number;
  priority?: 'high' | 'medium' | 'low';
}

export const WidgetContainer: React.FC<WidgetContainerProps> = ({
  children,
  className,
  span = 1,
  priority = 'medium',
}) => {
  const containerClasses = cn(
    'dashboard-widget',
    'transition-all duration-200',
    {
      'order-first': priority === 'high',
      'order-last': priority === 'low',
    },
    className
  );

  const containerStyle = {
    gridColumn: `span ${span}`,
  };

  return (
    <div 
      className={containerClasses}
      style={containerStyle}
      data-testid="widget-container"
      data-priority={priority}
    >
      {children}
    </div>
  );
};

/**
 * Layout Presets - Common dashboard layouts
 */
export const DashboardLayouts = {
  /**
   * Standard 4-column desktop layout
   */
  Standard: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <ResponsiveDashboardGrid 
      className={cn('max-w-7xl mx-auto p-6', className)}
      desktopColumns={4}
      tabletColumns={2}
      mobileColumns={1}
    >
      {children}
    </ResponsiveDashboardGrid>
  ),

  /**
   * Compact 2-column layout for smaller screens
   */
  Compact: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <ResponsiveDashboardGrid 
      className={cn('max-w-5xl mx-auto p-4', className)}
      desktopColumns={2}
      tabletColumns={2}
      mobileColumns={1}
    >
      {children}
    </ResponsiveDashboardGrid>
  ),

  /**
   * Full-width layout for large displays
   */
  FullWidth: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <ResponsiveDashboardGrid 
      className={cn('w-full p-6', className)}
      desktopColumns={6}
      tabletColumns={3}
      mobileColumns={1}
    >
      {children}
    </ResponsiveDashboardGrid>
  ),

  /**
   * Single column layout for mobile-first approach
   */
  Mobile: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <ResponsiveDashboardGrid 
      className={cn('w-full p-4', className)}
      desktopColumns={1}
      tabletColumns={1}
      mobileColumns={1}
    >
      {children}
    </ResponsiveDashboardGrid>
  ),
};

/**
 * Grid Utilities - Helper functions for grid calculations
 */
export const GridUtils = {
  /**
   * Calculate optimal columns based on container width
   */
  calculateColumns: (containerWidth: number, minItemWidth: number = 300): number => {
    return Math.max(1, Math.floor(containerWidth / minItemWidth));
  },

  /**
   * Calculate responsive breakpoints
   */
  getBreakpoint: (width: number): 'mobile' | 'tablet' | 'desktop' => {
    if (width < 768) return 'mobile';
    if (width < 1200) return 'tablet';
    return 'desktop';
  },

  /**
   * Get grid configuration for breakpoint
   */
  getGridConfig: (breakpoint: 'mobile' | 'tablet' | 'desktop') => {
    const configs = {
      mobile: { columns: 1, gap: 4, padding: 4 },
      tablet: { columns: 2, gap: 4, padding: 4 },
      desktop: { columns: 4, gap: 6, padding: 6 },
    };
    return configs[breakpoint];
  },
};

export default DashboardGrid;
