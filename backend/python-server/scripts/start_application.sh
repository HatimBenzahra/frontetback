#!/bin/bash

# Script de démarrage de l'application pour AWS CodeDeploy
# Exécuté pour démarrer l'application

set -e

# Configuration
LOG_FILE="/opt/prospec-python-server/logs/start_application.log"
SERVICE_NAME="prospec-python-server"

# Fonction de log
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

log "Démarrage de l'application..."

# Aller dans le répertoire du projet
cd /opt/prospec-python-server

# Activer l'environnement virtuel
source venv/bin/activate

# Vérifier que les dépendances sont installées
log "Vérification des dépendances..."
python3 -c "import aiohttp, socketio, aiortc" || {
    log "ERROR: Dépendances manquantes, installation..."
    pip install -r requirements.txt
}

# Démarrer le service avec Supervisor
log "Démarrage du service avec Supervisor..."
supervisorctl start $SERVICE_NAME

# Attendre que le service démarre
log "Attente du démarrage du service..."
sleep 10

# Vérifier que le service fonctionne
if supervisorctl status $SERVICE_NAME | grep -q "RUNNING"; then
    log "Service démarré avec succès"
else
    log "ERROR: Échec du démarrage du service"
    supervisorctl status $SERVICE_NAME
    exit 1
fi

# Vérifier que le service répond
log "Vérification de la réponse du service..."
for i in {1..30}; do
    if curl -f http://localhost:8000/health > /dev/null 2>&1; then
        log "Service accessible sur http://localhost:8000"
        break
    else
        log "Tentative $i/30: Service non accessible"
        sleep 2
    fi
done

# Vérifier les logs
if [ -f "logs/audio_server.log" ]; then
    log "Logs générés avec succès"
else
    log "WARNING: Aucun log généré"
fi

log "Application démarrée avec succès" 