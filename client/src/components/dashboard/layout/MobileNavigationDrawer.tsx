import React, { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MobileNavigationProps, QuickAccessItem, NavigationItem } from '@/shared/types/dashboard-new';
import { X, Users, Activity, Calendar, Heart, Database } from 'lucide-react';
import { getTouchButtonClasses } from '@/lib/touch-utils';

/**
 * MobileNavigationDrawer Component - Single responsibility: Provide mobile navigation drawer
 * Follows global rules: Under 200 lines, single responsibility, focused on mobile navigation
 */
export const MobileNavigationDrawer: React.FC<MobileNavigationProps> = ({
  isOpen,
  onClose,
  navigationItems = [],
  quickAccessItems = [],
}) => {
  // Close drawer on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when drawer is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Default navigation items if none provided
  const defaultNavigationItems: NavigationItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: Database,
      href: '/',
      active: false,
    },
    {
      id: 'resources',
      label: 'Resources',
      icon: Database,
      href: '/resources',
      active: false,
    },
    {
      id: 'packages',
      label: 'Packages',
      icon: Database,
      href: '/packages',
      active: false,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Database,
      href: '/settings',
      active: false,
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
  const quickItems = quickAccessItems.length > 0 ? quickAccessItems : defaultQuickAccessItems;

  const formatCount = (count: number): string => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  const getResourceIcon = (resourceType: string) => {
    const icons: Record<string, React.ComponentType<any>> = {
      Patient: Users,
      Observation: Activity,
      Encounter: Calendar,
      Condition: Heart,
    };
    return icons[resourceType] || Database;
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
          aria-label="Close navigation menu"
        />
      )}

      {/* Drawer */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-card border-r transform transition-transform duration-300 ease-in-out lg:hidden touch-optimized',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-lg font-semibold">Navigation</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className={getTouchButtonClasses("p-2")}
              aria-label="Close navigation menu"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.id}
                  variant={item.active ? "default" : "ghost"}
                  className={cn(
                    'w-full justify-start px-3',
                    item.active && 'nav-item-active',
                    !item.active && 'nav-item-inactive'
                  )}
                  onClick={onClose} // Close drawer when item is clicked
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {item.label}
                </Button>
              );
            })}
          </nav>

          {/* Quick Access Section */}
          <div className="p-4 border-t">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              Quick Access
            </h3>
            <div className="space-y-1">
              {quickItems.map((item) => {
                const Icon = getResourceIcon(item.resourceType);
                return (
                  <div
                    key={item.id}
                    className="quick-access-item cursor-pointer"
                    onClick={onClose} // Close drawer when item is clicked
                  >
                    <div className="flex items-center space-x-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{item.label}</span>
                    </div>
                    {item.count > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {formatCount(item.count)}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

/**
 * Mobile Navigation Toggle Button - Simplified toggle for mobile
 */
interface MobileNavToggleProps {
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
}

export const MobileNavToggle: React.FC<MobileNavToggleProps> = ({
  isOpen,
  onToggle,
  className,
}) => {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onToggle}
      className={cn('lg:hidden', className)}
      aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
      aria-expanded={isOpen}
    >
      <div className="w-5 h-5 flex flex-col justify-center space-y-1">
        <div className={cn(
          "w-full h-0.5 bg-current transition-all duration-300",
          isOpen && "rotate-45 translate-y-1.5"
        )}></div>
        <div className={cn(
          "w-full h-0.5 bg-current transition-all duration-300",
          isOpen && "opacity-0"
        )}></div>
        <div className={cn(
          "w-full h-0.5 bg-current transition-all duration-300",
          isOpen && "-rotate-45 -translate-y-1.5"
        )}></div>
      </div>
    </Button>
  );
};

export default MobileNavigationDrawer;
