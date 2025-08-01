#!/usr/bin/env python3
"""
Serveur de streaming audio WebRTC pour le système d'écoute commercial/admin
Utilise aiortc pour WebRTC et socketio pour la signalisation
"""

import asyncio
import json
import logging
import uuid
import os
from typing import Dict, Set
import aiohttp
from aiohttp import web, WSMsgType
import socketio
from aiortc import RTCPeerConnection, RTCSessionDescription, MediaStreamTrack
from aiortc.contrib.media import MediaRelay
import ssl
from dotenv import load_dotenv

# Charger les variables d'environnement
load_dotenv()

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AudioStreamingServer:
    def __init__(self):
        # Récupérer l'adresse du client depuis les variables d'environnement
        client_host = os.getenv('CLIENT_HOST', '192.168.1.116')
        
        self.sio = socketio.AsyncServer(
            cors_allowed_origins=[
                "http://localhost:5173",
                "https://localhost:5173", 
                "http://127.0.0.1:5173",
                "https://127.0.0.1:5173",
                f"http://{client_host}:5173",
                f"https://{client_host}:5173"
            ],
            logger=True,
            engineio_logger=True
        )
        self.app = web.Application()
        self.sio.attach(self.app)
        
        # Ajouter les middlewares CORS pour les requêtes HTTP
        self.setup_cors_middleware()
        
        # Stockage des connexions
        self.commercial_connections: Dict[str, RTCPeerConnection] = {}
        self.admin_listeners: Dict[str, Set[str]] = {}  # commercial_id -> set of admin_session_ids
        self.session_to_user: Dict[str, dict] = {}  # session_id -> user_info
        self.media_relay = MediaRelay()
        self.commercial_audio_tracks: Dict[str, any] = {}  # commercial_id -> audio_track
        self.admin_connections: Dict[str, RTCPeerConnection] = {}  # admin_session_id -> RTCPeerConnection
        
        # Gestionnaires d'événements Socket.IO
        self.sio.on('connect', self.on_connect)
        self.sio.on('disconnect', self.on_disconnect)
        self.sio.on('join_commercial_stream', self.on_join_commercial_stream)
        self.sio.on('leave_commercial_stream', self.on_leave_commercial_stream)
        self.sio.on('start_streaming', self.on_start_streaming)
        self.sio.on('stop_streaming', self.on_stop_streaming)
        self.sio.on('webrtc_offer', self.on_webrtc_offer)
        self.sio.on('webrtc_answer', self.on_webrtc_answer)
        self.sio.on('webrtc_answer_from_admin', self.on_webrtc_answer_from_admin)
        self.sio.on('webrtc_ice_candidate', self.on_webrtc_ice_candidate)
        self.sio.on('webrtc_ice_candidate_from_admin', self.on_webrtc_ice_candidate_from_admin)

    def setup_cors_middleware(self):
        """Configure CORS middleware pour les requêtes HTTP"""
        @web.middleware
        async def cors_handler(request, handler):
            # Headers CORS pour toutes les réponses
            response = await handler(request)
            
            # Obtenir l'origine de la requête
            origin = request.headers.get('Origin')
            client_host = os.getenv('CLIENT_HOST', '192.168.1.116')
            allowed_origins = [
                "http://localhost:5173",
                "https://localhost:5173", 
                "http://127.0.0.1:5173",
                "https://127.0.0.1:5173",
                f"http://{client_host}:5173",
                f"https://{client_host}:5173"
            ]
            
            if origin in allowed_origins:
                response.headers['Access-Control-Allow-Origin'] = origin
            
            response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
            response.headers['Access-Control-Allow-Credentials'] = 'true'
            
            return response

        # Ajouter le middleware à l'application
        self.app.middlewares.append(cors_handler)
        
        # Ajouter un handler pour les requêtes OPTIONS (preflight)
        async def options_handler(request):
            return web.Response(
                status=200,
                headers={
                    'Access-Control-Allow-Origin': request.headers.get('Origin', '*'),
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                    'Access-Control-Allow-Credentials': 'true'
                }
            )
        
        # Ajouter la route OPTIONS pour toutes les routes
        self.app.router.add_route('OPTIONS', '/{path:.*}', options_handler)

    async def on_connect(self, sid, environ):
        """Connexion d'un client"""
        logger.info(f"Client connecté: {sid}")
        return True

    async def on_disconnect(self, sid):
        """Déconnexion d'un client"""
        logger.info(f"Client déconnecté: {sid}")
        
        # Nettoyer les connexions WebRTC
        if sid in self.commercial_connections:
            await self.commercial_connections[sid].close()
            del self.commercial_connections[sid]
        
        # Nettoyer les listeners admin
        user_info = self.session_to_user.get(sid)
        if user_info and user_info['role'] == 'admin':
            commercial_id = user_info.get('listening_to')
            if commercial_id and commercial_id in self.admin_listeners:
                self.admin_listeners[commercial_id].discard(sid)
                if not self.admin_listeners[commercial_id]:
                    del self.admin_listeners[commercial_id]
        
        # Nettoyer les informations de session
        if sid in self.session_to_user:
            del self.session_to_user[sid]

    async def on_join_commercial_stream(self, sid, data):
        """Un admin veut écouter un commercial"""
        try:
            commercial_id = data.get('commercial_id')
            admin_info = data.get('admin_info', {})
            
            if not commercial_id:
                await self.sio.emit('error', {'message': 'commercial_id requis'}, room=sid)
                return
            
            # Enregistrer l'admin comme listener
            if commercial_id not in self.admin_listeners:
                self.admin_listeners[commercial_id] = set()
            
            self.admin_listeners[commercial_id].add(sid)
            self.session_to_user[sid] = {
                'role': 'admin',
                'listening_to': commercial_id,
                'admin_info': admin_info
            }
            
            logger.info(f"Admin {sid} écoute maintenant le commercial {commercial_id}")
            
            # Notifier que l'écoute a commencé
            await self.sio.emit('listening_started', {
                'commercial_id': commercial_id,
                'listeners_count': len(self.admin_listeners[commercial_id])
            }, room=sid)
            
            # Si le commercial a déjà une piste audio disponible, configurer immédiatement la connexion WebRTC
            if commercial_id in self.commercial_audio_tracks:
                logger.info(f"🎵 Piste audio déjà disponible pour {commercial_id}, configuration WebRTC pour admin {sid}")
                await self.setup_admin_webrtc_connection(sid, commercial_id)
            else:
                logger.info(f"⏳ Aucune piste audio pour {commercial_id}, en attente du streaming")
            
        except Exception as e:
            logger.error(f"Erreur lors de join_commercial_stream: {e}")
            await self.sio.emit('error', {'message': str(e)}, room=sid)

    async def on_leave_commercial_stream(self, sid, data):
        """Un admin arrête d'écouter un commercial"""
        try:
            commercial_id = data.get('commercial_id')
            
            if commercial_id and commercial_id in self.admin_listeners:
                self.admin_listeners[commercial_id].discard(sid)
                if not self.admin_listeners[commercial_id]:
                    del self.admin_listeners[commercial_id]
            
            # Nettoyer les informations de session
            if sid in self.session_to_user:
                del self.session_to_user[sid]
            
            logger.info(f"Admin {sid} a arrêté d'écouter le commercial {commercial_id}")
            
            await self.sio.emit('listening_stopped', {
                'commercial_id': commercial_id
            }, room=sid)
            
        except Exception as e:
            logger.error(f"Erreur lors de leave_commercial_stream: {e}")

    async def on_start_streaming(self, sid, data):
        """Un commercial démarre son streaming audio"""
        try:
            commercial_id = data.get('commercial_id')
            commercial_info = data.get('commercial_info', {})
            
            if not commercial_id:
                await self.sio.emit('error', {'message': 'commercial_id requis'}, room=sid)
                return
            
            # Enregistrer le commercial
            self.session_to_user[sid] = {
                'role': 'commercial',
                'commercial_id': commercial_id,
                'commercial_info': commercial_info
            }
            
            logger.info(f"Commercial {commercial_id} démarre le streaming")
            
            # Notifier les admins qui pourraient écouter
            if commercial_id in self.admin_listeners:
                for admin_sid in self.admin_listeners[commercial_id]:
                    await self.sio.emit('commercial_stream_available', {
                        'commercial_id': commercial_id,
                        'commercial_info': commercial_info
                    }, room=admin_sid)
            
            await self.sio.emit('streaming_started', {
                'commercial_id': commercial_id
            }, room=sid)
            
        except Exception as e:
            logger.error(f"Erreur lors de start_streaming: {e}")
            await self.sio.emit('error', {'message': str(e)}, room=sid)

    async def on_stop_streaming(self, sid, data):
        """Un commercial arrête son streaming audio"""
        try:
            user_info = self.session_to_user.get(sid)
            if not user_info or user_info['role'] != 'commercial':
                return
            
            commercial_id = user_info['commercial_id']
            
            # Fermer la connexion WebRTC
            if sid in self.commercial_connections:
                await self.commercial_connections[sid].close()
                del self.commercial_connections[sid]
            
            # Notifier les admins qui écoutent
            if commercial_id in self.admin_listeners:
                for admin_sid in self.admin_listeners[commercial_id]:
                    await self.sio.emit('commercial_stream_ended', {
                        'commercial_id': commercial_id
                    }, room=admin_sid)
            
            logger.info(f"Commercial {commercial_id} a arrêté le streaming")
            
        except Exception as e:
            logger.error(f"Erreur lors de stop_streaming: {e}")

    async def on_webrtc_offer(self, sid, data):
        """Réception d'une offre WebRTC d'un commercial"""
        try:
            user_info = self.session_to_user.get(sid)
            if not user_info or user_info['role'] != 'commercial':
                await self.sio.emit('error', {'message': 'Seuls les commerciaux peuvent envoyer des offres'}, room=sid)
                return
            
            commercial_id = user_info['commercial_id']
            offer_sdp = data.get('sdp')
            
            if not offer_sdp:
                await self.sio.emit('error', {'message': 'SDP requis'}, room=sid)
                return
            
            logger.info(f"🎤 Traitement de l'offre WebRTC du commercial {commercial_id}")
            
            # Créer une nouvelle connexion WebRTC
            pc = RTCPeerConnection()
            self.commercial_connections[sid] = pc
            
            # Gestionnaire pour les pistes audio reçues
            @pc.on("track")
            def on_track(track):
                logger.info(f"🎵 Piste audio reçue du commercial {commercial_id}: {track.kind}")
                if track.kind == "audio":
                    # Stocker la piste audio pour ce commercial
                    self.commercial_audio_tracks[commercial_id] = track
                    # Notifier tous les admins qui écoutent ce commercial
                    asyncio.create_task(self.notify_listeners_audio_available(commercial_id))
            
            # Ajouter le storage des pistes audio
            if not hasattr(self, 'commercial_audio_tracks'):
                self.commercial_audio_tracks = {}
            
            # Définir la description de l'offre
            await pc.setRemoteDescription(RTCSessionDescription(
                sdp=offer_sdp['sdp'],
                type=offer_sdp['type']
            ))
            
            # Créer une réponse
            answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            
            # Envoyer la réponse au commercial
            await self.sio.emit('webrtc_answer', {
                'sdp': {
                    'sdp': pc.localDescription.sdp,
                    'type': pc.localDescription.type
                }
            }, room=sid)
            
            logger.info(f"✅ Réponse WebRTC envoyée au commercial {commercial_id}")
            
        except Exception as e:
            logger.error(f"❌ Erreur lors du traitement de l'offre WebRTC: {e}")
            await self.sio.emit('error', {'message': str(e)}, room=sid)

    async def on_webrtc_answer(self, sid, data):
        """Réception d'une réponse WebRTC (généralement pas utilisée dans ce flux)"""
        logger.info(f"Réponse WebRTC reçue de {sid}")

    async def on_webrtc_answer_from_admin(self, sid, data):
        """Réception d'une réponse WebRTC d'un admin"""
        try:
            logger.info(f"🎧 Réponse WebRTC reçue de l'admin {sid}")
            
            if sid not in self.admin_connections:
                logger.error(f"Aucune connexion WebRTC trouvée pour l'admin {sid}")
                return
            
            pc = self.admin_connections[sid]
            answer_sdp = data.get('sdp')
            
            if not answer_sdp:
                logger.error("SDP manquant dans la réponse de l'admin")
                return
            
            await pc.setRemoteDescription(RTCSessionDescription(
                sdp=answer_sdp['sdp'],
                type=answer_sdp['type']
            ))
            
            logger.info(f"✅ Réponse WebRTC traitée avec succès pour l'admin {sid}")
            
        except Exception as e:
            logger.error(f"❌ Erreur lors du traitement de la réponse WebRTC admin: {e}")

    async def on_webrtc_ice_candidate_from_admin(self, sid, data):
        """Réception d'un candidat ICE d'un admin"""
        try:
            if sid in self.admin_connections:
                pc = self.admin_connections[sid]
                candidate = data.get('candidate')
                if candidate:
                    await pc.addIceCandidate(candidate)
                    logger.info(f"Candidat ICE ajouté pour l'admin {sid}")
            
        except Exception as e:
            logger.error(f"Erreur lors de l'ajout du candidat ICE admin: {e}")

    async def on_webrtc_ice_candidate(self, sid, data):
        """Réception d'un candidat ICE"""
        try:
            if sid in self.commercial_connections:
                pc = self.commercial_connections[sid]
                candidate = data.get('candidate')
                if candidate:
                    await pc.addIceCandidate(candidate)
                    logger.info(f"Candidat ICE ajouté pour {sid}")
            
        except Exception as e:
            logger.error(f"Erreur lors de l'ajout du candidat ICE: {e}")

    async def notify_listeners_audio_available(self, commercial_id: str):
        """Notifier tous les admins qui écoutent qu'un audio est disponible"""
        try:
            if commercial_id not in self.admin_listeners:
                logger.info(f"Aucun admin n'écoute le commercial {commercial_id}")
                return
            
            logger.info(f"🔊 Audio disponible pour le commercial {commercial_id}, notification de {len(self.admin_listeners[commercial_id])} admin(s)")
            
            # Pour chaque admin qui écoute
            for admin_sid in self.admin_listeners[commercial_id].copy():
                try:
                    await self.setup_admin_webrtc_connection(admin_sid, commercial_id)
                except Exception as e:
                    logger.error(f"Erreur lors de la configuration WebRTC pour l'admin {admin_sid}: {e}")
                    
        except Exception as e:
            logger.error(f"Erreur lors de la notification des listeners: {e}")

    async def relay_audio_to_listeners(self, commercial_id: str, audio_track: MediaStreamTrack):
        """Relayer l'audio vers tous les admins qui écoutent ce commercial"""
        try:
            if commercial_id not in self.admin_listeners:
                return
            
            # Utiliser MediaRelay pour optimiser le streaming
            relayed_track = self.media_relay.subscribe(audio_track)
            
            # Pour chaque admin qui écoute, créer une connexion WebRTC
            for admin_sid in self.admin_listeners[commercial_id].copy():
                try:
                    await self.setup_admin_webrtc_connection(admin_sid, commercial_id, relayed_track)
                except Exception as e:
                    logger.error(f"Erreur lors de la configuration WebRTC pour l'admin {admin_sid}: {e}")
                    
        except Exception as e:
            logger.error(f"Erreur lors du relais audio: {e}")

    async def setup_admin_webrtc_connection(self, admin_sid: str, commercial_id: str):
        """Configurer une connexion WebRTC pour un admin"""
        try:
            # Vérifier qu'on a bien une piste audio pour ce commercial
            if commercial_id not in self.commercial_audio_tracks:
                logger.warning(f"Aucune piste audio disponible pour le commercial {commercial_id}")
                return
            
            audio_track = self.commercial_audio_tracks[commercial_id]
            
            # Créer une connexion WebRTC pour cet admin
            pc = RTCPeerConnection()
            self.admin_connections[admin_sid] = pc
            
            # Utiliser MediaRelay pour partager la piste audio
            relayed_track = self.media_relay.subscribe(audio_track)
            pc.addTrack(relayed_track)
            
            # Gestionnaire ICE
            @pc.on("icecandidate")
            def on_ice_candidate(candidate):
                if candidate:
                    asyncio.create_task(self.sio.emit('webrtc_ice_candidate_to_admin', {
                        'commercial_id': commercial_id,
                        'candidate': candidate
                    }, room=admin_sid))
            
            # Créer une offre
            offer = await pc.createOffer()
            await pc.setLocalDescription(offer)
            
            # Envoyer l'offre à l'admin
            await self.sio.emit('webrtc_offer_from_commercial', {
                'commercial_id': commercial_id,
                'sdp': {
                    'sdp': pc.localDescription.sdp,
                    'type': pc.localDescription.type
                }
            }, room=admin_sid)
            
            logger.info(f"🎧 Offre WebRTC envoyée à l'admin {admin_sid} pour le commercial {commercial_id}")
            
        except Exception as e:
            logger.error(f"❌ Erreur lors de la configuration WebRTC admin: {e}")

    async def get_streaming_status(self, request):
        """API REST pour obtenir le statut du streaming"""
        try:
            status = {
                'active_commercials': len(self.commercial_connections),
                'total_listeners': sum(len(listeners) for listeners in self.admin_listeners.values()),
                'commercial_details': {}
            }
            
            for commercial_id, listeners in self.admin_listeners.items():
                status['commercial_details'][commercial_id] = {
                    'listeners_count': len(listeners),
                    'is_streaming': any(
                        info.get('commercial_id') == commercial_id 
                        for info in self.session_to_user.values() 
                        if info.get('role') == 'commercial'
                    )
                }
            
            return web.json_response(status)
            
        except Exception as e:
            logger.error(f"Erreur lors de la récupération du statut: {e}")
            return web.json_response({'error': str(e)}, status=500)

    def setup_routes(self):
        """Configurer les routes HTTP"""
        self.app.router.add_get('/api/streaming/status', self.get_streaming_status)
        self.app.router.add_get('/health', lambda r: web.json_response({'status': 'ok'}))

    async def create_ssl_context(self):
        """Créer le contexte SSL pour HTTPS"""
        ssl_context = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
        try:
            # Utiliser les mêmes certificats que le serveur Vite
            import os.path
            ssl_dir = os.path.join(os.path.dirname(__file__), '..', 'ssl')
            ssl_context.load_cert_chain(
                os.path.join(ssl_dir, '127.0.0.1+1.pem'),
                os.path.join(ssl_dir, '127.0.0.1+1-key.pem')
            )
            logger.info("✅ Certificats SSL chargés avec succès")
            return ssl_context
        except Exception as e:
            logger.error(f"❌ Erreur lors du chargement des certificats SSL: {e}")
            return None

    async def start_server(self, host='0.0.0.0', http_port=None, https_port=None):
        # Utiliser les variables d'environnement ou les valeurs par défaut
        if http_port is None:
            http_port = int(os.getenv('HTTP_PORT', '8080'))
        if https_port is None:
            https_port = int(os.getenv('HTTPS_PORT', '8443'))
        """Démarrer les serveurs HTTP et HTTPS"""
        self.setup_routes()
        
        logger.info(f"Démarrage des serveurs de streaming audio sur {host}")
        
        # Créer le runner pour l'application
        runner = web.AppRunner(self.app)
        await runner.setup()
        
        # Démarrer le serveur HTTP
        http_site = web.TCPSite(runner, host, http_port)
        await http_site.start()
        logger.info(f"✅ Serveur HTTP démarré sur http://{host}:{http_port}")
        
        # Démarrer le serveur HTTPS si les certificats sont disponibles
        ssl_context = await self.create_ssl_context()
        if ssl_context:
            https_site = web.TCPSite(runner, host, https_port, ssl_context=ssl_context)
            await https_site.start()
            logger.info(f"✅ Serveur HTTPS démarré sur https://{host}:{https_port}")
        else:
            logger.warning("⚠️  Serveur HTTPS non démarré (certificats SSL non disponibles)")
        
        logger.info("🎵 Serveurs de streaming audio prêts !")
        
        # Garder les serveurs en vie
        try:
            while True:
                await asyncio.sleep(1)
        except KeyboardInterrupt:
            logger.info("🛑 Arrêt des serveurs...")
            await runner.cleanup()

async def main():
    """Point d'entrée principal"""
    server = AudioStreamingServer()
    await server.start_server()

if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Serveur arrêté par l'utilisateur")