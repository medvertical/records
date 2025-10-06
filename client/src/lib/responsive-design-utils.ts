import { cn } from './utils';

/**
 * Responsive design utility functions for validation control panel components
 */

export const responsiveClasses = {
  // Container classes
  container: 'w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8',
  cardContainer: 'w-full space-y-4 sm:space-y-6',
  
  // Grid classes
  grid: {
    // 1 column on mobile, 2 on tablet, 3 on desktop
    responsive: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6',
    // 1 column on mobile, 2 on desktop
    twoColumn: 'grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6',
    // 2 columns on mobile, 3 on tablet, 4 on desktop
    fourColumn: 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4',
  },
  
  // Flex classes
  flex: {
    // Stack on mobile, row on desktop
    responsive: 'flex flex-col sm:flex-row gap-2 sm:gap-4',
    // Wrap on mobile, no wrap on desktop
    wrap: 'flex flex-wrap sm:flex-nowrap gap-2 sm:gap-4',
    // Center on mobile, space between on desktop
    center: 'flex flex-col sm:flex-row items-center sm:justify-between gap-2 sm:gap-4',
  },
  
  // Button classes
  button: {
    // Full width on mobile, auto on desktop
    responsive: 'w-full sm:w-auto',
    // Stack on mobile, inline on desktop
    group: 'flex flex-col sm:flex-row gap-2 sm:gap-3',
  },
  
  // Text classes
  text: {
    // Smaller on mobile, larger on desktop
    responsive: 'text-sm sm:text-base',
    // Hide on mobile, show on desktop
    hideMobile: 'hidden sm:block',
    // Show on mobile, hide on desktop
    showMobile: 'block sm:hidden',
  },
  
  // Spacing classes
  spacing: {
    // Smaller padding on mobile, larger on desktop
    responsive: 'p-3 sm:p-4 lg:p-6',
    // Smaller margin on mobile, larger on desktop
    margin: 'm-2 sm:m-4 lg:m-6',
  },
};

/**
 * Get responsive classes for different screen sizes
 */
export function getResponsiveClasses(component: keyof typeof responsiveClasses, variant?: string) {
  if (variant && responsiveClasses[component][variant]) {
    return responsiveClasses[component][variant];
  }
  return responsiveClasses[component];
}

/**
 * Responsive breakpoint utilities
 */
export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
};

/**
 * Get responsive class names for a component
 */
export function getResponsiveClassNames(baseClasses: string, responsiveClasses: string) {
  return cn(baseClasses, responsiveClasses);
}

/**
 * Responsive component variants
 */
export type ResponsiveVariant = 'mobile' | 'tablet' | 'desktop' | 'auto';

/**
 * Get responsive variant based on screen size
 */
export function getResponsiveVariant(variant: ResponsiveVariant): string {
  switch (variant) {
    case 'mobile':
      return 'sm:hidden';
    case 'tablet':
      return 'hidden sm:block lg:hidden';
    case 'desktop':
      return 'hidden lg:block';
    case 'auto':
    default:
      return '';
  }
}

