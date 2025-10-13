import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DashboardSidebarProps, QuickAccessItem, NavigationItem } from '@/shared/types/dashboard-new';
import { 
  Database, 
  ChartPie, 
  Settings, 
  Package,
  ChevronLeft,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { useQuickAccessItems, useQuickAccessCounts } from '@/hooks/use-quick-access-preferences';
import { ManageQuickAccessDialog } from '@/components/dashboard/AddQuickAccessDialog';
import { getResourceTypeIcon } from '@/lib/resource-type-icons';

/**
 * DashboardSidebar Component - Single responsibility: Provide collapsible navigation for dashboard
 * Follows global rules: Separate concerns for mobile/desktop, uses existing patterns
 */
export const DashboardSidebar: React.FC<DashboardSidebarProps> = ({
  collapsed = false,
  onToggle,
  quickAccessItems = [],
  navigationItems = [],
}) => {
  const [location] = useLocation();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  
  // Use the new hook to get user's custom quick access items
  const { data: userQuickAccess, isLoading: isLoadingQuickAccess } = useQuickAccessItems();
  const { data: quickAccessCounts, isLoading: isCountsLoading } = useQuickAccessCounts();

  // Default navigation items if none provided
  const defaultNavigationItems: NavigationItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: ChartPie,
      href: '/',
      active: location === '/',
    },
    {
      id: 'resources',
      label: 'Resources',
      icon: Database,
      href: '/resources',
      active: location.startsWith('/resources'),
    },
    {
      id: 'packages',
      label: 'Packages',
      icon: Package,
      href: '/packages',
      active: location.startsWith('/packages'),
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      href: '/settings',
      active: location.startsWith('/settings'),
    },
  ];

  // Default quick access items if none provided
  const defaultQuickAccessItems: QuickAccessItem[] = [
    {
      id: 'patients',
      label: 'Patients',
      resourceType: 'Patient',
      count: 0,
      href: '/resources?type=Patient',
    },
    {
      id: 'observations',
      label: 'Observations',
      resourceType: 'Observation',
      count: 0,
      href: '/resources?type=Observation',
    },
    {
      id: 'encounters',
      label: 'Encounters',
      resourceType: 'Encounter',
      count: 0,
      href: '/resources?type=Encounter',
    },
    {
      id: 'conditions',
      label: 'Conditions',
      resourceType: 'Condition',
      count: 0,
      href: '/resources?type=Condition',
    },
  ];

  const navItems = navigationItems.length > 0 ? navigationItems : defaultNavigationItems;
  
  // Use user's custom quick access items if available, otherwise fall back to props or defaults
  const userQuickAccessItems = userQuickAccess?.quickAccessItems || [];
  const quickItems = userQuickAccessItems.length > 0 
    ? userQuickAccessItems.map(resourceType => ({
        id: resourceType.toLowerCase(),
        label: resourceType,
        resourceType,
        count: quickAccessCounts?.[resourceType] ?? 0,
        href: `/resources?type=${resourceType}`
      }))
    : quickAccessItems.length > 0 ? quickAccessItems : defaultQuickAccessItems;

  const formatCount = (count: number): string => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };


  return (
    <aside className={cn(
      'dashboard-sidebar',
      collapsed && 'dashboard-sidebar-collapsed',
      'transition-all duration-300 ease-in-out'
    )}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          {!collapsed && (
            <h2 className="text-lg font-semibold">Navigation</h2>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="p-2"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.id} href={item.href}>
                <Button
                  variant={item.active ? "default" : "ghost"}
                  className={cn(
                    'w-full justify-start',
                    collapsed ? 'px-2' : 'px-3',
                    item.active && 'nav-item-active',
                    !item.active && 'nav-item-inactive'
                  )}
                >
                  <Icon className={cn('h-4 w-4', !collapsed && 'mr-2')} />
                  {!collapsed && item.label}
                </Button>
              </Link>
            );
          })}
        </nav>

        {/* Quick Access Section */}
        {!collapsed && (
          <div className="p-4 border-t">
            <div className="flex items-center justify-between mb-3 group">
              <h3 className="text-sm font-medium text-muted-foreground">
                Quick Access
              </h3>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => setAddDialogOpen(true)}
                title="Customize quick access"
              >
                <Settings className="h-4 w-4 text-gray-400" />
              </Button>
            </div>
            <div className="space-y-1">
              {isLoadingQuickAccess ? (
                <div className="text-sm text-muted-foreground">Loading...</div>
              ) : (
                quickItems.map((item) => {
                  const Icon = getResourceTypeIcon(item.resourceType);
                  
                  return (
                    <Link key={item.id} href={item.href}>
                      <div className="quick-access-item">
                        <div className="flex items-center space-x-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{item.label}</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {isCountsLoading ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            formatCount(item.count)
                          )}
                        </Badge>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Collapsed Quick Access - Show icons only */}
        {collapsed && (
          <div className="p-2 border-t">
            <div className="grid grid-cols-2 gap-1">
              {quickItems.slice(0, 4).map((item) => {
                const Icon = getResourceTypeIcon(item.resourceType);
                return (
                  <Link key={item.id} href={item.href}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-2 h-auto"
                      title={item.label}
                    >
                      <Icon className="h-4 w-4" />
                    </Button>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
      
      {/* Manage Quick Access Dialog */}
      <ManageQuickAccessDialog 
        open={addDialogOpen} 
        onOpenChange={setAddDialogOpen} 
      />
    </aside>
  );
};

/**
 * Desktop Sidebar - Optimized for desktop layout
 */
interface DesktopSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  quickAccessItems: QuickAccessItem[];
  navigationItems: NavigationItem[];
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  collapsed,
  onToggle,
  quickAccessItems,
  navigationItems,
}) => {
  return (
    <div className="hidden lg:flex">
      <DashboardSidebar
        collapsed={collapsed}
        onToggle={onToggle}
        quickAccessItems={quickAccessItems}
        navigationItems={navigationItems}
      />
    </div>
  );
};

/**
 * Sidebar Toggle Button - For mobile/tablet layouts
 */
interface SidebarToggleProps {
  onToggle: () => void;
  className?: string;
}

export const SidebarToggle: React.FC<SidebarToggleProps> = ({
  onToggle,
  className,
}) => {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onToggle}
      className={cn('lg:hidden', className)}
      aria-label="Toggle navigation menu"
    >
      <div className="w-5 h-5 flex flex-col justify-center space-y-1">
        <div className="w-full h-0.5 bg-current"></div>
        <div className="w-full h-0.5 bg-current"></div>
        <div className="w-full h-0.5 bg-current"></div>
      </div>
    </Button>
  );
};

/**
 * Sidebar Overlay - For mobile sidebar overlay
 */
interface SidebarOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SidebarOverlay: React.FC<SidebarOverlayProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="mobile-nav-overlay"
      onClick={onClose}
      aria-label="Close navigation menu"
    />
  );
};

export default DashboardSidebar;
