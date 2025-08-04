#!/bin/bash

# Script de pré-installation pour AWS CodeDeploy
# Exécuté avant l'installation de l'application

set -e

# Configuration
LOG_FILE="/opt/prospec-python-server/logs/before_install.log"
SERVICE_NAME="prospec-python-server"

# Fonction de log
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

log "Début de la pré-installation..."

# Créer les répertoires nécessaires
mkdir -p /opt/prospec-python-server/{logs,certs,temp,config}

# Arrêter le service existant s'il existe
if systemctl is-active --quiet $SERVICE_NAME; then
    log "Arrêt du service existant..."
    systemctl stop $SERVICE_NAME
fi

# Arrêter le conteneur Docker s'il existe
if docker ps -q -f name=$SERVICE_NAME | grep -q .; then
    log "Arrêt du conteneur Docker existant..."
    docker stop $SERVICE_NAME
    docker rm $SERVICE_NAME
fi

# Nettoyer les anciens fichiers
log "Nettoyage des anciens fichiers..."
rm -rf /opt/prospec-python-server/temp/*
rm -rf /opt/prospec-python-server/logs/*.log

# Vérifier l'espace disque
DISK_USAGE=$(df /opt | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 90 ]; then
    log "WARNING: Espace disque faible: ${DISK_USAGE}%"
    # Nettoyer les anciens logs
    find /opt/prospec-python-server/logs -name "*.log" -mtime +7 -delete
fi

log "Pré-installation terminée" 