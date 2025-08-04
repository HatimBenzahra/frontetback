#!/bin/bash

# Script de déploiement pour AWS Ubuntu
# Optimisé pour le serveur Python de streaming audio

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="prospec-python-server"
SERVICE_NAME="prospec-python-server"
USER_NAME="ubuntu"
GROUP_NAME="ubuntu"

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction de log
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Fonction de vérification des prérequis
check_prerequisites() {
    log "Vérification des prérequis..."
    
    # Vérifier que nous sommes sur Ubuntu
    if ! grep -q "Ubuntu" /etc/os-release; then
        log_error "Ce script est conçu pour Ubuntu"
        exit 1
    fi
    
    # Vérifier les permissions sudo
    if ! sudo -n true 2>/dev/null; then
        log_error "Permissions sudo requises"
        exit 1
    fi
    
    # Vérifier Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker n'est pas installé"
        exit 1
    fi
    
    # Vérifier Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose n'est pas installé"
        exit 1
    fi
    
    log_success "Prérequis vérifiés"
}

# Fonction d'installation des dépendances système
install_system_dependencies() {
    log "Installation des dépendances système..."
    
    # Mise à jour du système
    sudo apt-get update
    
    # Installation des paquets nécessaires
    sudo apt-get install -y \
        python3 \
        python3-pip \
        python3-venv \
        curl \
        wget \
        git \
        htop \
        nginx \
        certbot \
        python3-certbot-nginx \
        ufw \
        fail2ban \
        logrotate \
        supervisor
    
    log_success "Dépendances système installées"
}

# Fonction de configuration du firewall
setup_firewall() {
    log "Configuration du firewall..."
    
    # Activer UFW
    sudo ufw --force enable
    
    # Règles par défaut
    sudo ufw default deny incoming
    sudo ufw default allow outgoing
    
    # Autoriser SSH
    sudo ufw allow ssh
    
    # Autoriser HTTP et HTTPS
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    
    # Autoriser le port du serveur Python
    sudo ufw allow 8000/tcp
    
    # Autoriser les ports Docker si nécessaire
    sudo ufw allow 3000/tcp  # Backend
    sudo ufw allow 5173/tcp  # Frontend
    
    log_success "Firewall configuré"
}

# Fonction de configuration de l'environnement
setup_environment() {
    log "Configuration de l'environnement..."
    
    # Créer le répertoire du projet
    sudo mkdir -p /opt/$PROJECT_NAME
    sudo chown $USER_NAME:$GROUP_NAME /opt/$PROJECT_NAME
    
    # Créer les répertoires nécessaires
    mkdir -p /opt/$PROJECT_NAME/{logs,certs,temp,config}
    
    # Configuration des variables d'environnement
    cat > /opt/$PROJECT_NAME/.env << EOF
# Configuration du serveur Python
HOST=0.0.0.0
PORT=8000
LOG_LEVEL=INFO
ENVIRONMENT=production

# Configuration CORS
LOCALHOST_DEV=localhost
LOCALHOST_IP=127.0.0.1
FRONTEND_PORT=5173
CLIENT_HOST=
PRODUCTION_IP=\$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)

# Configuration SSL
SSL_ENABLED=false
SSL_CERT_FILE=
SSL_KEY_FILE=

# Configuration audio
AUDIO_SAMPLE_RATE=48000
AUDIO_CHANNELS=1
AUDIO_BITRATE=128000
AUDIO_MAX_DURATION=3600

# Configuration WebRTC
WEBRTC_MAX_CONNECTIONS=100
WEBRTC_CONNECTION_TIMEOUT=30

# Configuration de la base de données
DATABASE_URL=postgresql://prospec_user:prospec_password@localhost:5432/prospec_db

# Configuration JWT
JWT_SECRET=your_jwt_secret_here_change_in_production
EOF
    
    log_success "Environnement configuré"
}

# Fonction de configuration de Supervisor
setup_supervisor() {
    log "Configuration de Supervisor..."
    
    # Configuration du service
    sudo tee /etc/supervisor/conf.d/$SERVICE_NAME.conf > /dev/null << EOF
[program:$SERVICE_NAME]
command=/opt/$PROJECT_NAME/venv/bin/python /opt/$PROJECT_NAME/audio_streaming_server.py
directory=/opt/$PROJECT_NAME
user=$USER_NAME
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/opt/$PROJECT_NAME/logs/supervisor.log
environment=PYTHONUNBUFFERED=1
EOF
    
    # Recharger la configuration
    sudo supervisorctl reread
    sudo supervisorctl update
    
    log_success "Supervisor configuré"
}

