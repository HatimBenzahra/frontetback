import { useEffect, useMemo, useCallback } from 'react';
import { useSuiviLogic } from './hooks/useSuiviLogic';
import { SuiviStats } from './components/SuiviStats';
import { SuiviTable } from './components/SuiviTable';
import { ListeningModal } from './components/ListeningModal';
import { HistoryModal } from './components/HistoryModal';
import { MapModal } from './components/MapModal';

const SuiviPage = () => {
  const {
    // State
    commercials,
    selectedCommercial,
    zones,
    loading,
    showListeningModal,
    showMapModal,
    showHistoryModal,
    attemptedListeningTo,
    transcriptions,
    transcriptionHistory,
    loadingHistory,
    selectedCommercialForHistory,
    selectedSession,
    audioStreaming,

    // Actions
    handleShowOnMap,
    handleShowHistory,
    handleStartListening,
    handleStopListening,
    setShowListeningModal,
    setShowMapModal,
    setShowHistoryModal,

    setSelectedSession,
    setAttemptedListeningTo,
  } = useSuiviLogic();

  // Sélectionner automatiquement la première session quand l'historique change
  useEffect(() => {
    if (transcriptionHistory.length > 0 && !selectedSession) {
      setSelectedSession(transcriptionHistory[0]);
    }
  }, [transcriptionHistory, selectedSession, setSelectedSession]);

  // Optimisation : mémoriser le commercial en cours d'écoute
  const listeningCommercial = useMemo(() => {
    const currentListeningTo = audioStreaming.currentListeningTo || attemptedListeningTo;
    return commercials.find(c => c.id === currentListeningTo) || null;
  }, [commercials, audioStreaming.currentListeningTo, attemptedListeningTo]);

  // Optimisation : mémoriser la transcription actuelle
  const currentTranscription = useMemo(() => {
    if (!listeningCommercial || !transcriptions[listeningCommercial.id]) {
      return "En attente de transcription...";
    }
    return transcriptions[listeningCommercial.id];
  }, [listeningCommercial, transcriptions]);

  // Optimisation : mémoriser les callbacks pour éviter les re-renders
  const handleCloseListeningModal = useCallback(() => {
    handleStopListening();
    setShowListeningModal(false);
    setAttemptedListeningTo(null);
  }, [handleStopListening, setShowListeningModal, setAttemptedListeningTo]);

  const handleCloseMapModal = useCallback(() => {
    setShowMapModal(false);
  }, [setShowMapModal]);

  const handleCloseHistoryModal = useCallback(() => {
    setShowHistoryModal(false);
  }, [setShowHistoryModal]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement du suivi GPS...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative space-y-6">
      {/* Statistiques en haut */}
      <SuiviStats commercials={commercials} audioStreaming={audioStreaming} />

      {/* Tableau des commerciaux */}
      <SuiviTable
        commercials={commercials}
        audioStreaming={audioStreaming}
        onShowOnMap={handleShowOnMap}
        onShowHistory={handleShowHistory}
        onStartListening={handleStartListening}
      />
      
      {/* Modals */}
      <MapModal
        isOpen={showMapModal}
        onClose={handleCloseMapModal}
        commercial={selectedCommercial}
        zones={zones}
        commercials={commercials}
      />
      
      <ListeningModal
        isOpen={showListeningModal}
        onClose={handleCloseListeningModal}
        commercial={listeningCommercial}
        audioStreaming={audioStreaming}
        transcription={currentTranscription}
        onStopListening={handleStopListening}
      />
      
      <HistoryModal
        isOpen={showHistoryModal}
        onClose={handleCloseHistoryModal}
        commercial={selectedCommercialForHistory}
        transcriptionHistory={transcriptionHistory}
        loadingHistory={loadingHistory}
        selectedSession={selectedSession}
        onSessionSelect={setSelectedSession}
      />
    </div>
  );
};

export default SuiviPage;