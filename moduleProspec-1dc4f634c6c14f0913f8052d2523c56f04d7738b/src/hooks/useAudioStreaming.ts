import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface AudioStreamingConfig {
  serverUrl: string;
  userId: string;
  userRole: 'admin' | 'commercial';
  userInfo: any;
}

interface CommercialStreamInfo {
  commercial_id: string;
  commercial_info: any;
  is_streaming: boolean;
  listeners_count: number;
}

interface AudioStreamingHook {
  // État général
  isConnected: boolean;
  isListening: boolean;
  isStreaming: boolean;
  error: string | null;
  
  // Pour les admins
  availableStreams: CommercialStreamInfo[];
  currentListeningTo: string | null;
  audioVolume: number;
  
  // Actions pour les admins
  startListening: (commercialId: string) => Promise<void>;
  stopListening: () => Promise<void>;
  setVolume: (volume: number) => void;
  
  // Actions pour les commerciaux
  startStreaming: () => Promise<void>;
  stopStreaming: () => Promise<void>;
  
  // Actions communes
  connect: () => Promise<void>;
  disconnect: () => void;
}

export const useAudioStreaming = (config: AudioStreamingConfig): AudioStreamingHook => {
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableStreams, setAvailableStreams] = useState<CommercialStreamInfo[]>([]);
  const [currentListeningTo, setCurrentListeningTo] = useState<string | null>(null);
  const [audioVolume, setAudioVolume] = useState(0.8);

  const socketRef = useRef<Socket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  // Initialiser l'élément audio pour la lecture
  useEffect(() => {
    if (config.userRole === 'admin') {
      console.log('🔊 ADMIN - Initialisation de l\'élément audio');
      remoteAudioRef.current = new Audio();
      remoteAudioRef.current.volume = audioVolume;
      remoteAudioRef.current.autoplay = true;
      remoteAudioRef.current.muted = false; // S'assurer que l'audio n'est pas muet
      
      // Logs pour l'élément audio global
      remoteAudioRef.current.onloadstart = () => {
        console.log('🔊 ADMIN - Début du chargement audio');
      };
      
      remoteAudioRef.current.oncanplay = () => {
        console.log('🔊 ADMIN - Audio prêt à être lu');
      };
      
      remoteAudioRef.current.onended = () => {
        console.log('🔊 ADMIN - Audio terminé');
      };
      
      remoteAudioRef.current.onvolumechange = () => {
        console.log('🔊 ADMIN - Volume changé automatiquement:', remoteAudioRef.current?.volume);
      };

      remoteAudioRef.current.onerror = (e) => {
        console.error('❌ ADMIN - Erreur audio globale:', e);
        setError('Erreur de lecture audio');
      };

      remoteAudioRef.current.onstalled = () => {
        console.warn('⚠️ ADMIN - Audio en attente de données');
      };

      remoteAudioRef.current.onwaiting = () => {
        console.warn('⏳ ADMIN - Audio en attente');
      };
      
      console.log('✅ ADMIN - Élément audio initialisé avec volume:', audioVolume);
    }
  }, [config.userRole]); // Retirer audioVolume de la dépendance pour éviter les re-créations

  // Effet séparé pour mettre à jour le volume
  useEffect(() => {
    if (config.userRole === 'admin' && remoteAudioRef.current) {
      console.log('🔊 ADMIN - Mise à jour du volume:', audioVolume);
      remoteAudioRef.current.volume = audioVolume;
    }
  }, [audioVolume, config.userRole]);

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('webrtc_ice_candidate', {
          candidate: event.candidate
        });
      }
    };

    if (config.userRole === 'admin') {
      pc.ontrack = (event) => {
        console.log('🎵 ADMIN - Piste audio reçue:', event);
        console.log('🎵 ADMIN - Streams disponibles:', event.streams);
        console.log('🎵 ADMIN - Première stream:', event.streams[0]);
        console.log('🎵 ADMIN - Tracks dans la stream:', event.streams[0]?.getTracks());
        
        if (remoteAudioRef.current && event.streams[0]) {
          console.log('🎵 ADMIN - Configuration de l\'élément audio...');
          remoteAudioRef.current.srcObject = event.streams[0];
          
          // Ajouter des événements pour traquer la lecture
          remoteAudioRef.current.onloadedmetadata = () => {
            console.log('✅ ADMIN - Métadonnées audio chargées');
          };
          
          remoteAudioRef.current.onplaying = () => {
            console.log('✅ ADMIN - AUDIO EN COURS DE LECTURE! 🔊');
          };
          
          remoteAudioRef.current.onpause = () => {
            console.log('⏸️ ADMIN - Audio en pause');
          };
          
          remoteAudioRef.current.onerror = (e) => {
            console.error('❌ ADMIN - Erreur audio:', e);
          };
          
          remoteAudioRef.current.onvolumechange = () => {
            console.log('🔊 ADMIN - Volume changé:', remoteAudioRef.current?.volume);
          };
          
          console.log('🎵 ADMIN - Tentative de lecture audio...');
          remoteAudioRef.current.play()
            .then(() => {
              console.log('✅ ADMIN - Audio démarré avec succès! 🎉');
            })
            .catch(e => {
              console.error('❌ ADMIN - Erreur lecture audio:', e);
              // Essayer de forcer la lecture avec interaction utilisateur
              console.log('🎵 ADMIN - Tentative de lecture forcée...');
            });
        } else {
          console.error('❌ ADMIN - Élément audio ou stream manquant');
        }
      };
    }

    return pc;
  }, [config.userRole]);

  const connect = useCallback(async () => {
    console.log('🔌 AUDIO STREAMING - Connect appelé');
    console.log('🔌 AUDIO STREAMING - Server URL:', config.serverUrl);
    console.log('🔌 AUDIO STREAMING - User role:', config.userRole);
    console.log('🔌 AUDIO STREAMING - Socket existant connecté:', socketRef.current?.connected);
    
    try {
      if (socketRef.current?.connected) {
        console.log('🔌 AUDIO STREAMING - Déjà connecté, retour');
        return;
      }

      setError(null);
      
      console.log('🔌 AUDIO STREAMING - Création de la connexion socket...');
      
      // Configuration Socket.IO avec le Manager pour le namespace
      const serverBaseUrl = config.serverUrl.replace('/audio-streaming', '');
      const namespace = '/audio-streaming';
      
      console.log('🔌 AUDIO STREAMING - Server base URL:', serverBaseUrl);
      console.log('🔌 AUDIO STREAMING - Namespace:', namespace);
      console.log('🔌 AUDIO STREAMING - Connexion vers:', `${serverBaseUrl}${namespace}`);
      
      // Utiliser la syntaxe correcte pour Socket.IO v4
      const socket = io(`${serverBaseUrl}${namespace}`, {
        transports: ['polling', 'websocket'],
        upgrade: true,
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        timeout: 20000,
        autoConnect: true,
        withCredentials: true // Important pour CORS
      });

      socketRef.current = socket;

      // Enregistrer l'utilisateur dès la connexion
      socket.on('connect', () => {
        console.log('✅ Connecté au serveur de streaming audio');
        console.log('🔌 Socket ID:', socket.id);
        console.log('🔌 Socket connected:', socket.connected);
        
        // Enregistrer l'utilisateur avec son rôle
        socket.emit('register_user', {
          role: config.userRole,
          user_info: { ...config.userInfo, id: config.userId }
        });
        
        setIsConnected(true);
        setError(null);
      });

      socket.on('user_registered', (data) => {
        console.log('✅ Utilisateur enregistré:', data);
      });

      socket.on('disconnect', () => {
        console.log('❌ Déconnecté du serveur de streaming audio');
        setIsConnected(false);
        setIsListening(false);
        setIsStreaming(false);
      });

      socket.on('error', (data) => {
        console.error('❌ Erreur serveur:', data.message);
        setError(data.message);
      });

      socket.on('connect_error', (error) => {
        console.error('❌ Erreur de connexion socket:', error);
        console.error('❌ Erreur details:', error);
        setError(`Erreur de connexion: ${error.message}`);
      });

      // Événements spécifiques aux admins
      if (config.userRole === 'admin') {
        socket.on('listening_started', (data) => {
          console.log('🎧 Écoute démarrée:', data);
          setIsListening(true);
          setCurrentListeningTo(data.commercial_id);
        });

        socket.on('listening_stopped', (data) => {
          console.log('🔇 Écoute arrêtée:', data);
          setIsListening(false);
          setCurrentListeningTo(null);
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = null;
          }
        });

        // Événements WebRTC pour les admins
        socket.on('webrtc_offer', async (data) => {
          console.log('📞 ADMIN - Offre WebRTC reçue:', data);
          try {
            if (peerConnectionRef.current) {
              await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.offer));
              const answer = await peerConnectionRef.current.createAnswer();
              await peerConnectionRef.current.setLocalDescription(answer);
              
              socket.emit('webrtc_answer', {
                answer: answer,
                commercial_id: data.commercial_id
              });
              console.log('✅ ADMIN - Réponse WebRTC envoyée');
            }
          } catch (error) {
            console.error('❌ ADMIN - Erreur WebRTC:', error);
          }
        });

        socket.on('webrtc_ice_candidate', (data) => {
          console.log('🧊 ADMIN - ICE candidate reçu:', data);
          if (peerConnectionRef.current && data.candidate) {
            peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate))
              .catch(error => console.error('❌ ADMIN - Erreur ajout ICE candidate:', error));
          }
        });

        socket.on('commercial_stream_available', (data) => {
          console.log('📻 Stream commercial disponible:', data);
          setAvailableStreams(prev => {
            const exists = prev.find(s => s.commercial_id === data.commercial_id);
            if (exists) {
              return prev.map(s => 
                s.commercial_id === data.commercial_id 
                  ? { ...s, is_streaming: true, commercial_info: data.commercial_info }
                  : s
              );
            }
            return [...prev, {
              commercial_id: data.commercial_id,
              commercial_info: data.commercial_info,
              is_streaming: true,
              listeners_count: 0
            }];
          });
        });

        socket.on('available_streams', (streams) => {
          console.log('📻 Liste des streams disponibles:', streams);
          setAvailableStreams(streams || []);
        });

        socket.on('commercial_stream_ended', (data) => {
          console.log('📻 Stream commercial terminé:', data);
          setAvailableStreams(prev =>
            prev.map(s =>
              s.commercial_id === data.commercial_id
                ? { ...s, is_streaming: false }
                : s
            )
          );
          
          if (currentListeningTo === data.commercial_id) {
            setIsListening(false);
            setCurrentListeningTo(null);
            if (remoteAudioRef.current) {
              remoteAudioRef.current.srcObject = null;
            }
          }
        });

        socket.on('webrtc_offer_from_commercial', async (data) => {
          console.log('📞 ADMIN - Offre WebRTC reçue du commercial:', data.commercial_id);
          console.log('📞 ADMIN - SDP de l\'offre:', data.sdp);
          
          try {
            const pc = createPeerConnection();
            peerConnectionRef.current = pc;

            // Gestionnaire ICE pour l'admin
            pc.onicecandidate = (event) => {
              if (event.candidate) {
                console.log('🧊 ADMIN - Envoi candidat ICE:', event.candidate);
                socket.emit('webrtc_ice_candidate_from_admin', {
                  commercial_id: data.commercial_id,
                  candidate: event.candidate
                });
              }
            };

            // Gestionnaire de changement d'état de connexion
            pc.onconnectionstatechange = () => {
              console.log('🔗 ADMIN - État de connexion WebRTC:', pc.connectionState);
            };

            pc.oniceconnectionstatechange = () => {
              console.log('🧊 ADMIN - État de connexion ICE:', pc.iceConnectionState);
            };

            console.log('📞 ADMIN - Configuration de la description distante...');
            await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
            
            console.log('📞 ADMIN - Création de la réponse...');
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            console.log('📞 ADMIN - Envoi de la réponse au serveur...');
            socket.emit('webrtc_answer_from_admin', {
              commercial_id: data.commercial_id,
              sdp: {
                sdp: pc.localDescription!.sdp,
                type: pc.localDescription!.type
              }
            });

            console.log('✅ ADMIN - Réponse WebRTC envoyée au serveur');
          } catch (error) {
            console.error('❌ ADMIN - Erreur traitement offre WebRTC:', error);
            setError('Erreur lors de l\'établissement de la connexion audio');
          }
        });

        socket.on('webrtc_ice_candidate_to_admin', async (data) => {
          console.log('🧊 Candidat ICE reçu du serveur:', data);
          try {
            if (peerConnectionRef.current && data.candidate) {
              await peerConnectionRef.current.addIceCandidate(data.candidate);
              console.log('✅ Candidat ICE ajouté');
            }
          } catch (error) {
            console.error('Erreur ajout candidat ICE:', error);
          }
        });
      }

      // Événements spécifiques aux commerciaux
      if (config.userRole === 'commercial') {
        socket.on('streaming_started', (data) => {
          console.log('📡 Streaming démarré:', data);
          setIsStreaming(true);
        });

        socket.on('webrtc_answer', async (data) => {
          console.log('📞 Réponse WebRTC reçue:', data);
          try {
            if (peerConnectionRef.current && data.sdp) {
              await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
            }
          } catch (error) {
            console.error('Erreur traitement réponse WebRTC:', error);
            setError('Erreur lors de l\'établissement de la connexion audio');
          }
        });
      }

    } catch (error) {
      console.error('Erreur connexion serveur streaming:', error);
      setError('Impossible de se connecter au serveur de streaming');
    }
  }, [config.serverUrl, config.userRole, createPeerConnection, currentListeningTo]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }

    setIsConnected(false);
    setIsListening(false);
    setIsStreaming(false);
    setCurrentListeningTo(null);
  }, []);

  // Actions pour les admins
  const startListening = useCallback(async (commercialId: string) => {
    if (!socketRef.current || config.userRole !== 'admin') {
      setError('Connexion non disponible ou rôle incorrect');
      return;
    }

    try {
      console.log('🎧 Démarrage de l\'écoute pour le commercial:', commercialId);
      
      // S'inscrire comme listener
      socketRef.current.emit('join_commercial_stream', {
        commercial_id: commercialId,
        admin_info: config.userInfo
      });

      // Créer une nouvelle connexion WebRTC pour recevoir l'audio
      const pc = createPeerConnection();
      peerConnectionRef.current = pc;

      console.log('✅ Prêt à recevoir l\'audio du commercial', commercialId);
    } catch (error) {
      console.error('Erreur démarrage écoute:', error);
      setError('Impossible de démarrer l\'écoute');
    }
  }, [config.userRole, config.userInfo, createPeerConnection]);

  const stopListening = useCallback(async () => {
    if (!socketRef.current || !currentListeningTo) {
      return;
    }

    try {
      socketRef.current.emit('leave_commercial_stream', {
        commercial_id: currentListeningTo
      });

      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
    } catch (error) {
      console.error('Erreur arrêt écoute:', error);
      setError('Impossible d\'arrêter l\'écoute');
    }
  }, [currentListeningTo]);

  const setVolume = useCallback((volume: number) => {
    console.log('🔊 ADMIN - setVolume appelé avec:', volume);
    console.log('🔊 ADMIN - remoteAudioRef existe:', !!remoteAudioRef.current);
    
    setAudioVolume(volume);
    
    if (remoteAudioRef.current) {
      console.log('🔊 ADMIN - Volume avant changement:', remoteAudioRef.current.volume);
      remoteAudioRef.current.volume = volume;
      console.log('🔊 ADMIN - Volume après changement:', remoteAudioRef.current.volume);
    } else {
      console.log('❌ ADMIN - remoteAudioRef.current n\'existe pas, impossible de changer le volume');
    }
  }, []);

  // Actions pour les commerciaux
  const startStreaming = useCallback(async () => {
    console.log('🎤 COMMERCIAL - startStreaming appelé!');
    console.log('🎤 COMMERCIAL - Socket connecté:', !!socketRef.current);
    console.log('🎤 COMMERCIAL - Role utilisateur:', config.userRole);
    
    if (!socketRef.current || config.userRole !== 'commercial') {
      console.log('❌ COMMERCIAL - Connexion non disponible ou rôle incorrect');
      console.log('❌ COMMERCIAL - Socket:', !!socketRef.current, 'Role:', config.userRole);
      setError('Connexion non disponible ou rôle incorrect');
      return;
    }

    try {
      console.log('🎤 COMMERCIAL - Démarrage du streaming audio...');
      
      // Demander l'accès au microphone
      console.log('🎤 COMMERCIAL - Demande d\'accès au microphone...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1
        }
      });

      console.log('✅ COMMERCIAL - Microphone accessible, stream:', stream);
      console.log('🎤 COMMERCIAL - Pistes audio:', stream.getAudioTracks());
      
      localStreamRef.current = stream;

      // Notifier le début du streaming AVANT WebRTC pour que les admins soient prêts
      console.log('📡 COMMERCIAL - Notification du début de streaming...');
      socketRef.current.emit('start_streaming', {
        commercial_id: config.userId,
        commercial_info: config.userInfo
      });

      // Créer une connexion WebRTC
      console.log('🔗 COMMERCIAL - Création de la connexion WebRTC...');
      const pc = createPeerConnection();
      peerConnectionRef.current = pc;

      // Ajouter la piste audio
      stream.getAudioTracks().forEach(track => {
        console.log('🎵 COMMERCIAL - Ajout de la piste audio:', track);
        pc.addTrack(track, stream);
      });

      // Créer une offre
      console.log('📞 COMMERCIAL - Création de l\'offre WebRTC...');
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Envoyer l'offre au serveur
      console.log('📞 COMMERCIAL - Envoi de l\'offre au serveur...');
      socketRef.current.emit('webrtc_offer', {
        sdp: {
          sdp: pc.localDescription!.sdp,
          type: pc.localDescription!.type
        }
      });

      console.log('✅ COMMERCIAL - Streaming démarré avec succès!');

    } catch (error) {
      console.error('❌ COMMERCIAL - Erreur démarrage streaming:', error);
      setError('Impossible de démarrer le streaming audio');
    }
  }, [config.userRole, config.userId, config.userInfo, createPeerConnection]);

  const stopStreaming = useCallback(async () => {
    if (!socketRef.current) {
      return;
    }

    try {
      socketRef.current.emit('stop_streaming', {
        commercial_id: config.userId
      });

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }

      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      setIsStreaming(false);
    } catch (error) {
      console.error('Erreur arrêt streaming:', error);
      setError('Impossible d\'arrêter le streaming');
    }
  }, [config.userId]);

  // Nettoyage à la déconnexion
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    isListening,
    isStreaming,
    error,
    availableStreams,
    currentListeningTo,
    audioVolume,
    startListening,
    stopListening,
    setVolume,
    startStreaming,
    stopStreaming,
    connect,
    disconnect
  };
};