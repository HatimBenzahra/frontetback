import { useRef, useEffect } from 'react';
import { Modal } from '@/components/ui-admin/Modal';
import { Button } from '@/components/ui-admin/button';
import { Slider } from '@/components/ui-admin/slider';
import { Headphones, VolumeX, Volume2, FileText } from 'lucide-react';
import type { ListeningModalProps } from '@/types/types';

export const ListeningModal = ({ 
  isOpen, 
  onClose, 
  commercial, 
  audioStreaming, 
  transcription, 
  onStopListening 
}: ListeningModalProps) => {
  const transcriptionRef = useRef<HTMLDivElement>(null);

  // Auto-scroll vers le bas quand la transcription se met à jour
  useEffect(() => {
    if (transcriptionRef.current && isOpen) {
      transcriptionRef.current.scrollTop = transcriptionRef.current.scrollHeight;
    }
  }, [transcription, isOpen]);

  if (!isOpen || !commercial) {
    return null;
  }

  const currentTranscription = transcription || "En attente de transcription...";

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        onStopListening();
        onClose();
      }}
      title=""
      maxWidth="max-w-7xl"
    >
      <div className="flex h-[80vh]">
        {/* Section gauche - Contrôles d'écoute */}
        <div className="w-1/3 bg-gradient-to-br from-blue-50 to-indigo-50 border-r border-gray-200 flex flex-col">
          {/* Header commercial */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
                  {commercial.avatarFallback}
                </div>
                <div className={`absolute -top-2 -right-2 w-6 h-6 rounded-full border-4 border-white shadow-lg ${
                  commercial.isStreaming ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                }`}></div>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">{commercial.name}</h2>
                <p className="text-gray-600 text-sm">{commercial.equipe}</p>
                <div className="flex items-center gap-2 mt-2">
                  <div className={`w-2 h-2 rounded-full ${commercial.isStreaming ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                  <span className="text-sm font-medium">
                    {commercial.isStreaming ? 'En direct' : 'Hors ligne'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Contrôles audio */}
          <div className="p-6 border-b border-gray-200 bg-white">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Headphones className="w-5 h-5 text-blue-600" />
              Contrôles audio
            </h3>
            
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Volume</span>
                  <span className="text-sm font-bold text-blue-600">{Math.round(audioStreaming.audioVolume * 100)}%</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Connexion audio</span>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${audioStreaming.isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span className={`text-sm font-bold ${audioStreaming.isConnected ? 'text-green-600' : 'text-red-600'}`}>
                      {audioStreaming.isConnected ? 'Connecté' : 'Déconnecté'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <VolumeX className="h-4 w-4 text-gray-500" />
                  <Slider
                    value={[audioStreaming.audioVolume * 100]}
                    onValueChange={(value) => audioStreaming.setVolume(value[0] / 100)}
                    max={100}
                    min={0}
                    step={1}
                    className="flex-1 [&>span:first-child]:bg-gray-200 [&>span:first-child>span]:bg-blue-600 [&>span:last-child]:bg-blue-600"
                  />
                  <Volume2 className="h-4 w-4 text-gray-500" />
                </div>
              </div>

              {audioStreaming.error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-red-700 font-medium">Erreur audio détectée</span>
                </div>
              )}
            </div>
          </div>

          {/* Statistiques */}
          <div className="p-6 border-b border-gray-200 bg-white">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-green-600" />
              Statistiques
            </h3>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Caractères</span>
                <span className="font-semibold text-gray-800">{currentTranscription.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Mots</span>
                <span className="font-semibold text-gray-800">{currentTranscription.split(/\s+/).filter(word => word.length > 0).length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Dernière MAJ</span>
                <span className="font-semibold text-gray-800">{new Date().toLocaleTimeString('fr-FR')}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="p-6 bg-white flex-1 flex flex-col justify-end">
            <div className="space-y-3">
              <Button
                variant="outline"
                onClick={() => {
                  onStopListening();
                  onClose();
                }}
                className="w-full bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
              >
                Fermer
              </Button>
            </div>
          </div>
        </div>

        {/* Section droite - Transcription */}
        <div className="w-2/3 bg-white flex flex-col">
          {/* Header transcription */}
          <div className="p-6 border-b border-gray-200 bg-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800">Transcription en temps réel</h3>
                  <p className="text-sm text-gray-600">Suivi automatique de la conversation</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 rounded-full">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-blue-700">Live</span>
              </div>
            </div>
          </div>

          {/* Zone de transcription */}
          <div className="flex-1 p-6 overflow-hidden">
            <div ref={transcriptionRef} className="h-full bg-gray-50 rounded-lg border border-gray-200 p-6 overflow-y-auto">
              {currentTranscription === "En attente de transcription..." ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <FileText className="w-10 h-10 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-600 mb-2">En attente de transcription</h3>
                    <p className="text-gray-500">La transcription apparaîtra ici dès que le commercial parlera</p>
                  </div>
                </div>
              ) : (
                <div className="prose prose-lg max-w-none">
                  <div className="text-gray-800 leading-relaxed whitespace-pre-wrap font-medium text-base">
                    {currentTranscription}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}; 