import { useState, useEffect, useMemo } from 'react';
import { ResponsiveLayout, BreakpointConfig } from '@/shared/types/dashboard-new';

/**
 * Responsive Layout Hook - Single responsibility: Manage responsive layout state and breakpoints
 * Follows global rules: Reuse existing patterns, single responsibility, focused on layout management
 */
export function useResponsiveLayout() {
  // Default breakpoint configuration matching wireframe specifications
  const defaultBreakpoints: BreakpointConfig = {
    mobile: 320,
    tablet: 768,
    desktop: 1200,
  };

  const [windowWidth, setWindowWidth] = useState<number>(0);
  const [isHydrated, setIsHydrated] = useState(false);

  // Update window width on resize
  useEffect(() => {
    const updateWidth = () => {
      setWindowWidth(window.innerWidth);
      setIsHydrated(true);
    };

    // Set initial width
    updateWidth();

    // Add resize listener
    window.addEventListener('resize', updateWidth);
    
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Calculate current breakpoint
  const currentBreakpoint = useMemo(() => {
    if (!isHydrated) return 'desktop'; // Default during SSR
    
    if (windowWidth < defaultBreakpoints.tablet) {
      return 'mobile' as const;
    } else if (windowWidth < defaultBreakpoints.desktop) {
      return 'tablet' as const;
    } else {
      return 'desktop' as const;
    }
  }, [windowWidth, isHydrated]);

  // Calculate boolean flags for each breakpoint
  const isMobile = currentBreakpoint === 'mobile';
  const isTablet = currentBreakpoint === 'tablet';
  const isDesktop = currentBreakpoint === 'desktop';

  // Calculate optimal number of columns for grid
  const columns = useMemo(() => {
    if (!isHydrated) return 4; // Default during SSR
    
    switch (currentBreakpoint) {
      case 'mobile':
        return 1;
      case 'tablet':
        return 2;
      case 'desktop':
        return 4;
      default:
        return 4;
    }
  }, [currentBreakpoint, isHydrated]);

  // Create responsive layout object
  const layout: ResponsiveLayout = useMemo(() => ({
    currentBreakpoint,
    isMobile,
    isTablet,
    isDesktop,
    columns,
  }), [currentBreakpoint, isMobile, isTablet, isDesktop, columns]);

  return {
    ...layout,
    windowWidth,
    isHydrated,
    breakpoints: defaultBreakpoints,
  };
}

/**
 * Custom breakpoint hook for specific breakpoint queries
 */
export function useBreakpoint(breakpoint: keyof BreakpointConfig) {
  const { windowWidth, isHydrated } = useResponsiveLayout();
  const breakpoints: BreakpointConfig = {
    mobile: 320,
    tablet: 768,
    desktop: 1200,
  };

  return useMemo(() => {
    if (!isHydrated) return false;
    
    const breakpointValue = breakpoints[breakpoint];
    
    switch (breakpoint) {
      case 'mobile':
        return windowWidth < breakpoints.tablet;
      case 'tablet':
        return windowWidth >= breakpoints.tablet && windowWidth < breakpoints.desktop;
      case 'desktop':
        return windowWidth >= breakpoints.desktop;
      default:
        return false;
    }
  }, [windowWidth, isHydrated, breakpoint]);
}

/**
 * Media query hook for custom breakpoints
 */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState<boolean>(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(query);
    
    const updateMatches = () => {
      setMatches(mediaQuery.matches);
      setIsHydrated(true);
    };

    // Set initial value
    updateMatches();

    // Add listener
    mediaQuery.addEventListener('change', updateMatches);
    
    return () => mediaQuery.removeEventListener('change', updateMatches);
  }, [query]);

  return { matches, isHydrated };
}

/**
 * Responsive value hook - returns different values based on breakpoint
 */
export function useResponsiveValue<T>(values: {
  mobile?: T;
  tablet?: T;
  desktop?: T;
  default: T;
}) {
  const { currentBreakpoint, isHydrated } = useResponsiveLayout();

  return useMemo(() => {
    if (!isHydrated) return values.default;

    switch (currentBreakpoint) {
      case 'mobile':
        return values.mobile ?? values.default;
      case 'tablet':
        return values.tablet ?? values.default;
      case 'desktop':
        return values.desktop ?? values.default;
      default:
        return values.default;
    }
  }, [currentBreakpoint, isHydrated, values]);
}

/**
 * Grid configuration hook - returns optimal grid settings for current breakpoint
 */
export function useGridConfig() {
  const { currentBreakpoint, isHydrated } = useResponsiveLayout();

  return useMemo(() => {
    if (!isHydrated) {
      return { columns: 4, gap: 6, padding: 6 };
    }

    switch (currentBreakpoint) {
      case 'mobile':
        return { columns: 1, gap: 4, padding: 4 };
      case 'tablet':
        return { columns: 2, gap: 4, padding: 4 };
      case 'desktop':
        return { columns: 4, gap: 6, padding: 6 };
      default:
        return { columns: 4, gap: 6, padding: 6 };
    }
  }, [currentBreakpoint, isHydrated]);
}

/**
 * Layout utilities for responsive design
 */
export const ResponsiveUtils = {
  /**
   * Get Tailwind classes for responsive grid
   */
  getGridClasses: (breakpoint: 'mobile' | 'tablet' | 'desktop') => {
    const classes = {
      mobile: 'grid-cols-1 gap-4 p-4',
      tablet: 'grid-cols-2 gap-4 p-4',
      desktop: 'grid-cols-4 gap-6 p-6',
    };
    return classes[breakpoint];
  },

  /**
   * Get responsive spacing values
   */
  getSpacing: (breakpoint: 'mobile' | 'tablet' | 'desktop') => {
    const spacing = {
      mobile: { padding: 4, gap: 4, margin: 4 },
      tablet: { padding: 4, gap: 4, margin: 4 },
      desktop: { padding: 6, gap: 6, margin: 6 },
    };
    return spacing[breakpoint];
  },

  /**
   * Calculate optimal item width for grid
   */
  calculateItemWidth: (containerWidth: number, columns: number, gap: number) => {
    return Math.floor((containerWidth - (gap * (columns - 1))) / columns);
  },
};

export default useResponsiveLayout;
