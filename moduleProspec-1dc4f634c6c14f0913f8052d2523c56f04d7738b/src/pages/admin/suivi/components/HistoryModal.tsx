import { Modal } from '@/components/ui-admin/Modal';
import { Button } from '@/components/ui-admin/button';
import { Badge } from '@/components/ui-admin/badge';
import { History, Calendar, Clock, FileText, Building } from 'lucide-react';
import type { HistoryModalProps, TranscriptionSession } from '@/types/types';

const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const HistoryModal = ({ 
  isOpen, 
  onClose, 
  commercial, 
  transcriptionHistory, 
  loadingHistory, 
  selectedSession, 
  onSessionSelect 
}: HistoryModalProps) => {
  if (!isOpen || !commercial) {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      maxWidth="max-w-7xl"
    >
      <div className="flex h-[80vh]">
        {/* Section gauche - Liste des transcriptions */}
        <div className="w-1/3 bg-gradient-to-br from-blue-50 to-indigo-50 border-r border-gray-200 flex flex-col">
          {/* Header commercial */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
                  {commercial.avatarFallback}
                </div>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">{commercial.name}</h2>
                <p className="text-gray-600 text-sm">{commercial.equipe}</p>
                <div className="flex items-center gap-2 mt-2">
                  <History className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-600">
                    {transcriptionHistory.length} sessions
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Liste des sessions */}
          <div className="flex-1 overflow-y-auto">
            {loadingHistory ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Chargement...</p>
                </div>
              </div>
            ) : transcriptionHistory.length === 0 ? (
              <div className="text-center py-8 px-4">
                <History className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Aucune transcription</p>
              </div>
            ) : (
              <div className="p-4 space-y-2">
                {transcriptionHistory.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => onSessionSelect(session)}
                    className={`p-4 rounded-lg cursor-pointer transition-colors ${
                      selectedSession?.id === session.id
                        ? 'bg-blue-100 border-blue-200 shadow-sm'
                        : 'bg-white hover:bg-gray-50 border border-gray-200'
                    }`}
                  >
                    <div className="text-sm font-medium text-gray-800 mb-1">
                      {formatDate(session.start_time)}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Clock className="w-3 h-3" />
                      {formatDuration(session.duration_seconds)}
                    </div>
                    {session.building_name && (
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                        <Building className="w-3 h-3" />
                        <span className="truncate">{session.building_name}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="p-6 bg-white border-t border-gray-200">
            <Button
              variant="outline"
              onClick={onClose}
              className="w-full"
            >
              Fermer
            </Button>
          </div>
        </div>

        {/* Section droite - Contenu de la transcription */}
        <div className="w-2/3 bg-white flex flex-col">
          {selectedSession ? (
            <>
              {/* Header transcription */}
              <div className="p-6 border-b border-gray-200 bg-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <FileText className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-800">{formatDate(selectedSession.start_time)}</h3>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {formatDuration(selectedSession.duration_seconds)}
                        </div>
                        <div className="flex items-center gap-1">
                          <FileText className="w-4 h-4" />
                          {selectedSession.full_transcript.length} caractères
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Zone de transcription */}
              <div className="flex-1 p-6 overflow-hidden">
                <div className="h-full bg-gray-50 rounded-lg border border-gray-200 p-6 overflow-y-auto">
                  <div className="prose prose-lg max-w-none">
                    <div className="text-gray-800 leading-relaxed whitespace-pre-wrap font-medium text-base">
                      {selectedSession.full_transcript || "Aucune transcription disponible"}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : transcriptionHistory.length > 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-600 mb-2">Sélectionnez une transcription</h3>
                <p className="text-gray-500">Choisissez une session dans la liste de gauche</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <History className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-600 mb-2">Aucune transcription</h3>
                <p className="text-gray-500">Ce commercial n'a pas encore de sessions enregistrées</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}; 