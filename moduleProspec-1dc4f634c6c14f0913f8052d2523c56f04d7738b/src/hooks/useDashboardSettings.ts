import { useState, useEffect, useCallback } from 'react';
import { DashboardSettings, defaultDashboardSettings } from '@/types/dashboard-settings';

const STORAGE_KEY = 'dashboard-settings';

export const useDashboardSettings = () => {
  const [settings, setSettings] = useState<DashboardSettings>(defaultDashboardSettings);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSettings = () => {
      try {
        const savedSettings = localStorage.getItem(STORAGE_KEY);
        if (savedSettings) {
          const parsed = JSON.parse(savedSettings);
          setSettings({ ...defaultDashboardSettings, ...parsed });
        }
      } catch (error) {
        console.error('Failed to load dashboard settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  const updateSettings = useCallback((newSettings: Partial<DashboardSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error('Failed to save dashboard settings:', error);
      }
      return updated;
    });
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(defaultDashboardSettings);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to reset dashboard settings:', error);
    }
  }, []);

  return {
    settings,
    updateSettings,
    resetSettings,
    isLoading
  };
};