# Fonction de configuration de Nginx
setup_nginx() {
    log "Configuration de Nginx..."
    
    # Configuration du site
    sudo tee /etc/nginx/sites-available/$PROJECT_NAME > /dev/null << EOF
server {
    listen 80;
    server_name _;
    
    # Proxy vers le serveur Python
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
    
    # Configuration pour les WebSockets
    location /socket.io/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
    
    # Activer le site
    sudo ln -sf /etc/nginx/sites-available/$PROJECT_NAME /etc/nginx/sites-enabled/
    
    # Tester la configuration
    sudo nginx -t
    
    # Redémarrer Nginx
    sudo systemctl restart nginx
    
    log_success "Nginx configuré"
}

# Fonction de configuration des logs
setup_logs() {
    log "Configuration des logs..."
    
    # Configuration de logrotate
    sudo tee /etc/logrotate.d/$PROJECT_NAME > /dev/null << EOF
/opt/$PROJECT_NAME/logs/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 644 $USER_NAME $GROUP_NAME
    postrotate
        supervisorctl restart $SERVICE_NAME
    endscript
}
EOF
    
    log_success "Logs configurés"
}

# Fonction de configuration de la surveillance
setup_monitoring() {
    log "Configuration de la surveillance..."
    
    # Script de surveillance
    cat > /opt/$PROJECT_NAME/monitor.sh << 'EOF'
#!/bin/bash

# Script de surveillance pour le serveur Python

LOG_FILE="/opt/prospec-python-server/logs/monitor.log"
SERVICE_NAME="prospec-python-server"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" >> $LOG_FILE
}

# Vérifier si le service fonctionne
if ! supervisorctl status $SERVICE_NAME | grep -q "RUNNING"; then
    log "ERROR: Service $SERVICE_NAME n'est pas en cours d'exécution"
    supervisorctl restart $SERVICE_NAME
    log "Service redémarré"
fi

# Vérifier l'utilisation de la mémoire
MEMORY_USAGE=$(free | grep Mem | awk '{printf "%.2f", $3/$2 * 100.0}')
if (( $(echo "$MEMORY_USAGE > 80" | bc -l) )); then
    log "WARNING: Utilisation mémoire élevée: ${MEMORY_USAGE}%"
fi

# Vérifier l'espace disque
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    log "WARNING: Utilisation disque élevée: ${DISK_USAGE}%"
fi
EOF
    
    chmod +x /opt/$PROJECT_NAME/monitor.sh
    
    # Ajouter au crontab
    (crontab -l 2>/dev/null; echo "*/5 * * * * /opt/$PROJECT_NAME/monitor.sh") | crontab -
    
    log_success "Surveillance configurée"
}

# Fonction de déploiement Docker
deploy_docker() {
    log "Déploiement avec Docker..."
    
    # Aller dans le répertoire du projet
    cd $SCRIPT_DIR
    
    # Construire l'image
    docker build -t $PROJECT_NAME .
    
    # Arrêter le conteneur existant s'il existe
    docker stop $PROJECT_NAME 2>/dev/null || true
    docker rm $PROJECT_NAME 2>/dev/null || true
    
    # Démarrer le nouveau conteneur
    docker run -d \
        --name $PROJECT_NAME \
        --restart unless-stopped \
        -p 8000:8000 \
        -v /opt/$PROJECT_NAME/logs:/app/logs \
        -v /opt/$PROJECT_NAME/certs:/app/certs \
        -v /opt/$PROJECT_NAME/temp:/app/temp \
        --env-file /opt/$PROJECT_NAME/.env \
        $PROJECT_NAME
    
    log_success "Déploiement Docker terminé"
}

# Fonction de vérification du déploiement
verify_deployment() {
    log "Vérification du déploiement..."
    
    # Attendre que le service démarre
    sleep 10
    
    # Vérifier que le service répond
    if curl -f http://localhost:8000/health > /dev/null 2>&1; then
        log_success "Service accessible sur http://localhost:8000"
    else
        log_error "Service non accessible"
        return 1
    fi
    
    # Vérifier les logs
    if [ -f "/opt/$PROJECT_NAME/logs/audio_server.log" ]; then
        log_success "Logs générés"
    else
        log_warning "Aucun log généré"
    fi
    
    log_success "Déploiement vérifié"
}

# Fonction principale
main() {
    log "Démarrage du déploiement pour AWS Ubuntu..."
    
    check_prerequisites
    install_system_dependencies
    setup_firewall
    setup_environment
    setup_supervisor
    setup_nginx
    setup_logs
    setup_monitoring
    deploy_docker
    verify_deployment
    
    log_success "Déploiement terminé avec succès!"
    log "Le service est accessible sur: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)"
}

# Exécution du script
main "$@" 