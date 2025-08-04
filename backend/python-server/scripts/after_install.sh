#!/bin/bash

# Script de post-installation pour AWS CodeDeploy
# Exécuté après l'installation de l'application

set -e

# Configuration
LOG_FILE="/opt/prospec-python-server/logs/after_install.log"
SERVICE_NAME="prospec-python-server"

# Fonction de log
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

log "Début de la post-installation..."

# Aller dans le répertoire du projet
cd /opt/prospec-python-server

# Rendre les scripts exécutables
chmod +x scripts/*.sh
chmod +x start.sh

# Créer l'environnement virtuel Python
log "Création de l'environnement virtuel Python..."
python3 -m venv venv
source venv/bin/activate

# Installer les dépendances Python
log "Installation des dépendances Python..."
pip install --upgrade pip
pip install -r requirements.txt

# Configuration des permissions
log "Configuration des permissions..."
chown -R ubuntu:ubuntu /opt/prospec-python-server
chmod -R 755 /opt/prospec-python-server

# Configuration de Supervisor
log "Configuration de Supervisor..."
cat > /etc/supervisor/conf.d/$SERVICE_NAME.conf << EOF
[program:$SERVICE_NAME]
command=/opt/prospec-python-server/venv/bin/python /opt/prospec-python-server/audio_streaming_server.py
directory=/opt/prospec-python-server
user=ubuntu
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/opt/prospec-python-server/logs/supervisor.log
environment=PYTHONUNBUFFERED=1
EOF

# Recharger la configuration Supervisor
supervisorctl reread
supervisorctl update

# Configuration de Nginx
log "Configuration de Nginx..."
cat > /etc/nginx/sites-available/$SERVICE_NAME << EOF
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

# Activer le site Nginx
ln -sf /etc/nginx/sites-available/$SERVICE_NAME /etc/nginx/sites-enabled/

# Tester la configuration Nginx
nginx -t

# Redémarrer Nginx
systemctl restart nginx

# Configuration des logs
log "Configuration des logs..."
cat > /etc/logrotate.d/$SERVICE_NAME << EOF
/opt/prospec-python-server/logs/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 644 ubuntu ubuntu
    postrotate
        supervisorctl restart $SERVICE_NAME
    endscript
}
EOF

log "Post-installation terminée" 