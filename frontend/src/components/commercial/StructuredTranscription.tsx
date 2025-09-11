import React from 'react';

interface StructuredTranscriptionProps {
  transcription: string;
  isConnected: boolean;
  className?: string;
  enableStructuring?: boolean;
  onToggleStructuring?: () => void;
}

export const StructuredTranscription: React.FC<StructuredTranscriptionProps> = ({
  transcription,
  isConnected,
  className = '',
  enableStructuring = true,
  onToggleStructuring
}) => {
  // Diviser la transcription en paragraphes seulement si la structuration est activée
  const paragraphs = enableStructuring 
    ? transcription.split('\n\n').filter(p => p.trim())
    : [transcription];

  return (
    <div className={`transcription-container ${className}`}>
      <div className="transcription-header">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm font-medium">
              {isConnected ? 'Transcription en cours...' : 'Transcription arrêtée'}
            </span>
          </div>
          
          {onToggleStructuring && (
            <button
              onClick={onToggleStructuring}
              className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 transition-colors"
              title={enableStructuring ? 'Passer au mode brut' : 'Passer au mode structuré'}
            >
              {enableStructuring ? '📝 Structuré' : '📄 Brut'}
            </button>
          )}
        </div>
      </div>

      <div className="transcription-content bg-white rounded-lg border p-4 h-96 overflow-y-auto">
        {paragraphs.length === 0 || (paragraphs.length === 1 && !paragraphs[0]) ? (
          <div className="text-gray-500 text-center py-8">
            <div className="text-4xl mb-2">🎙️</div>
            <p>Parlez pour commencer la transcription...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {paragraphs.map((paragraph, index) => (
              <div key={index} className="paragraph">
                <p className="text-gray-800 leading-relaxed whitespace-pre-wrap break-words">
                  {paragraph}
                </p>
                {enableStructuring && index < paragraphs.length - 1 && (
                  <div className="text-xs text-gray-400 mt-2">
                    ──────────────────────
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {paragraphs.length > 0 && paragraphs[0] && (
        <div className="transcription-stats mt-2 text-xs text-gray-500">
          <span>{enableStructuring ? `${paragraphs.length} paragraphe${paragraphs.length > 1 ? 's' : ''}` : 'Mode brut'}</span>
          <span className="mx-2">•</span>
          <span>{transcription.length} caractères</span>
          <span className="mx-2">•</span>
          <span>{transcription.split(/\s+/).length} mots</span>
        </div>
      )}
    </div>
  );
}; 