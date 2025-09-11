import { useEffect } from 'react';
import { assignmentGoalsService } from '@/services/assignment-goals.service';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook pour nettoyer automatiquement les assignations expirées
 * Appelé périodiquement pour transférer les assignations expirées vers l'historique
 * Fonctionne pour les rôles 'admin' et 'manager'
 */
export const useAssignmentCleanup = (enabled: boolean = true) => {
  const { user } = useAuth();
  
  useEffect(() => {
    if (!enabled) return;
    
    // Vérifier que l'utilisateur a les droits (admin ou manager)
    const hasCleanupPermissions = user?.role && ['admin', 'manager'].includes(user.role);
    if (!hasCleanupPermissions) {
      console.warn('🚫 Utilisateur non autorisé pour le nettoyage automatique:', user?.role);
      return;
    }

    const cleanupExpiredAssignments = async () => {
      try {
        console.log('🧹 Nettoyage automatique des assignations expirées...', `(Role: ${user.role})`);
        
        // Utiliser le service approprié selon le rôle
        if (user.role === 'admin') {
          await assignmentGoalsService.transferExpiredAssignmentsToHistory();
        } else if (user.role === 'manager') {
          // Pour les managers, on utilise le service admin car le nettoyage est une opération système
          // mais on s'assure qu'ils ont les permissions via le backend
          await assignmentGoalsService.cleanupExpiredAssignments();
        }
        
        console.log('✅ Nettoyage automatique terminé avec succès');
      } catch (error) {
        console.warn('⚠️ Erreur lors du nettoyage automatique:', error);
      }
    };

    // Nettoyer immédiatement au montage
    cleanupExpiredAssignments();

    // Puis toutes les 5 minutes (300000 ms)
    const interval = setInterval(cleanupExpiredAssignments, 5 * 60 * 1000);

    return () => {
      clearInterval(interval);
    };
  }, [enabled, user?.role]);
};