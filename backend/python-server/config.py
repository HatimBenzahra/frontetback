"""
Configuration centralisée pour le serveur Python de streaming audio
Optimisé pour AWS Ubuntu
"""

import os
from typing import List, Optional
from dataclasses import dataclass
from decouple import config

@dataclass
class ServerConfig:
    """Configuration du serveur"""
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False
    log_level: str = "INFO"
    environment: str = "production"

@dataclass
class CORSConfig:
    """Configuration CORS"""
    allowed_origins: List[str]
    allowed_methods: List[str] = None
    allowed_headers: List[str] = None

@dataclass
class SSLConfig:
    """Configuration SSL"""
    enabled: bool = False
    cert_file: Optional[str] = None
    key_file: Optional[str] = None

@dataclass
class AudioConfig:
    """Configuration audio"""
    sample_rate: int = 48000
    channels: int = 1
    bitrate: int = 128000
    max_duration: int = 3600  # 1 heure

@dataclass
class WebRTCConfig:
    """Configuration WebRTC"""
    ice_servers: List[dict] = None
    max_connections: int = 100
    connection_timeout: int = 30

class Config:
    """Configuration principale"""
    
    def __init__(self):
        # Configuration du serveur
        self.server = ServerConfig(
            host=config('HOST', default='0.0.0.0'),
            port=config('PORT', default=8000, cast=int),
            debug=config('DEBUG', default=False, cast=bool),
            log_level=config('LOG_LEVEL', default='INFO'),
            environment=config('ENVIRONMENT', default='production')
        )
        
        # Configuration CORS
        self.cors = CORSConfig(
            allowed_origins=self._get_allowed_origins(),
            allowed_methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowed_headers=['Content-Type', 'Authorization', 'X-Requested-With']
        )
        
        # Configuration SSL
        self.ssl = SSLConfig(
            enabled=config('SSL_ENABLED', default=False, cast=bool),
            cert_file=config('SSL_CERT_FILE', default=None),
            key_file=config('SSL_KEY_FILE', default=None)
        )
        
        # Configuration audio
        self.audio = AudioConfig(
            sample_rate=config('AUDIO_SAMPLE_RATE', default=48000, cast=int),
            channels=config('AUDIO_CHANNELS', default=1, cast=int),
            bitrate=config('AUDIO_BITRATE', default=128000, cast=int),
            max_duration=config('AUDIO_MAX_DURATION', default=3600, cast=int)
        )
        
        # Configuration WebRTC
        self.webrtc = WebRTCConfig(
            ice_servers=self._get_ice_servers(),
            max_connections=config('WEBRTC_MAX_CONNECTIONS', default=100, cast=int),
            connection_timeout=config('WEBRTC_CONNECTION_TIMEOUT', default=30, cast=int)
        )
    
    def _get_allowed_origins(self) -> List[str]:
        """Récupérer les origines autorisées depuis les variables d'environnement"""
        origins = []
        
        # Origines de développement
        localhost_dev = config('LOCALHOST_DEV', default='localhost')
        localhost_ip = config('LOCALHOST_IP', default='127.0.0.1')
        frontend_port = config('FRONTEND_PORT', default='5173')
        
        # Origines de production
        client_host = config('CLIENT_HOST', default='')
        production_ip = config('PRODUCTION_IP', default='')
        
        # Ajouter les origines de développement
        if localhost_dev:
            origins.extend([
                f"http://{localhost_dev}:{frontend_port}",
                f"https://{localhost_dev}:{frontend_port}"
            ])
        
        if localhost_ip:
            origins.extend([
                f"http://{localhost_ip}:{frontend_port}",
                f"https://{localhost_ip}:{frontend_port}"
            ])
        
        # Ajouter les origines de production
        if client_host:
            origins.extend([
                f"http://{client_host}:{frontend_port}",
                f"https://{client_host}:{frontend_port}",
                f"http://{client_host}",
                f"https://{client_host}"
            ])
        
        if production_ip:
            origins.extend([
                f"http://{production_ip}",
                f"https://{production_ip}"
            ])
        
        # Ajouter les origines par défaut si aucune n'est configurée
        if not origins:
            origins = [
                "http://localhost:5173",
                "https://localhost:5173",
                "http://127.0.0.1:5173",
                "https://127.0.0.1:5173"
            ]
        
        return origins
    
    def _get_ice_servers(self) -> List[dict]:
        """Récupérer les serveurs ICE pour WebRTC"""
        # Serveurs ICE par défaut (Google STUN)
        default_ice_servers = [
            {
                "urls": [
                    "stun:stun.l.google.com:19302",
                    "stun:stun1.l.google.com:19302"
                ]
            }
        ]
        
        # Ajouter des serveurs TURN si configurés
        turn_server = config('TURN_SERVER', default='')
        turn_username = config('TURN_USERNAME', default='')
        turn_password = config('TURN_PASSWORD', default='')
        
        if turn_server and turn_username and turn_password:
            default_ice_servers.append({
                "urls": [turn_server],
                "username": turn_username,
                "credential": turn_password
            })
        
        return default_ice_servers
    
    def get_database_url(self) -> str:
        """Récupérer l'URL de la base de données"""
        return config('DATABASE_URL', default='')
    
    def get_jwt_secret(self) -> str:
        """Récupérer le secret JWT"""
        return config('JWT_SECRET', default='your_jwt_secret_here')
    
    def is_production(self) -> bool:
        """Vérifier si on est en production"""
        return self.server.environment.lower() == 'production'
    
    def is_development(self) -> bool:
        """Vérifier si on est en développement"""
        return self.server.environment.lower() == 'development'
    
    def get_log_config(self) -> dict:
        """Configuration des logs"""
        return {
            'version': 1,
            'disable_existing_loggers': False,
            'formatters': {
                'standard': {
                    'format': '%(asctime)s [%(levelname)s] %(name)s: %(message)s'
                },
            },
            'handlers': {
                'default': {
                    'level': self.server.log_level,
                    'formatter': 'standard',
                    'class': 'logging.StreamHandler',
                },
                'file': {
                    'level': self.server.log_level,
                    'formatter': 'standard',
                    'class': 'logging.FileHandler',
                    'filename': '/app/logs/audio_server.log',
                    'mode': 'a',
                },
            },
            'loggers': {
                '': {
                    'handlers': ['default', 'file'],
                    'level': self.server.log_level,
                    'propagate': False
                }
            }
        }

# Instance globale de configuration
config = Config() 