import React from 'react';
import { cn } from './utils';

/**
 * Confirmation dialog utilities for validation control panel components
 */

export interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive' | 'warning';
  icon?: React.ReactNode;
  className?: string;
}

export interface ConfirmationAction {
  id: string;
  title: string;
  description: string;
  confirmText: string;
  cancelText: string;
  variant: 'default' | 'destructive' | 'warning';
  icon?: React.ReactNode;
  onConfirm: () => void;
  onCancel?: () => void;
}

/**
 * Confirmation dialog component
 */
export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  icon,
  className,
}) => {
  if (!isOpen) return null;

  const getVariantClasses = () => {
    switch (variant) {
      case 'destructive':
        return {
          icon: 'text-red-500',
          confirmButton: 'bg-red-600 hover:bg-red-700 text-white',
          border: 'border-red-200',
        };
      case 'warning':
        return {
          icon: 'text-yellow-500',
          confirmButton: 'bg-yellow-600 hover:bg-yellow-700 text-white',
          border: 'border-yellow-200',
        };
      default:
        return {
          icon: 'text-blue-500',
          confirmButton: 'bg-blue-600 hover:bg-blue-700 text-white',
          border: 'border-gray-200',
        };
    }
  };

  const variantClasses = getVariantClasses();

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirmation-title"
      aria-describedby="confirmation-description"
    >
      <div
        className={cn(
          'bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6',
          variantClasses.border,
          className
        )}
      >
        <div className="flex items-start gap-4">
          {icon && (
            <div className={cn('flex-shrink-0', variantClasses.icon)}>
              {icon}
            </div>
          )}
          
          <div className="flex-1">
            <h3
              id="confirmation-title"
              className="text-lg font-semibold text-gray-900 mb-2"
            >
              {title}
            </h3>
            
            <p
              id="confirmation-description"
              className="text-sm text-gray-600 mb-6"
            >
              {description}
            </p>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                type="button"
              >
                {cancelText}
              </button>
              
              <button
                onClick={onConfirm}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2',
                  variantClasses.confirmButton,
                  variant === 'destructive' ? 'focus:ring-red-500' : 'focus:ring-blue-500'
                )}
                type="button"
              >
                {confirmText}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Hook for managing confirmation dialogs
 */
export const useConfirmationDialog = () => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [action, setAction] = React.useState<ConfirmationAction | null>(null);

  const showConfirmation = (confirmationAction: ConfirmationAction) => {
    setAction(confirmationAction);
    setIsOpen(true);
  };

  const hideConfirmation = () => {
    setIsOpen(false);
    setAction(null);
  };

  const handleConfirm = () => {
    if (action) {
      action.onConfirm();
      hideConfirmation();
    }
  };

  const handleCancel = () => {
    if (action?.onCancel) {
      action.onCancel();
    }
    hideConfirmation();
  };

  return {
    isOpen,
    action,
    showConfirmation,
    hideConfirmation,
    handleConfirm,
    handleCancel,
  };
};

/**
 * Predefined confirmation actions for common destructive operations
 */
export const ConfirmationActions = {
  /**
   * Stop validation confirmation
   */
  stopValidation: (onConfirm: () => void): ConfirmationAction => ({
    id: 'stop-validation',
    title: 'Stop Validation',
    description: 'Are you sure you want to stop the current validation? This action cannot be undone and will lose any progress made.',
    confirmText: 'Stop Validation',
    cancelText: 'Continue Validation',
    variant: 'destructive',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    onConfirm,
  }),

  /**
   * Clear validation data confirmation
   */
  clearValidationData: (onConfirm: () => void): ConfirmationAction => ({
    id: 'clear-validation-data',
    title: 'Clear Validation Data',
    description: 'Are you sure you want to clear all validation data? This will remove all validation results and cannot be undone.',
    confirmText: 'Clear Data',
    cancelText: 'Keep Data',
    variant: 'destructive',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    ),
    onConfirm,
  }),

  /**
   * Reset validation settings confirmation
   */
  resetValidationSettings: (onConfirm: () => void): ConfirmationAction => ({
    id: 'reset-validation-settings',
    title: 'Reset Validation Settings',
    description: 'Are you sure you want to reset all validation settings to their default values? This action cannot be undone.',
    confirmText: 'Reset Settings',
    cancelText: 'Keep Settings',
    variant: 'warning',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
    onConfirm,
  }),

  /**
   * Delete validation profile confirmation
   */
  deleteValidationProfile: (profileName: string, onConfirm: () => void): ConfirmationAction => ({
    id: 'delete-validation-profile',
    title: 'Delete Validation Profile',
    description: `Are you sure you want to delete the validation profile "${profileName}"? This action cannot be undone.`,
    confirmText: 'Delete Profile',
    cancelText: 'Keep Profile',
    variant: 'destructive',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    ),
    onConfirm,
  }),

  /**
   * Force stop validation confirmation
   */
  forceStopValidation: (onConfirm: () => void): ConfirmationAction => ({
    id: 'force-stop-validation',
    title: 'Force Stop Validation',
    description: 'Are you sure you want to force stop the validation? This will immediately terminate the process and may result in data loss.',
    confirmText: 'Force Stop',
    cancelText: 'Cancel',
    variant: 'destructive',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    ),
    onConfirm,
  }),
};

/**
 * Confirmation dialog provider for global confirmation management
 */
export const ConfirmationDialogProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const confirmation = useConfirmationDialog();

  return (
    <ConfirmationDialogContext.Provider value={confirmation}>
      {children}
      {confirmation.action && (
        <ConfirmationDialog
          isOpen={confirmation.isOpen}
          onClose={confirmation.handleCancel}
          onConfirm={confirmation.handleConfirm}
          title={confirmation.action.title}
          description={confirmation.action.description}
          confirmText={confirmation.action.confirmText}
          cancelText={confirmation.action.cancelText}
          variant={confirmation.action.variant}
          icon={confirmation.action.icon}
        />
      )}
    </ConfirmationDialogContext.Provider>
  );
};

/**
 * Context for confirmation dialogs
 */
export const ConfirmationDialogContext = React.createContext<{
  isOpen: boolean;
  action: ConfirmationAction | null;
  showConfirmation: (action: ConfirmationAction) => void;
  hideConfirmation: () => void;
  handleConfirm: () => void;
  handleCancel: () => void;
}>({
  isOpen: false,
  action: null,
  showConfirmation: () => {},
  hideConfirmation: () => {},
  handleConfirm: () => {},
  handleCancel: () => {},
});

/**
 * Hook to use confirmation dialog context
 */
export const useConfirmationDialogContext = () => {
  const context = React.useContext(ConfirmationDialogContext);
  if (!context) {
    throw new Error('useConfirmationDialogContext must be used within a ConfirmationDialogProvider');
  }
  return context;
};

