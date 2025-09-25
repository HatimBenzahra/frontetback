import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/hooks/useSocket';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-admin/card';
import { Button } from '@/components/ui-admin/button';
import { Volume2, RefreshCw, Mic, CheckCircle2, Loader2, VolumeX } from 'lucide-react';
import { AdminPageSkeleton } from '@/components/ui-admin/AdminPageSkeleton';

type ActiveStream = { commercial_id: string; commercial_info?: any; socket_id: string };

const SuiviPage = () => {
  const { user } = useAuth();
  const socket = useSocket('audio-streaming');
  const [activeStreams, setActiveStreams] = useState<ActiveStream[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const [connectingIds, setConnectingIds] = useState<Set<string>>(new Set());
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());
  const [volumes, setVolumes] = useState<Record<string, number>>({});
  const [muted, setMuted] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState('');
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set());
  const restartingRef = useRef<Map<string, boolean>>(new Map());
  const gotTrackRef = useRef<Map<string, boolean>>(new Map());

  const canListen = useMemo(() => {
    return user?.role === 'directeur' || user?.role === 'admin' || user?.role === 'manager';
  }, [user]);

  // Maintain a fast lookup from commercial socket_id -> commercial_id
  const socketToCommercialRef = useRef<Map<string, string>>(new Map());

  const getIceServers = () => {
    const iceServers: RTCIceServer[] = [];
    const stun = import.meta.env.VITE_STUN_URL || 'stun:stun.l.google.com:19302';
    if (stun) iceServers.push({ urls: stun });
    const turnUrl = import.meta.env.VITE_TURN_URL as string | undefined;
    const turnUser = import.meta.env.VITE_TURN_USERNAME as string | undefined;
    const turnCred = import.meta.env.VITE_TURN_CREDENTIAL as string | undefined;
    if (turnUrl && turnUser && turnCred) {
      iceServers.push({ urls: turnUrl, username: turnUser, credential: turnCred });
    }
    return iceServers;
  };

  useEffect(() => {
    if (!socket) return;
    socket.emit('joinRoom', 'audio-streaming');
    socket.emit('request_streaming_status');

    const onStatus = (payload: { active_streams: ActiveStream[] }) => {
      setActiveStreams(payload.active_streams || []);
      socketToCommercialRef.current.clear();
      (payload.active_streams || []).forEach(s => socketToCommercialRef.current.set(s.socket_id, s.commercial_id));
    };
    const onStart = (payload: ActiveStream) => {
      setActiveStreams(prev => {
        const exists = prev.some(s => s.commercial_id === payload.commercial_id);
        return exists ? prev : [...prev, payload];
      });
      socketToCommercialRef.current.set(payload.socket_id, payload.commercial_id);
    };
    const onStop = (payload: { commercial_id: string }) => {
      setActiveStreams(prev => prev.filter(s => s.commercial_id !== payload.commercial_id));
      // Cleanup any ongoing PC and audio element
      const pc = pcsRef.current.get(payload.commercial_id);
      if (pc) pc.close();
      pcsRef.current.delete(payload.commercial_id);
      const el = audioElsRef.current.get(payload.commercial_id);
      if (el) el.remove();
      audioElsRef.current.delete(payload.commercial_id);
      // Remove any mapping entries
      for (const [sock, id] of Array.from(socketToCommercialRef.current.entries())) {
        if (id === payload.commercial_id) socketToCommercialRef.current.delete(sock);
      }
      setConnectedIds(prev => {
        const n = new Set(prev); n.delete(payload.commercial_id); return n;
      });
    };

    const onAnswer = async (payload: { from_socket_id: string; sdp: string; type: string }) => {
      const commercialId = socketToCommercialRef.current.get(payload.from_socket_id);
      if (!commercialId) return;
      const pc = pcsRef.current.get(commercialId);
      if (!pc) return;

      try {
        // Only accept answer if we're in the correct state (waiting for answer)
        if (pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription({ type: payload.type as RTCSdpType, sdp: payload.sdp });
          console.log(`WebRTC answer accepted for ${commercialId}, state now:`, pc.signalingState);
        } else {
          console.warn(`Ignoring duplicate answer for ${commercialId} in state:`, pc.signalingState);
          return; // Ignore duplicate answers
        }
      } catch (err) {
        console.error('Error setting remote description (admin):', err);
        // Clean up the connection if it's in a bad state
        if (pc.connectionState === 'failed') {
          pcsRef.current.delete(commercialId);
          setFailedIds(prev => new Set(prev).add(commercialId));
        }
      }
    };

    const onIce = async (payload: { from_socket_id: string; candidate: RTCIceCandidateInit | null }) => {
      const commercialId = socketToCommercialRef.current.get(payload.from_socket_id);
      if (!commercialId) return;
      const pc = pcsRef.current.get(commercialId);
      if (!pc || !payload.candidate) return;
      try {
        await pc.addIceCandidate(payload.candidate);
      } catch (err) {
        console.error('Error adding ICE candidate (admin):', err);
      }
    };

    socket.on('streaming_status_response', onStatus);
    socket.on('start_streaming', onStart);
    socket.on('stop_streaming', onStop);
    socket.on('suivi:webrtc_answer', onAnswer);
    socket.on('suivi:webrtc_ice_candidate', onIce);

    return () => {
      socket.off('streaming_status_response', onStatus);
      socket.off('start_streaming', onStart);
      socket.off('stop_streaming', onStop);
      socket.off('suivi:webrtc_answer', onAnswer);
      socket.off('suivi:webrtc_ice_candidate', onIce);
      socket.emit('leaveRoom', 'audio-streaming');
    };
  }, [socket]);

  const joinStream = async (stream: ActiveStream) => {
    if (!socket || !canListen) return;
    // Prevent duplicate connections
    if (pcsRef.current.get(stream.commercial_id)) return;
    setFailedIds(prev => { const n = new Set(prev); n.delete(stream.commercial_id); return n; });
    setConnectingIds(prev => new Set(prev).add(stream.commercial_id));

    // Create audio element per stream (use hidden element in DOM if needed)
    let audioEl = audioElsRef.current.get(stream.commercial_id);
    if (!audioEl) {
      audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      // @ts-ignore playsInline is supported in browsers for inline playback
      (audioEl as any).playsInline = true;
      audioEl.style.display = 'none';
      document.body.appendChild(audioEl);
      audioElsRef.current.set(stream.commercial_id, audioEl);
    }
    const pc = new RTCPeerConnection({ iceServers: getIceServers() });
    // Request to receive audio only
    try { pc.addTransceiver('audio', { direction: 'recvonly' }); } catch {}
    pc.ontrack = (e) => {
      audioEl!.srcObject = e.streams[0];
      // Attempt to play explicitly (Safari/iOS)
      const p = (audioEl as HTMLMediaElement).play?.();
      if (p && typeof p.then === 'function') p.catch(() => {});
      setConnectedIds(prev => new Set(prev).add(stream.commercial_id));
      // Clear connecting state as soon as media arrives
      setConnectingIds(prev => { const n = new Set(prev); n.delete(stream.commercial_id); return n; });
      // Clear failed state if any
      setFailedIds(prev => { const n = new Set(prev); n.delete(stream.commercial_id); return n; });
      gotTrackRef.current.set(stream.commercial_id, true);
    };
    pc.onicecandidate = (event) => {
      socket.emit('suivi:webrtc_ice_candidate', {
        to_socket_id: stream.socket_id,
        candidate: event.candidate || null,
      });
    };
    pc.onconnectionstatechange = async () => {
      console.log(`WebRTC connection state for ${stream.commercial_id}:`, pc.connectionState);
      
      if (pc.connectionState === 'connected') {
        // Ensure connecting is cleared when fully connected
        setConnectingIds(prev => { const n = new Set(prev); n.delete(stream.commercial_id); return n; });
        setFailedIds(prev => { const n = new Set(prev); n.delete(stream.commercial_id); return n; });
        return;
      }
      
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        // Try ICE restart once
        if (!restartingRef.current.get(stream.commercial_id) && 'restartIce' in pc) {
          restartingRef.current.set(stream.commercial_id, true);
          try { await (pc as any).restartIce?.(); } catch {}
          // Give it a moment to recover
          setTimeout(() => {
            if (pc.connectionState !== 'connected' && !gotTrackRef.current.get(stream.commercial_id)) {
              restartingRef.current.set(stream.commercial_id, false);
              // Mark as failed
              pcsRef.current.delete(stream.commercial_id);
              setConnectedIds(prev => { const n = new Set(prev); n.delete(stream.commercial_id); return n; });
              setConnectingIds(prev => { const n = new Set(prev); n.delete(stream.commercial_id); return n; });
              setFailedIds(prev => new Set(prev).add(stream.commercial_id));
            }
          }, 3000);
          return;
        }
        if (!gotTrackRef.current.get(stream.commercial_id)) {
          pcsRef.current.delete(stream.commercial_id);
          setConnectingIds(prev => { const n = new Set(prev); n.delete(stream.commercial_id); return n; });
          setConnectedIds(prev => { const n = new Set(prev); n.delete(stream.commercial_id); return n; });
          setFailedIds(prev => new Set(prev).add(stream.commercial_id));
        }
      }
    };
    pcsRef.current.set(stream.commercial_id, pc);
    const offer = await pc.createOffer({ offerToReceiveAudio: true });
    await pc.setLocalDescription(offer);
    socket.emit('suivi:webrtc_offer', {
      to_socket_id: stream.socket_id,
      sdp: offer.sdp,
      type: offer.type,
    });
    // Join timeout: fail after 10s if no ontrack fired
    const timeout = window.setTimeout(() => {
      if (!gotTrackRef.current.get(stream.commercial_id)) {
        try { pc.close(); } catch {}
        pcsRef.current.delete(stream.commercial_id);
        setConnectingIds(prev => { const n = new Set(prev); n.delete(stream.commercial_id); return n; });
        setFailedIds(prev => new Set(prev).add(stream.commercial_id));
      }
    }, 10000);
    // Clear connecting state a bit later to avoid flicker
    setTimeout(() => {
      setConnectingIds(prev => { const n = new Set(prev); n.delete(stream.commercial_id); return n; });
      window.clearTimeout(timeout);
    }, 12000);
  };

  const leaveStream = (commercialId: string) => {
    const pc = pcsRef.current.get(commercialId);
    if (pc) {
      try { pc.close(); } catch {}
      pcsRef.current.delete(commercialId);
    }
    const el = audioElsRef.current.get(commercialId);
    if (el) {
      try { el.pause(); } catch {}
      try { el.remove(); } catch {}
      audioElsRef.current.delete(commercialId);
    }
    // Notify commercial so it can close the targeted peer connection
    const s = activeStreams.find(x => x.commercial_id === commercialId);
    if (socket && s) {
      socket.emit('suivi:leave', { to_socket_id: s.socket_id });
    }
    setConnectedIds(prev => { const n = new Set(prev); n.delete(commercialId); return n; });
    setConnectingIds(prev => { const n = new Set(prev); n.delete(commercialId); return n; });
  };

  const leaveAll = () => {
    for (const id of Array.from(pcsRef.current.keys())) {
      leaveStream(id);
    }
  };

  const setVolume = (commercialId: string, value: number) => {
    const el = audioElsRef.current.get(commercialId);
    if (el) el.volume = value;
    setVolumes(prev => ({ ...prev, [commercialId]: value }));
  };

  const toggleMute = (commercialId: string) => {
    const el = audioElsRef.current.get(commercialId);
    if (!el) return;
    const next = !el.muted;
    el.muted = next;
    setMuted(prev => ({ ...prev, [commercialId]: next }));
  };

  useEffect(() => {
    // Simuler un délai d'initialisation pour la connexion WebSocket et permissions
    const timer = setTimeout(() => {
      setIsInitializing(false);
    }, 1500);

    return () => {
      clearTimeout(timer);
      leaveAll();
    };
  }, []);

  const filteredStreams = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activeStreams;
    return activeStreams.filter(s => (s.commercial_info?.name || s.commercial_id).toLowerCase().includes(q));
  }, [activeStreams, query]);

  if (isInitializing) {
    return <AdminPageSkeleton hasHeader hasCards cardsCount={3} className="p-6" />;
  }

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Suivi en direct des commerciaux</CardTitle>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Rechercher…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              <Button
                variant="outline"
                size="sm"
                className="border-gray-300 text-slate-800 bg-white hover:bg-gray-50"
                onClick={() => socket?.emit('request_streaming_status')}
              >
                <RefreshCw className="h-4 w-4 mr-2" /> Rafraîchir
              </Button>
              <Button
                size="sm"
                className="bg-red-600 text-white hover:bg-red-700 border border-red-600"
                onClick={leaveAll}
              >
                Arrêter tout
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!canListen && (
            <div className="text-sm text-red-600">Votre rôle ne permet pas d'écouter les commerciaux.</div>
          )}
          {filteredStreams.length === 0 ? (
            <div className="text-gray-500">Aucun commercial n'a activé son micro.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredStreams.map((s) => {
                const connecting = connectingIds.has(s.commercial_id);
                const connected = connectedIds.has(s.commercial_id);
                const failed = failedIds.has(s.commercial_id);
                return (
                  <div key={s.commercial_id} className="flex items-center justify-between border rounded-lg p-3 bg-white overflow-hidden">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: failed ? '#EF4444' : connected ? '#10B981' : connecting ? '#F59E0B' : '#3B82F6' }}
                        aria-hidden
                      />
                      <div className="text-sm min-w-0">
                        <div className="font-semibold text-slate-800 truncate max-w-[180px]" title={s.commercial_info?.name || s.commercial_id}>
                          {s.commercial_info?.name || s.commercial_id}
                        </div>
                        <div className="mt-1">
                          {failed && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-800 border border-red-200">
                              Échec
                            </span>
                          )}
                          {!connected && !connecting && !failed && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                              <Mic className="h-3.5 w-3.5" /> Audio actif
                            </span>
                          )}
            {connecting && !connected && !failed && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Connexion…
              </span>
            )}
            {connected && !failed && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                <CheckCircle2 className="h-3.5 w-3.5" /> En écoute
              </span>
            )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end max-w-[55%]">
                      {connected && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleMute(s.commercial_id)}
                            className="p-2 rounded-md border hover:bg-gray-50"
                            aria-label={muted[s.commercial_id] ? 'Activer le son' : 'Couper le son'}
                            title={muted[s.commercial_id] ? 'Activer le son' : 'Couper le son'}
                          >
                            {muted[s.commercial_id] ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                          </button>
                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={volumes[s.commercial_id] ?? 1}
                            onChange={(e) => setVolume(s.commercial_id, parseFloat(e.target.value))}
                            className="w-28 md:w-32"
                          />
                        </div>
                      )}
                      {!connected ? (
                        <Button
                          onClick={() => joinStream(s)}
                          disabled={!canListen || connecting}
                          className={failed ? 'bg-red-600 text-white hover:bg-red-700' : (connecting ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-blue-600 text-white hover:bg-blue-700')}
                        >
                          {failed ? 'Réessayer' : (connecting ? 'Connexion…' : 'Rejoindre')}
                        </Button>
                      ) : (
                        <Button
                          variant="destructive"
                          onClick={() => leaveStream(s.commercial_id)}
                          className="bg-red-600 hover:bg-red-700 text-white"
                        >
                          Arrêter
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SuiviPage;
