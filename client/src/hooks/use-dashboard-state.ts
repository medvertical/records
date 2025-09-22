import { useState, useEffect, useCallback, useMemo } from 'react';
import { DashboardLayout, ResponsiveLayout } from '@/shared/types/dashboard-new';
import { useResponsiveLayout } from './use-responsive-layout';

/**
 * Dashboard State Management Hook - Single responsibility: Manage dashboard layout preferences and state
 * Follows global rules: Focused on layout only, single responsibility, uses existing patterns
 */

// Default layout configuration
const DEFAULT_LAYOUT: DashboardLayout = {
  sidebarCollapsed: false,
  widgetOrder: [
    'alerts',
    'overview', 
    'status',
    'trends',
    'validation-control',
    'resource-breakdown',
    'validation-aspects',
  ],
  customLayout: false,
  breakpoint: 'desktop',
};

// Local storage keys
const STORAGE_KEYS = {
  LAYOUT: 'dashboard-layout',
  PREFERENCES: 'dashboard-preferences',
} as const;

export function useDashboardState() {
  const { currentBreakpoint, isHydrated } = useResponsiveLayout();
  const [layout, setLayout] = useState<DashboardLayout>(DEFAULT_LAYOUT);
  const [isLoading, setIsLoading] = useState(true);

  // Load layout preferences from localStorage on mount
  useEffect(() => {
    if (!isHydrated) return;

    try {
      const savedLayout = localStorage.getItem(STORAGE_KEYS.LAYOUT);
      if (savedLayout) {
        const parsedLayout = JSON.parse(savedLayout);
        setLayout({
          ...DEFAULT_LAYOUT,
          ...parsedLayout,
          breakpoint: currentBreakpoint, // Always use current breakpoint
        });
      } else {
        setLayout({
          ...DEFAULT_LAYOUT,
          breakpoint: currentBreakpoint,
        });
      }
    } catch (error) {
      console.warn('Failed to load dashboard layout preferences:', error);
      setLayout({
        ...DEFAULT_LAYOUT,
        breakpoint: currentBreakpoint,
      });
    } finally {
      setIsLoading(false);
    }
  }, [isHydrated, currentBreakpoint]);

  // Save layout preferences to localStorage
  const saveLayout = useCallback((newLayout: DashboardLayout) => {
    try {
      localStorage.setItem(STORAGE_KEYS.LAYOUT, JSON.stringify(newLayout));
    } catch (error) {
      console.warn('Failed to save dashboard layout preferences:', error);
    }
  }, []);

  // Toggle sidebar collapsed state
  const toggleSidebar = useCallback(() => {
    const newLayout = {
      ...layout,
      sidebarCollapsed: !layout.sidebarCollapsed,
    };
    setLayout(newLayout);
    saveLayout(newLayout);
  }, [layout, saveLayout]);

  // Set sidebar collapsed state
  const setSidebarCollapsed = useCallback((collapsed: boolean) => {
    const newLayout = {
      ...layout,
      sidebarCollapsed: collapsed,
    };
    setLayout(newLayout);
    saveLayout(newLayout);
  }, [layout, saveLayout]);

  // Update widget order
  const setWidgetOrder = useCallback((widgetOrder: string[]) => {
    const newLayout = {
      ...layout,
      widgetOrder,
      customLayout: true,
    };
    setLayout(newLayout);
    saveLayout(newLayout);
  }, [layout, saveLayout]);

  // Reset to default layout
  const resetLayout = useCallback(() => {
    const defaultLayout = {
      ...DEFAULT_LAYOUT,
      breakpoint: currentBreakpoint,
    };
    setLayout(defaultLayout);
    saveLayout(defaultLayout);
  }, [currentBreakpoint, saveLayout]);

  // Get widget order for current breakpoint
  const getWidgetOrder = useCallback(() => {
    return layout.widgetOrder;
  }, [layout.widgetOrder]);

  // Check if layout is custom
  const isCustomLayout = useMemo(() => {
    return layout.customLayout;
  }, [layout.customLayout]);

  // Get responsive layout configuration
  const getResponsiveConfig = useMemo(() => {
    return {
      sidebarCollapsed: layout.sidebarCollapsed,
      breakpoint: currentBreakpoint,
      isMobile: currentBreakpoint === 'mobile',
      isTablet: currentBreakpoint === 'tablet',
      isDesktop: currentBreakpoint === 'desktop',
    };
  }, [layout.sidebarCollapsed, currentBreakpoint]);

  return {
    // Layout state
    layout,
    isLoading,
    
    // Layout actions
    toggleSidebar,
    setSidebarCollapsed,
    setWidgetOrder,
    resetLayout,
    
    // Layout queries
    getWidgetOrder,
    isCustomLayout,
    
    // Responsive configuration
    getResponsiveConfig,
    
    // Current state
    sidebarCollapsed: layout.sidebarCollapsed,
    widgetOrder: layout.widgetOrder,
    customLayout: layout.customLayout,
  };
}

/**
 * Sidebar state hook - Focused specifically on sidebar state management
 */
export function useSidebarState() {
  const { sidebarCollapsed, toggleSidebar, setSidebarCollapsed } = useDashboardState();
  
  return {
    collapsed: sidebarCollapsed,
    toggle: toggleSidebar,
    setCollapsed: setSidebarCollapsed,
  };
}

/**
 * Widget order hook - Focused specifically on widget ordering
 */
export function useWidgetOrder() {
  const { widgetOrder, setWidgetOrder, isCustomLayout, resetLayout } = useDashboardState();
  
  return {
    order: widgetOrder,
    setOrder: setWidgetOrder,
    isCustom: isCustomLayout,
    reset: resetLayout,
  };
}

/**
 * Layout preferences hook - For storing additional layout preferences
 */
export function useLayoutPreferences() {
  const [preferences, setPreferences] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Load preferences from localStorage
  useEffect(() => {
    try {
      const savedPreferences = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
      if (savedPreferences) {
        setPreferences(JSON.parse(savedPreferences));
      }
    } catch (error) {
      console.warn('Failed to load layout preferences:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save preferences to localStorage
  const savePreferences = useCallback((newPreferences: Record<string, any>) => {
    try {
      localStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(newPreferences));
      setPreferences(newPreferences);
    } catch (error) {
      console.warn('Failed to save layout preferences:', error);
    }
  }, []);

  // Update specific preference
  const updatePreference = useCallback((key: string, value: any) => {
    const newPreferences = {
      ...preferences,
      [key]: value,
    };
    savePreferences(newPreferences);
  }, [preferences, savePreferences]);

  // Get specific preference
  const getPreference = useCallback((key: string, defaultValue?: any) => {
    return preferences[key] ?? defaultValue;
  }, [preferences]);

  return {
    preferences,
    isLoading,
    savePreferences,
    updatePreference,
    getPreference,
  };
}

export default useDashboardState;
