// src/contexts/AuthContext.tsx

import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import { authService } from '../services/auth.service';
import { AdminPageSkeleton } from '@/components/ui-admin/AdminPageSkeleton';

// Définir les types pour plus de sécurité
type Role = 'admin' | 'manager' | 'directeur' | 'backoffice' | 'commercial';

interface User {
  id: string;
  name: string;
  nom?: string;
  role: Role;
  email?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (user: User) => void; // MODIFIÉ: Accepte un objet User
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const inactivityTimer = useRef<number | null>(null);
  const refreshTimer = useRef<number | null>(null);

  // Configuration
  const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes d'inactivité
  const REFRESH_INTERVAL = 10 * 60 * 1000; // Refresh toutes les 10 minutes
  
  // MODIFIÉ: La fonction de logout
  const logout = useCallback(() => {
    setUser(null);
    authService.removeToken();
    
    // Clear timers
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }
    if (refreshTimer.current) {
      clearInterval(refreshTimer.current);
    }
  }, []);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }
    
    if (user) {
      inactivityTimer.current = setTimeout(() => {
        console.log('Auto logout due to inactivity');
        logout();
      }, INACTIVITY_TIMEOUT);
    }
  }, [user, logout]);

  const setupTokenRefresh = useCallback(() => {
    if (refreshTimer.current) {
      clearInterval(refreshTimer.current);
    }

    if (user) {
      refreshTimer.current = setInterval(async () => {
        try {
          const refreshToken = authService.getRefreshToken();
          if (refreshToken) {
            const tokenData = await authService.refreshToken();
            authService.storeToken(tokenData.access_token);
            authService.storeRefreshToken(tokenData.refresh_token);
            console.log('Token refreshed automatically');
          }
        } catch (error) {
          console.error('Failed to refresh token:', error);
          logout();
        }
      }, REFRESH_INTERVAL);
    }
  }, [user, logout]);

  // Restaurer l'état utilisateur depuis localStorage au démarrage
  useEffect(() => {
    const initializeAuth = () => {
      const token = authService.getToken();
      const savedUser: any = authService.getUser();

      if (token && savedUser) {
        // Normaliser la forme utilisateur (certains flux stockent firstName/lastName)
        const normalized: User = {
          id: savedUser.id,
          name:
            savedUser.name ||
            [savedUser.firstName, savedUser.lastName].filter(Boolean).join(' ') ||
            savedUser.email ||
            'Utilisateur',
          role: savedUser.role,
          email: savedUser.email,
        };

        setUser(normalized);
      }

      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  // Gérer les timers d'inactivité et de refresh
  useEffect(() => {
    if (user) {
      resetInactivityTimer();
      setupTokenRefresh();

      // Écouter les événements d'activité utilisateur
      const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
      
      const resetTimer = () => resetInactivityTimer();
      
      events.forEach(event => {
        document.addEventListener(event, resetTimer, true);
      });

      return () => {
        if (inactivityTimer.current) {
          clearTimeout(inactivityTimer.current);
        }
        if (refreshTimer.current) {
          clearInterval(refreshTimer.current);
        }
        events.forEach(event => {
          document.removeEventListener(event, resetTimer, true);
        });
      };
    }
  }, [user, resetInactivityTimer, setupTokenRefresh]);

  // MODIFIÉ: La fonction de login met à jour avec l'objet utilisateur complet
  const login = (userData: User) => {
    setUser(userData);
    authService.storeUser(userData);
  };

  const value = { user, isAuthenticated: !!user, login, logout };

  // Afficher un loading pendant l'initialisation
  if (isLoading) {
    return <AdminPageSkeleton hasHeader hasTable />;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Hook personnalisé pour utiliser le contexte facilement
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
