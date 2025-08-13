// src/contexts/AuthContext.tsx

import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { authService } from '../services/auth.service';

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

        // Auto-logout après 15 minutes
        setTimeout(() => {
          console.log('Auto logout après 15 minutes');
          logout();
        }, 900000); // 15 minutes
      }

      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  // MODIFIÉ: La fonction de login met à jour avec l'objet utilisateur complet
  const login = (userData: User) => {
    setUser(userData);
    authService.storeUser(userData);
  };

  const logout = () => {
    setUser(null);
    authService.removeToken();
  };

  const value = { user, isAuthenticated: !!user, login, logout };

  // Afficher un loading pendant l'initialisation
  if (isLoading) {
    return <div>Loading...</div>;
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
