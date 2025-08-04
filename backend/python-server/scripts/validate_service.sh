#!/bin/bash

# Script de validation du service pour AWS CodeDeploy
# Exécuté pour valider que le service fonctionne correctement

set -e

# Configuration
LOG_FILE="/opt/prospec-python-server/logs/validate_service.log"
SERVICE_NAME="prospec-python-server"

# Fonction de log
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

log "Validation du service..."

# Vérifier que le service fonctionne avec Supervisor
if supervisorctl status $SERVICE_NAME | grep -q "RUNNING"; then
    log "Service Supervisor en cours d'exécution"
else
    log "ERROR: Service Supervisor non en cours d'exécution"
    supervisorctl status $SERVICE_NAME
    exit 1
fi

# Vérifier que le service répond sur le port 8000
log "Test de connectivité sur le port 8000..."
if curl -f http://localhost:8000/health > /dev/null 2>&1; then
    log "Service accessible sur http://localhost:8000"
else
    log "ERROR: Service non accessible sur le port 8000"
    exit 1
fi

# Vérifier que le service répond sur Nginx (port 80)
log "Test de connectivité via Nginx..."
if curl -f http://localhost/health > /dev/null 2>&1; then
    log "Service accessible via Nginx"
else
    log "WARNING: Service non accessible via Nginx"
fi

# Vérifier les logs
if [ -f "/opt/prospec-python-server/logs/audio_server.log" ]; then
    log "Logs générés correctement"
    
    # Vérifier qu'il n'y a pas d'erreurs récentes
    if tail -n 50 /opt/prospec-python-server/logs/audio_server.log | grep -q "ERROR"; then
        log "WARNING: Erreurs détectées dans les logs"
        tail -n 10 /opt/prospec-python-server/logs/audio_server.log | grep "ERROR"
    fi
else
    log "WARNING: Aucun log généré"
fi

# Vérifier l'utilisation des ressources
log "Vérification des ressources..."

# Mémoire
MEMORY_USAGE=$(free | grep Mem | awk '{printf "%.2f", $3/$2 * 100.0}')
log "Utilisation mémoire: ${MEMORY_USAGE}%"

if (( $(echo "$MEMORY_USAGE > 80" | bc -l) )); then
    log "WARNING: Utilisation mémoire élevée"
fi

# CPU
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
log "Utilisation CPU: ${CPU_USAGE}%"

if (( $(echo "$CPU_USAGE > 80" | bc -l) )); then
    log "WARNING: Utilisation CPU élevée"
fi

# Espace disque
DISK_USAGE=$(df /opt | tail -1 | awk '{print $5}' | sed 's/%//')
log "Utilisation disque: ${DISK_USAGE}%"

if [ $DISK_USAGE -gt 80 ]; then
    log "WARNING: Utilisation disque élevée"
fi

# Test de performance
log "Test de performance..."
RESPONSE_TIME=$(curl -o /dev/null -s -w "%{time_total}" http://localhost:8000/health)
log "Temps de réponse: ${RESPONSE_TIME}s"

if (( $(echo "$RESPONSE_TIME > 5" | bc -l) )); then
    log "WARNING: Temps de réponse élevé"
fi

# Vérifier les connexions WebSocket
log "Test des WebSockets..."
if curl -f -I http://localhost:8000/socket.io/ > /dev/null 2>&1; then
    log "WebSockets accessibles"
else
    log "WARNING: WebSockets non accessibles"
fi

# Vérifier les certificats SSL si configurés
if [ -f "/opt/prospec-python-server/certs/cert.pem" ]; then
    log "Certificats SSL présents"
else
    log "INFO: Certificats SSL non configurés"
fi

log "Validation du service terminée avec succès" 