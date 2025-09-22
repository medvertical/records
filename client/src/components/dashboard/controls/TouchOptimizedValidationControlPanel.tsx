import React from 'react';
import { ValidationControlPanel } from './ValidationControlPanel';
import { getTouchButtonClasses, getMobileButtonSize } from '@/lib/touch-utils';

/**
 * TouchOptimizedValidationControlPanel Component - Single responsibility: Mobile-optimized validation control panel
 * Follows global rules: Single responsibility, uses existing components with touch optimization
 */
interface TouchOptimizedValidationControlPanelProps {
  status?: any;
  loading?: boolean;
  error?: string | null;
  onStart?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
  onRevalidateAll?: () => void;
  onSettings?: () => void;
  onRefresh?: () => void;
  className?: string;
}

export const TouchOptimizedValidationControlPanel: React.FC<TouchOptimizedValidationControlPanelProps> = (props) => {
  // Wrap the base component with touch-optimized styling
  return (
    <div className="touch-manipulation select-none">
      <ValidationControlPanel
        {...props}
        className={`${props.className || ''} touch-optimized`}
      />
      
      {/* Add mobile-specific styles */}
      <style jsx>{`
        .touch-optimized :global(.btn) {
          min-height: 44px;
          min-width: 44px;
          touch-action: manipulation;
        }
        
        .touch-optimized :global(.btn:active) {
          transform: scale(0.95);
          transition: transform 150ms ease-in-out;
        }
        
        .touch-optimized :global(.card) {
          touch-action: manipulation;
        }
        
        .touch-optimized :global(.card:active) {
          transform: scale(0.98);
          transition: transform 150ms ease-in-out;
        }
        
        @media (max-width: 768px) {
          .touch-optimized :global(.btn) {
            padding: 12px 16px;
            font-size: 16px;
          }
          
          .touch-optimized :global(.card) {
            padding: 16px;
          }
        }
      `}</style>
    </div>
  );
};

export default TouchOptimizedValidationControlPanel;
