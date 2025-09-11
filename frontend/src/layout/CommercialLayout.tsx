// src/layout/CommercialLayout.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { prospectionService } from '@/services/prospection.service';
import { locationService } from '@/services/location.service';
import { Modal } from '@/components/ui-admin/Modal';
import { Button } from '@/components/ui-admin/button';
import { toast } from 'sonner';
import { CommercialBottomBar } from './CommercialBottomBar';
import CommercialHeader from './CommercialHeader';
import { useSocket } from '@/hooks/useSocket';

const CommercialLayout = () => {
  const { user } = useAuth();
  const [pendingRequest, setPendingRequest] = useState<any | null>(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const mainContentRef = useRef<HTMLDivElement>(null);
  const socket = useSocket();

  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [isBottomBarVisible, setIsBottomBarVisible] = useState(true);

  const layoutControls = {
    hideHeader: () => setIsHeaderVisible(false),
    showHeader: () => setIsHeaderVisible(true),
    hideBottomBar: () => setIsBottomBarVisible(false),
    showBottomBar: () => setIsBottomBarVisible(true),
  };

  useEffect(() => {
    if (mainContentRef.current) {
      mainContentRef.current.scrollTo(0, 0);
    }
  }, [pathname]);

  const fetchPendingRequests = useCallback(async () => {
    if (user?.id) {
      try {
        const requests = await prospectionService.getPendingRequestsForCommercial(user.id);
        if (requests.length > 0) {
          setPendingRequest(requests[0]);
        } else {
          setPendingRequest(null);
        }
      } catch (error) {
        console.error("Error fetching pending requests:", error);
        toast.error("Erreur lors du chargement des demandes de prospection.");
      }
    }
  }, [user]);

  // WebSocket pour écouter les invitations DUO en temps réel
  useEffect(() => {
    if (!socket || !user) return;

    // Se connecter au système DUO
    socket.emit('duo_user_connected', {
      userId: user.id,
      userInfo: {
        nom: user.nom || user.name,
        prenom: user.name
      }
    });

    // Écouter les nouvelles invitations en temps réel
    const handleInvitationReceived = (invitation: {
      requestId: string;
      requesterName: string;
      requesterPrenom: string;
      immeubleAdresse: string;
      immeubleVille: string;
      immeubleId: string;
      timestamp: string;
    }) => {
      console.log('Nouvelle invitation DUO reçue:', invitation);
      setPendingRequest({
        id: invitation.requestId,
        immeubleId: invitation.immeubleId,
        immeuble: {
          adresse: invitation.immeubleAdresse,
          ville: invitation.immeubleVille
        },
        requester: {
          nom: invitation.requesterName,
          prenom: invitation.requesterPrenom
        }
      });
      toast.info(`Nouvelle invitation de ${invitation.requesterPrenom} ${invitation.requesterName}`);
    };

    socket.on('duo_invitation_received', handleInvitationReceived);

    // Récupérer les demandes en attente au chargement (fallback)
    fetchPendingRequests();

    return () => {
      socket.off('duo_invitation_received', handleInvitationReceived);
    };
  }, [socket, user, fetchPendingRequests]);

  // Initialiser le suivi GPS quand le commercial se connecte
  useEffect(() => {
    const initializeGPS = async () => {
      if (user?.id) {
        console.log('🚀 Initialisation du GPS pour le commercial:', user.nom || user.name);
        
        const success = await locationService.startTracking(user.id);
        if (success) {
          toast.success('📍 Géolocalisation activée');
        } else {
          toast.error('❌ Impossible d\'activer la géolocalisation');
        }
      }
    };

    initializeGPS();

    // Gérer la déconnexion globale
    const handleBeforeUnload = () => {
      locationService.stopTracking();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // L'utilisateur quitte l'onglet/app, mais on garde le GPS actif
        console.log('📍 Onglet caché, GPS maintenu actif');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      // Ne pas arrêter le GPS ici pour permettre la navigation
    };
  }, [user]);

  const handleRequestResponse = async (accept: boolean) => {
    if (!pendingRequest || !socket) return;
    
    try {
      // 1. Traitement API REST pour mettre à jour la base de données
      const response = await prospectionService.handleProspectionRequest({
        requestId: pendingRequest.id,
        accept,
      });

      // 2. Notifier via WebSocket pour mise à jour temps réel
      socket.emit('duo_invitation_response', {
        requestId: pendingRequest.id,
        accepted: accept,
        responderName: user?.nom || user?.name,
        responderPrenom: user?.name
      });

      toast.success(accept ? "Demande acceptée !" : "Demande refusée.");
      setPendingRequest(null);
      
      if (accept && response.immeubleId) {
        navigate(`/commercial/prospecting/doors/${response.immeubleId}`);
      }
    } catch (error) {
      toast.error("Erreur lors du traitement de la demande.");
    }
  };

  return (
    <div className="flex flex-col h-screen bg-muted/40">
      {isHeaderVisible && <CommercialHeader />}
      <main ref={mainContentRef} className="flex-1 overflow-y-auto pb-16">
        <Outlet context={layoutControls} />
      </main>
      {isBottomBarVisible && <CommercialBottomBar />}

      {pendingRequest && (
        <Modal
          isOpen={!!pendingRequest}
          onClose={() => setPendingRequest(null)}
          title="Nouvelle demande de prospection en duo"
          maxWidth="max-w-md"
        >
          <p className="mb-4">
            {pendingRequest.requester.prenom} {pendingRequest.requester.nom} vous invite à une prospection en duo pour l'immeuble situé au:
          </p>
          <p className="font-semibold mb-4">
            {pendingRequest.immeuble.adresse}, {pendingRequest.immeuble.codePostal} {pendingRequest.immeuble.ville}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => handleRequestResponse(false)}>Refuser</Button>
            <Button onClick={() => handleRequestResponse(true)} className="bg-green-600 text-black hover:bg-green-700">Accepter</Button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default CommercialLayout;