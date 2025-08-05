# 🚀 Prospec - Application de Prospection

Application complète de gestion de prospection avec streaming audio en temps réel.

## 🏗️ Architecture

- **Backend**: NestJS avec TypeScript + Service Audio Streaming intégré
- **Frontend**: React + Vite + TypeScript  
- **Base de données**: PostgreSQL
- **Reverse Proxy**: Nginx avec SSL
- **Containerisation**: Docker & Docker Compose

## ⚡ Démarrage rapide

### 1. Générer les certificats SSL
```bash
./generate-ssl.sh
```

### 2. Configuration
```bash
# Copier la configuration Docker
cp .env.docker .env

# Optionnel: Modifier les variables selon vos besoins
nano .env
```

### 3. Lancer l'application
```bash
# Construire et démarrer tous les services
docker-compose up --build

# En arrière-plan
docker-compose up -d --build
```

### 4. Accès aux services
- **Application**: https://localhost (port 443)
- **API**: https://localhost/api
- **Audio Streaming**: https://localhost/audio-streaming  
- **Health Check**: https://localhost/health

## 🔧 Développement local

### Backend seul
```bash
cd backend
npm install
npm run start:dev
```

### Frontend seul  
```bash
cd moduleProspec-*
npm install
npm run dev -- --host
```

## 📡 Service Audio Streaming

Le service de streaming audio est intégré dans le backend NestJS :

### Endpoints REST
- `GET /audio-streaming/` - Informations du service
- `GET /audio-streaming/health` - Health check
- `GET /audio-streaming/status` - Statut détaillé

### WebSocket (Socket.IO)
- **Namespace**: `/audio-streaming`
- **URL**: `wss://localhost/audio-streaming`

### Événements supportés
- `register_user` - Enregistrer un utilisateur
- `start_streaming` / `stop_streaming` - Streaming (commerciaux)
- `join_commercial_stream` / `leave_commercial_stream` - Écoute (admins)
- `webrtc_*` - Signalisation WebRTC
- `get_available_streams` - Liste des streams

## 🐳 Docker

### Commandes utiles
```bash
# Voir les logs
docker-compose logs -f

# Redémarrer un service
docker-compose restart backend

# Arrêter et nettoyer
docker-compose down --volumes

# Reconstruction complète
docker-compose down --volumes --rmi all
docker-compose up --build
```

### Services
- `postgres` - Base de données PostgreSQL
- `backend` - API NestJS + Audio Streaming  
- `frontend` - Interface React
- `nginx` - Reverse proxy SSL

## 🔒 SSL/HTTPS

L'application utilise HTTPS en production avec :
- Certificats auto-signés pour le développement
- Redirection automatique HTTP → HTTPS
- Headers de sécurité configurés
- Support WebSocket sécurisé (WSS)

## 🌐 Configuration réseau

### Développement
- Backend: `https://192.168.1.50:3000`
- Frontend: `http://192.168.1.50:5173`
- Nginx: `https://localhost:443`

### Production Docker
- Tous les services communiquent via le réseau interne Docker
- Seul Nginx expose les ports vers l'extérieur (80, 443)

## 🚨 Dépannage

### Certificats SSL
```bash
# Régénérer les certificats
rm -rf ssl/ nginx/ssl/
./generate-ssl.sh
```

### Problèmes de connexion
```bash
# Vérifier les services
docker-compose ps

# Vérifier les logs
docker-compose logs backend
docker-compose logs nginx
```

### Base de données
```bash
# Réinitialiser la DB
docker-compose down -v
docker-compose up postgres -d
```

## 📝 Notes importantes

- Les certificats sont auto-signés (avertissement navigateur normal)
- Utilisez `curl -k` pour ignorer les erreurs SSL en test
- Le service Python a été migré vers TypeScript/NestJS
- Tous les endpoints passent par HTTPS en production