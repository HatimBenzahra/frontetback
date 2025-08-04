#!/bin/sh

# Script de démarrage pour le serveur Python de streaming audio
# Optimisé pour AWS Ubuntu

set -e

# Configuration des variables d'environnement
export PYTHONUNBUFFERED=1
export PYTHONPATH=/app

# Fonction de log
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

# Fonction de gestion des erreurs
handle_error() {
    log "ERROR: Une erreur s'est produite. Code: $?"
    log "Arrêt du serveur..."
    exit 1
}

# Fonction de nettoyage
cleanup() {
    log "Nettoyage en cours..."
    # Nettoyer les fichiers temporaires
    rm -rf /app/temp/*
    log "Nettoyage terminé"
}

# Configuration du trap pour la gestion des signaux
trap handle_error ERR
trap cleanup EXIT

# Vérification des prérequis
log "Vérification des prérequis..."

# Vérifier que Python est installé
if ! command -v python3 &> /dev/null; then
    log "ERROR: Python3 n'est pas installé"
    exit 1
fi

# Vérifier que les dépendances sont installées
if ! python3 -c "import aiohttp, socketio, aiortc" 2>/dev/null; then
    log "ERROR: Dépendances Python manquantes"
    exit 1
fi

# Vérifier les permissions
if [ ! -w /app ]; then
    log "ERROR: Pas de permissions d'écriture sur /app"
    exit 1
fi

log "Prérequis vérifiés avec succès"

# Création des répertoires nécessaires
log "Création des répertoires..."
mkdir -p /app/logs /app/certs /app/temp
chmod 755 /app/logs /app/certs /app/temp

# Configuration des variables d'environnement
HOST=${HOST:-0.0.0.0}
PORT=${PORT:-8000}
LOG_LEVEL=${LOG_LEVEL:-INFO}
ENVIRONMENT=${ENVIRONMENT:-production}

log "Configuration:"
log "  HOST: $HOST"
log "  PORT: $PORT"
log "  LOG_LEVEL: $LOG_LEVEL"
log "  ENVIRONMENT: $ENVIRONMENT"

# Vérification de la connectivité réseau
log "Test de connectivité réseau..."
if ! ping -c 1 8.8.8.8 &> /dev/null; then
    log "WARNING: Pas de connectivité internet"
fi

# Démarrage du serveur avec gestion d'erreurs
log "Démarrage du serveur de streaming audio..."

# Boucle de redémarrage automatique
while true; do
    log "Lancement du serveur Python..."
    
    # Démarrer le serveur avec gestion des signaux
    if python3 audio_streaming_server.py; then
        log "Serveur arrêté normalement"
        break
    else
        log "ERROR: Le serveur s'est arrêté avec une erreur"
        log "Redémarrage dans 5 secondes..."
        sleep 5
    fi
done

log "Arrêt du serveur" 