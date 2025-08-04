#!/bin/bash

# Script d'arrêt de l'application pour AWS CodeDeploy
# Exécuté pour arrêter l'application

set -e

# Configuration
LOG_FILE="/opt/prospec-python-server/logs/stop_application.log"
SERVICE_NAME="prospec-python-server"

# Fonction de log
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

log "Arrêt de l'application..."

# Arrêter le service avec Supervisor
if supervisorctl status $SERVICE_NAME | grep -q "RUNNING"; then
    log "Arrêt du service avec Supervisor..."
    supervisorctl stop $SERVICE_NAME
    
    # Attendre que le service s'arrête
    for i in {1..30}; do
        if ! supervisorctl status $SERVICE_NAME | grep -q "RUNNING"; then
            log "Service arrêté avec succès"
            break
        else
            log "Tentative $i/30: Attente de l'arrêt du service"
            sleep 2
        fi
    done
else
    log "Service déjà arrêté"
fi

# Arrêter le conteneur Docker s'il existe
if docker ps -q -f name=$SERVICE_NAME | grep -q .; then
    log "Arrêt du conteneur Docker..."
    docker stop $SERVICE_NAME
    docker rm $SERVICE_NAME
fi

# Sauvegarder les logs
log "Sauvegarde des logs..."
if [ -f "/opt/prospec-python-server/logs/audio_server.log" ]; then
    cp /opt/prospec-python-server/logs/audio_server.log /opt/prospec-python-server/logs/audio_server.log.backup.$(date +%Y%m%d_%H%M%S)
fi

# Nettoyer les fichiers temporaires
log "Nettoyage des fichiers temporaires..."
rm -rf /opt/prospec-python-server/temp/*

log "Application arrêtée avec succès" 