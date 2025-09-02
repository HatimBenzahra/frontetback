import { useEffect } from 'react';
import { assignmentGoalsService } from '@/services/assignment-goals.service';

/**
 * Hook pour nettoyer automatiquement les assignations expirées
 * Appelé périodiquement pour transférer les assignations expirées vers l'historique
 */
export const useAssignmentCleanup = (enabled: boolean = true) => {
  useEffect(() => {
    if (!enabled) return;

    const cleanupExpiredAssignments = async () => {
      try {
        console.log('🧹 Nettoyage automatique des assignations expirées...');
        await assignmentGoalsService.transferExpiredAssignmentsToHistory();
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
  }, [enabled]);
};