import { createContext, useContext, ReactNode } from 'react';
import { useSettingsModal } from '@/hooks/use-settings-modal';

interface SettingsModalContextValue {
  isOpen: boolean;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  open: (tab?: string) => void;
  close: () => void;
  toggle: () => void;
}

const SettingsModalContext = createContext<SettingsModalContextValue | null>(null);

interface SettingsModalProviderProps {
  children: ReactNode;
}

export function SettingsModalProvider({ children }: SettingsModalProviderProps) {
  const modalState = useSettingsModal();

  return (
    <SettingsModalContext.Provider value={modalState}>
      {children}
    </SettingsModalContext.Provider>
  );
}

export function useSettingsModalControl() {
  const context = useContext(SettingsModalContext);
  if (!context) {
    // Provide a fallback that logs an error but doesn't break the app
    console.error('useSettingsModalControl must be used within SettingsModalProvider');
    return {
      isOpen: false,
      activeTab: 'validation',
      setActiveTab: () => {},
      open: () => console.warn('Settings modal context not available'),
      close: () => {},
      toggle: () => {}
    };
  }
  return context;
}

