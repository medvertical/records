import { useState, useCallback } from 'react';

export function useSettingsModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('validation');

  const open = useCallback((tab?: string) => {
    if (tab) {
      setActiveTab(tab);
    }
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  return {
    isOpen,
    activeTab,
    setActiveTab,
    open,
    close,
    toggle,
    setIsOpen
  };
}

