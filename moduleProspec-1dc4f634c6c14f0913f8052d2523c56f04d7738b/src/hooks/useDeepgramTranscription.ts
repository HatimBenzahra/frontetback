import { useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { TranscriptionProcessor } from '../utils/transcriptionProcessor';

interface DeepgramTranscriptionHook {
  isConnected: boolean;
  transcription: string;
  error: string | null;
  startTranscription: (userId?: string, socket?: any) => Promise<void>;
  stopTranscription: () => Promise<TranscriptionSession | null>;
  clearTranscription: () => void;
  // Ajouter des options de configuration
  enableStructuring: boolean;
  setEnableStructuring: (enable: boolean) => void;
}

interface TranscriptionSession {
  id: string;
  commercial_id: string;
  commercial_name: string;
  start_time: string;
  end_time: string;
  full_transcript: string;
  duration_seconds: number;
  building_id?: string;
  building_name?: string;
}

export const useDeepgramTranscription = (): DeepgramTranscriptionHook => {
  const [isConnected, setIsConnected] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enableStructuring, setEnableStructuring] = useState(true);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);

  const websocketRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const userIdRef = useRef<string | null>(null);
  const isSocketOwner = useRef<boolean>(false); // Pour savoir si nous devons fermer le socket
  
  // Ajouter le processeur de transcription
  const transcriptionProcessor = useRef<TranscriptionProcessor>(new TranscriptionProcessor());

  const startTranscription = useCallback(async (userId?: string, socket?: any) => {
    try {
      console.log('🎙️ COMMERCIAL - Démarrage transcription avec:', { userId, socket: !!socket });
      
      // Stocker les références
      userIdRef.current = userId || null;
      socketRef.current = socket || null;

      // Créer une connexion socket séparée pour les transcriptions (serveur Node.js)
      // Utiliser le socket passé en paramètre ou créer un nouveau
      if (socket) {
        console.log('🎙️ TRANSCRIPTION - Utilisation socket existant passé en paramètre');
        socketRef.current = socket;
        isSocketOwner.current = false; // Nous ne possédons pas ce socket
      } else if (!socketRef.current) {
        const SERVER_HOST = import.meta.env.VITE_SERVER_HOST || window.location.hostname;
        const isDevelopment = SERVER_HOST === 'localhost' || SERVER_HOST === '127.0.0.1' || SERVER_HOST.startsWith('192.168.');
        
        // Use nginx proxy in production, direct port in development
        const socketUrl = isDevelopment 
          ? `https://${SERVER_HOST}:${import.meta.env.VITE_API_PORT || '3000'}`
          : `https://${SERVER_HOST}`;
        
        console.log('🎙️ COMMERCIAL - Création socket pour transcriptions:', socketUrl);
        socketRef.current = io(socketUrl, {
          secure: true,
          transports: ['polling', 'websocket'],
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 1000,
          timeout: 20000,
          forceNew: true,
          rejectUnauthorized: false,
        });

        socketRef.current.on('connect', () => {
          console.log('🎙️ COMMERCIAL - Socket transcriptions connecté');
          socketRef.current?.emit('joinRoom', 'transcriptions');
        });

        socketRef.current.on('disconnect', () => {
          console.log('🎙️ COMMERCIAL - Socket transcriptions déconnecté');
        });

        socketRef.current.on('connect_error', (error) => {
          console.error('🎙️ COMMERCIAL - Erreur connexion socket transcriptions:', error);
        });

        socketRef.current.on('error', (error) => {
          console.error('🎙️ COMMERCIAL - Erreur socket transcriptions:', error);
        });
        
        isSocketOwner.current = true; // Nous avons créé ce socket
      } else {
        console.log('🎙️ TRANSCRIPTION - Réutilisation socket existant');
      }

      // Enregistrer le temps de début de session - NOUVELLE session
      const sessionId = crypto.randomUUID();
      console.log('🆕 TRANSCRIPTION - Démarrage NOUVELLE session:', sessionId);
      console.log('🆕 TRANSCRIPTION - Transcription actuelle avant nettoyage:', transcription.length, 'caractères');
      
      setSessionStartTime(new Date());
      
      // S'assurer que nous partons avec une transcription vierge
      setTranscription('');
      transcriptionProcessor.current.clear();
      
      console.log('🆕 TRANSCRIPTION - Session initialisée, transcription remise à zéro');
      console.log('🆕 TRANSCRIPTION - Processeur segments:', transcriptionProcessor.current.getStats().segments);

      // Paramètres audio pour discours fluide
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
          channelCount: 1
        } 
      });
      
      streamRef.current = stream;
      setError(null);

      const deepgramApiKey = import.meta.env.VITE_DEEPGRAM_API_KEY;
      if (!deepgramApiKey) {
        throw new Error('Clé API Deepgram manquante');
      }

      console.log('🎙️ COMMERCIAL - Clé API Deepgram:', deepgramApiKey.substring(0, 10) + '...');
      console.log('🎙️ COMMERCIAL - Longueur de la clé:', deepgramApiKey.length);
      console.log('🎙️ COMMERCIAL - Vérification de la clé API...');

      // Vérifier le format de la clé (doit commencer par "dg_" dans le nouveau format)
      if (!deepgramApiKey.startsWith('dg_')) {
        // Ancien format hexadécimal détecté. On continue mais on log un avertissement.
        console.warn('⚠️ COMMERCIAL - Clé API Deepgram sans préfixe "dg_". Assurez-vous qu\'elle est toujours valide.');
      }
      // URL sans token - authentification via protocol
      let wsUrl = `wss://api.deepgram.com/v1/listen?language=fr&interim_results=true`;

      console.log('🎙️ COMMERCIAL - URL WebSocket Deepgram:', wsUrl);
      console.log('🎙️ COMMERCIAL - Clé API (10 premiers chars):', deepgramApiKey.substring(0, 10));
      console.log('🎙️ COMMERCIAL - Tentative de connexion WebSocket...');

      // Fonction fallback utilisant l'API REST
      const startRestModeTranscription = () => {
        console.log('🔄 Démarrage transcription mode REST...');
        setIsConnected(true);
        
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus',
          audioBitsPerSecond: 32000
        });
        
        mediaRecorderRef.current = mediaRecorder;
        
        mediaRecorder.ondataavailable = async (event) => {
          if (event.data.size > 0) {
            try {
              const formData = new FormData();
              formData.append('audio', event.data, 'audio.webm');
              
              const response = await fetch(`https://api.deepgram.com/v1/listen?language=fr`, {
                method: 'POST',
                headers: {
                  'Authorization': `Token ${deepgramApiKey}`,
                },
                body: formData
              });
              
              if (response.ok) {
                const result = await response.json();
                const transcript = result.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim();
                
                if (transcript && transcript.length > 2) {
                  setTranscription(prev => {
                    // Éviter les doublons exacts
                    if (prev.endsWith(transcript)) return prev;
                    
                    // Ajouter simplement
                    return prev + (prev.length > 0 ? ' ' : '') + transcript;
                  });
                  
                  // Envoyer au serveur Node.js
                  if (socketRef.current && userIdRef.current) {
                    socketRef.current.emit('transcription_update', {
                      commercial_id: userIdRef.current,
                      transcript: transcript,
                      is_final: true,
                      timestamp: new Date().toISOString()
                    });
                  }
                }
              }
            } catch (error) {
              console.error('❌ Erreur transcription REST:', error);
            }
          }
        };
        
        mediaRecorder.start(2000); // Chunks de 2 secondes pour meilleur équilibre
        return;
      };

      // Essayer d'abord WebSocket streaming
      try {
        websocketRef.current = new WebSocket(wsUrl, ['token', deepgramApiKey]);
        
        // Timeout pour détecter les échecs de connexion
        const connectionTimeout = setTimeout(() => {
          if (websocketRef.current?.readyState !== WebSocket.OPEN) {
            console.warn('⚠️ WebSocket timeout - Utilisation du mode REST fallback');
            websocketRef.current?.close();
            startRestModeTranscription();
          }
        }, 5000);

        websocketRef.current.addEventListener('open', () => {
          clearTimeout(connectionTimeout);
          console.log('✅ WebSocket streaming activé');
          console.log('🎙️ Connexion Deepgram établie');
          setIsConnected(true);
          
          // Configuration optimisée pour conversation continue
          const mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'audio/webm;codecs=opus',
            audioBitsPerSecond: 32000 // Qualité supérieure pour meilleure précision
          });
          
          mediaRecorderRef.current = mediaRecorder;
          
          mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0 && websocketRef.current?.readyState === WebSocket.OPEN) {
              websocketRef.current.send(event.data);
            }
          };
          
          mediaRecorder.start(250); // Chunks plus larges pour éviter fragmentation
        });

        websocketRef.current.addEventListener('error', () => {
          clearTimeout(connectionTimeout);
          console.warn('⚠️ WebSocket échoué - Basculement vers REST API');
          startRestModeTranscription();
        });

        websocketRef.current.onmessage = (event) => {
          const response = JSON.parse(event.data);
          
          if (response.channel?.alternatives?.[0]?.transcript) {
            const newTranscript = response.channel.alternatives[0].transcript.trim();
            
            // Ignorer les transcriptions vides ou trop courtes
            if (!newTranscript || newTranscript.length < 2) return;
            
            let finalTranscription: string;
            
            if (enableStructuring) {
              // Utiliser le processeur pour structurer intelligemment
              console.log('📝 TRANSCRIPTION - Ajout segment:', {
                text: newTranscript.substring(0, 30) + '...',
                isFinal: response.is_final,
                currentSegments: transcriptionProcessor.current.getStats().segments
              });
              
              finalTranscription = transcriptionProcessor.current.addSegment(
                newTranscript, 
                response.is_final
              );
              
              console.log('📝 TRANSCRIPTION - Après ajout:', {
                totalSegments: transcriptionProcessor.current.getStats().segments,
                transcriptionLength: finalTranscription.length
              });
            } else {
              // Mode texte brut - simple concaténation
              if (response.is_final) {
                setTranscription(prev => {
                  const cleanPrev = prev.replace(/\s*\[.*?\]\s*$/g, '');
                  return cleanPrev + (cleanPrev.length > 0 ? ' ' : '') + newTranscript;
                });
                finalTranscription = transcription + (transcription.length > 0 ? ' ' : '') + newTranscript;
              } else {
                // Transcription temporaire
                setTranscription(prev => {
                  const cleanPrev = prev.replace(/\s*\[.*?\]\s*$/g, '');
                  return cleanPrev + (cleanPrev.length > 0 ? ' ' : '') + '[' + newTranscript + ']';
                });
                finalTranscription = transcription + (transcription.length > 0 ? ' ' : '') + '[' + newTranscript + ']';
              }
            }
            
            // Mettre à jour l'état avec la transcription finale
            if (enableStructuring) {
              setTranscription(finalTranscription);
            }
            
            // Envoyer au serveur seulement les segments finaux
            if (response.is_final && socketRef.current && userIdRef.current) {
              console.log('📝 COMMERCIAL - Transcription finale:', newTranscript);
              
              // Envoyer le segment final ET la transcription complète
              socketRef.current.emit('transcription_update', {
                commercial_id: userIdRef.current,
                transcript: newTranscript,
                formatted_transcription: finalTranscription,
                is_final: true,
                timestamp: new Date().toISOString(),
                stats: enableStructuring ? transcriptionProcessor.current.getStats() : null
              });
            }
          }
        };

      websocketRef.current.onerror = (error) => {
        console.error('❌ Erreur Deepgram WebSocket:', error);
        console.error('❌ Détails de l\'erreur:', {
          readyState: websocketRef.current?.readyState,
          url: websocketRef.current?.url,
          protocol: websocketRef.current?.protocol
        });
        
        // Vérifier si c'est un problème d'authentification
        if (websocketRef.current?.readyState === WebSocket.CLOSED) {
          console.error('❌ Connexion fermée - Vérifiez votre clé API Deepgram');
          setError('Authentification Deepgram échouée - Vérifiez votre clé API');
        } else {
          setError('Erreur de connexion à Deepgram');
        }
        setIsConnected(false);
      };

      websocketRef.current.onclose = (event) => {
        console.log('🔌 Connexion Deepgram fermée');
        console.log('🔌 Code de fermeture:', event.code);
        console.log('🔌 Raison de fermeture:', event.reason);
        
        // Codes d'erreur spécifiques Deepgram
        if (event.code === 1002) {
          console.error('❌ Erreur protocole WebSocket');
          setError('Erreur de protocole - Vérifiez les paramètres de connexion');
        } else if (event.code === 1006) {
          console.error('❌ Connexion fermée anormalement');
          setError('Connexion fermée anormalement - Problème réseau ou authentification');
        } else if (event.code === 4001) {
          console.error('❌ Clé API invalide');
          setError('Clé API Deepgram invalide');
        } else if (event.code === 4002) {
          console.error('❌ Quota dépassé');
          setError('Quota Deepgram dépassé');
        }
        
        setIsConnected(false);
        };
      } catch (error) {
        console.warn('⚠️ WebSocket non supporté - Utilisation du mode REST');
        startRestModeTranscription();
      }

    } catch (err) {
      console.error('❌ Erreur démarrage transcription:', err);
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      setIsConnected(false);
    }
  }, []);

  const stopTranscription = useCallback(async (): Promise<TranscriptionSession | null> => {
    const endTime = new Date();
    
    // Capturer la transcription actuelle AVANT le nettoyage
    const currentTranscription = transcription;
    const currentSessionStartTime = sessionStartTime;
    
    console.log('🛑 TRANSCRIPTION - Arrêt session:', {
      hasStartTime: !!currentSessionStartTime,
      transcriptionLength: currentTranscription.length,
      userId: userIdRef.current
    });
    
    const sessionData: TranscriptionSession | null = currentSessionStartTime && userIdRef.current ? {
      id: crypto.randomUUID(),
      commercial_id: userIdRef.current,
      commercial_name: 'Commercial', // Sera rempli par l'appelant
      start_time: currentSessionStartTime.toISOString(),
      end_time: endTime.toISOString(),
      full_transcript: currentTranscription,
      duration_seconds: Math.floor((endTime.getTime() - currentSessionStartTime.getTime()) / 1000)
    } : null;
    
    if (sessionData) {
      console.log('📊 TRANSCRIPTION - Session créée:', {
        id: sessionData.id,
        duration: sessionData.duration_seconds,
        transcriptPreview: sessionData.full_transcript.substring(0, 50) + '...'
      });
    }

    // Arrêter l'enregistrement
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    // Fermer la connexion WebSocket Deepgram
    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
    }

    // Arrêter le stream audio
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Fermer le socket de transcriptions SEULEMENT si nous en sommes propriétaires
    if (socketRef.current && isSocketOwner.current) {
      console.log('🎙️ TRANSCRIPTION - Fermeture socket transcriptions (propriétaire)');
      socketRef.current.disconnect();
      socketRef.current = null;
      console.log('🎙️ TRANSCRIPTION - Socket transcriptions fermé et référence nettoyée');
    } else if (socketRef.current) {
      console.log('🎙️ TRANSCRIPTION - Conservation socket transcriptions (non propriétaire)');
      socketRef.current = null; // On retire juste la référence sans fermer
    }
    
    isSocketOwner.current = false;

    setIsConnected(false);
    setError(null);
    setSessionStartTime(null);
    
    // IMPORTANT: Réinitialiser complètement la transcription pour la prochaine session
    console.log('🧹 TRANSCRIPTION - Réinitialisation complète après arrêt');
    setTranscription('');
    transcriptionProcessor.current.clear();

    return sessionData;
  }, [transcription, sessionStartTime]); // Gardons les dépendances pour capturer l'état actuel

  const clearTranscription = useCallback(() => {
    console.log('🧹 TRANSCRIPTION - Nettoyage complet de la transcription');
    console.log('🧹 TRANSCRIPTION - Ancienne transcription longueur:', transcription.length);
    setTranscription('');
    transcriptionProcessor.current.clear();
    console.log('🧹 TRANSCRIPTION - Transcription nettoyée - prête pour nouvelle session');
  }, [transcription]);

  return {
    isConnected,
    transcription,
    error,
    startTranscription,
    stopTranscription,
    clearTranscription,
    enableStructuring,
    setEnableStructuring
  };
};