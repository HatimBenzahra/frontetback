import { useEffect } from 'react';
import { useSuiviLogic } from './hooks/useSuiviLogic';
import { SuiviStats } from './components/SuiviStats';
import { SuiviTable } from './components/SuiviTable';
import { ListeningModal } from './components/ListeningModal';
import { HistoryModal } from './components/HistoryModal';
import { MapModal } from './components/MapModal';
import type { CommercialGPS, TranscriptionSession } from '@/types/types';

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
    setSelectedCommercial,
    setSelectedCommercialForHistory,
    setSelectedSession,
    setAttemptedListeningTo,
  } = useSuiviLogic();

  // Sélectionner automatiquement la première session quand l'historique change
  useEffect(() => {
    if (transcriptionHistory.length > 0 && !selectedSession) {
      setSelectedSession(transcriptionHistory[0]);
    }
  }, [transcriptionHistory, selectedSession, setSelectedSession]);

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

  const listeningCommercial = commercials.find(c => c.id === (audioStreaming.currentListeningTo || attemptedListeningTo)) || null;
  const currentTranscription = listeningCommercial && transcriptions[listeningCommercial.id] 
    ? transcriptions[listeningCommercial.id] 
    : "En attente de transcription...";

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
        onClose={() => setShowMapModal(false)}
        commercial={selectedCommercial}
        zones={zones}
        commercials={commercials}
      />
      
      <ListeningModal
        isOpen={showListeningModal}
        onClose={() => {
          handleStopListening();
          setShowListeningModal(false);
          setAttemptedListeningTo(null);
        }}
        commercial={listeningCommercial}
        audioStreaming={audioStreaming}
        transcription={currentTranscription}
        onStopListening={handleStopListening}
      />
      
      <HistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
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