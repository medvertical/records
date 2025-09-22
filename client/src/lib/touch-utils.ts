// ============================================================================
// Touch Utilities - Mobile touch optimization utilities
// ============================================================================

import { cn } from '@/lib/utils';

/**
 * Touch Utilities - Single responsibility: Mobile touch optimization helpers
 * Follows global rules: Under 200 lines, single responsibility, focused on touch interactions
 */

// Minimum touch target size as per accessibility guidelines (44px)
export const MIN_TOUCH_TARGET_SIZE = 44;

/**
 * Get touch-optimized button classes for mobile devices
 */
export const getTouchButtonClasses = (baseClasses?: string) => {
  return cn(
    'min-h-[44px] min-w-[44px] touch-manipulation select-none',
    'active:scale-95 transition-transform duration-150',
    baseClasses
  );
};

/**
 * Get touch-optimized card classes for mobile devices
 */
export const getTouchCardClasses = (baseClasses?: string) => {
  return cn(
    'touch-manipulation select-none',
    'active:scale-[0.98] transition-transform duration-150',
    baseClasses
  );
};

/**
 * Get touch-optimized input classes for mobile devices
 */
export const getTouchInputClasses = (baseClasses?: string) => {
  return cn(
    'min-h-[44px] touch-manipulation',
    'text-base', // Prevent zoom on iOS
    baseClasses
  );
};

/**
 * Get touch-optimized link classes for mobile devices
 */
export const getTouchLinkClasses = (baseClasses?: string) => {
  return cn(
    'min-h-[44px] min-w-[44px] touch-manipulation select-none',
    'inline-flex items-center justify-center',
    'active:scale-95 transition-transform duration-150',
    baseClasses
  );
};

/**
 * Check if device supports touch
 */
export const isTouchDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    // @ts-ignore - for older browsers
    navigator.msMaxTouchPoints > 0
  );
};

/**
 * Get responsive touch classes based on device type
 */
export const getResponsiveTouchClasses = (
  mobileClasses: string,
  desktopClasses?: string
): string => {
  const touchClasses = isTouchDevice() ? mobileClasses : '';
  const defaultClasses = desktopClasses || '';
  
  return cn(touchClasses, defaultClasses);
};

/**
 * Touch event handlers for better mobile interaction
 */
export const createTouchHandlers = (onClick: () => void) => {
  let touchStartTime = 0;
  let touchStartPosition = { x: 0, y: 0 };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartTime = Date.now();
    const touch = e.touches[0];
    touchStartPosition = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndTime = Date.now();
    const touchDuration = touchEndTime - touchStartTime;
    
    // Only trigger if touch duration is reasonable (not a long press)
    if (touchDuration < 500) {
      const touch = e.changedTouches[0];
      const touchEndPosition = { x: touch.clientX, y: touch.clientY };
      
      // Calculate distance moved
      const distance = Math.sqrt(
        Math.pow(touchEndPosition.x - touchStartPosition.x, 2) +
        Math.pow(touchEndPosition.y - touchStartPosition.y, 2)
      );
      
      // Only trigger if touch didn't move too much (not a swipe)
      if (distance < 10) {
        e.preventDefault();
        onClick();
      }
    }
  };

  return {
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
  };
};

/**
 * Mobile-optimized spacing utilities
 */
export const getMobileSpacing = (size: 'sm' | 'md' | 'lg' | 'xl') => {
  const spacing = {
    sm: 'p-2',
    md: 'p-4',
    lg: 'p-6',
    xl: 'p-8',
  };
  
  return cn(
    spacing[size],
    // Add extra padding on touch devices
    isTouchDevice() && 'p-6 sm:p-4 md:p-6 lg:p-8'
  );
};

/**
 * Mobile-optimized text sizing
 */
export const getMobileTextSize = (size: 'sm' | 'md' | 'lg' | 'xl') => {
  const textSizes = {
    sm: 'text-sm sm:text-xs',
    md: 'text-base sm:text-sm',
    lg: 'text-lg sm:text-base',
    xl: 'text-xl sm:text-lg',
  };
  
  return textSizes[size];
};

/**
 * Mobile-optimized button sizing
 */
export const getMobileButtonSize = (size: 'sm' | 'md' | 'lg') => {
  const buttonSizes = {
    sm: 'h-10 px-3 text-sm sm:h-8 sm:px-2 sm:text-xs',
    md: 'h-12 px-4 text-base sm:h-10 sm:px-3 sm:text-sm',
    lg: 'h-14 px-6 text-lg sm:h-12 sm:px-4 sm:text-base',
  };
  
  return cn(
    buttonSizes[size],
    'min-w-[44px] min-h-[44px] touch-manipulation'
  );
};

export default {
  MIN_TOUCH_TARGET_SIZE,
  getTouchButtonClasses,
  getTouchCardClasses,
  getTouchInputClasses,
  getTouchLinkClasses,
  isTouchDevice,
  getResponsiveTouchClasses,
  createTouchHandlers,
  getMobileSpacing,
  getMobileTextSize,
  getMobileButtonSize,
};
