# 🚀 Déploiement AWS Ubuntu - Serveur Python de Streaming Audio

Ce guide explique comment déployer le serveur Python de streaming audio sur AWS Ubuntu sans problème.

## 📋 Prérequis AWS

### Instance EC2
- **OS** : Ubuntu 22.04 LTS
- **Type** : t3.medium minimum (2 vCPU, 4 GB RAM)
- **Stockage** : 20 GB minimum
- **Sécurité** : Groupe de sécurité avec ports 22, 80, 443, 8000

### Configuration recommandée
```bash
# Instance EC2
Instance Type: t3.medium
Storage: 20 GB gp3
Security Group: 
  - SSH (22)
  - HTTP (80)
  - HTTPS (443)
  - Custom TCP (8000)
```

## 🚀 Déploiement rapide

### Option 1: Script automatique
```bash
# Cloner le projet
git clone <repository-url>
cd backend/python-server

# Rendre le script exécutable
chmod +x deploy.sh

# Déployer automatiquement
./deploy.sh
```

### Option 2: AWS CodeDeploy
```bash
# Créer une application CodeDeploy
aws deploy create-application --application-name prospec-python-server

# Créer un groupe de déploiement
aws deploy create-deployment-group \
  --application-name prospec-python-server \
  --deployment-group-name prospec-python-server-group \
  --service-role-arn arn:aws:iam::ACCOUNT:role/CodeDeployServiceRole

# Déployer
aws deploy create-deployment \
  --application-name prospec-python-server \
  --deployment-group-name prospec-python-server-group \
  --s3-location bucket=BUCKET,key=appspec.yml,bundleType=YAML
```

## 🔧 Configuration manuelle

### 1. Installation des dépendances système
```bash
# Mise à jour
sudo apt-get update

# Installation des paquets
sudo apt-get install -y \
  python3 \
  python3-pip \
  python3-venv \
  nginx \
  supervisor \
  curl \
  git \
  htop \
  ufw \
  fail2ban
```

### 2. Configuration du firewall
```bash
# Activer UFW
sudo ufw --force enable

# Règles de base
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 8000/tcp
```

### 3. Configuration de l'environnement
```bash
# Créer le répertoire du projet
sudo mkdir -p /opt/prospec-python-server
sudo chown ubuntu:ubuntu /opt/prospec-python-server

# Créer les sous-répertoires
mkdir -p /opt/prospec-python-server/{logs,certs,temp,config}
```

### 4. Installation Python
```bash
cd /opt/prospec-python-server

# Créer l'environnement virtuel
python3 -m venv venv
source venv/bin/activate

# Installer les dépendances
pip install --upgrade pip
pip install -r requirements.txt
```

### 5. Configuration Supervisor
```bash
# Créer la configuration
sudo tee /etc/supervisor/conf.d/prospec-python-server.conf > /dev/null << EOF
[program:prospec-python-server]
command=/opt/prospec-python-server/venv/bin/python /opt/prospec-python-server/audio_streaming_server.py
directory=/opt/prospec-python-server
user=ubuntu
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/opt/prospec-python-server/logs/supervisor.log
environment=PYTHONUNBUFFERED=1
EOF

# Recharger Supervisor
sudo supervisorctl reread
sudo supervisorctl update
```

### 6. Configuration Nginx
```bash
# Créer la configuration du site
sudo tee /etc/nginx/sites-available/prospec-python-server > /dev/null << EOF
server {
    listen 80;
    server_name _;
    
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
sudo ln -sf /etc/nginx/sites-available/prospec-python-server /etc/nginx/sites-enabled/

# Tester et redémarrer Nginx
sudo nginx -t
sudo systemctl restart nginx
```

## 🔒 Configuration SSL (optionnel)

### Avec Let's Encrypt
```bash
# Installer Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Obtenir un certificat
sudo certbot --nginx -d votre-domaine.com

# Configuration automatique du renouvellement
sudo crontab -e
# Ajouter: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Avec certificats personnalisés
```bash
# Copier les certificats
sudo cp cert.pem /opt/prospec-python-server/certs/
sudo cp key.pem /opt/prospec-python-server/certs/

# Mettre à jour la configuration
# Modifier le fichier .env pour activer SSL
```

## 📊 Monitoring et surveillance

### Script de surveillance automatique
```bash
# Créer le script de surveillance
cat > /opt/prospec-python-server/monitor.sh << 'EOF'
#!/bin/bash
LOG_FILE="/opt/prospec-python-server/logs/monitor.log"
SERVICE_NAME="prospec-python-server"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" >> $LOG_FILE
}

# Vérifier le service
if ! supervisorctl status $SERVICE_NAME | grep -q "RUNNING"; then
    log "ERROR: Service non en cours d'exécution"
    supervisorctl restart $SERVICE_NAME
fi

# Vérifier la mémoire
MEMORY_USAGE=$(free | grep Mem | awk '{printf "%.2f", $3/$2 * 100.0}')
if (( $(echo "$MEMORY_USAGE > 80" | bc -l) )); then
    log "WARNING: Mémoire élevée: ${MEMORY_USAGE}%"
fi
EOF

chmod +x /opt/prospec-python-server/monitor.sh

# Ajouter au crontab
(crontab -l 2>/dev/null; echo "*/5 * * * * /opt/prospec-python-server/monitor.sh") | crontab -
```

### Logs et debugging
```bash
# Voir les logs du service
tail -f /opt/prospec-python-server/logs/audio_server.log

# Voir les logs Supervisor
tail -f /opt/prospec-python-server/logs/supervisor.log

# Voir les logs Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Vérifier le statut du service
supervisorctl status prospec-python-server
```

## 🔧 Commandes utiles

### Gestion du service
```bash
# Démarrer
sudo supervisorctl start prospec-python-server

# Arrêter
sudo supervisorctl stop prospec-python-server

# Redémarrer
sudo supervisorctl restart prospec-python-server

# Voir le statut
sudo supervisorctl status prospec-python-server
```

### Logs et debugging
```bash
# Logs en temps réel
tail -f /opt/prospec-python-server/logs/audio_server.log

# Vérifier les ports
sudo netstat -tulpn | grep :8000

# Tester la connectivité
curl -f http://localhost:8000/health

# Vérifier les processus
ps aux | grep python
```

### Maintenance
```bash
# Sauvegarder les logs
cp /opt/prospec-python-server/logs/audio_server.log /opt/prospec-python-server/logs/backup_$(date +%Y%m%d_%H%M%S).log

# Nettoyer les anciens logs
find /opt/prospec-python-server/logs -name "*.log" -mtime +7 -delete

# Vérifier l'espace disque
df -h /opt
```

## 🚨 Dépannage

### Problèmes courants

1. **Service ne démarre pas**
   ```bash
   # Vérifier les logs
   tail -f /opt/prospec-python-server/logs/supervisor.log
   
   # Vérifier les dépendances
   source /opt/prospec-python-server/venv/bin/activate
   python3 -c "import aiohttp, socketio, aiortc"
   ```

2. **Port 8000 non accessible**
   ```bash
   # Vérifier le firewall
   sudo ufw status
   
   # Vérifier les processus
   sudo netstat -tulpn | grep :8000
   ```

3. **Erreurs de permissions**
   ```bash
   # Corriger les permissions
   sudo chown -R ubuntu:ubuntu /opt/prospec-python-server
   sudo chmod -R 755 /opt/prospec-python-server
   ```

4. **Problèmes de mémoire**
   ```bash
   # Vérifier l'utilisation mémoire
   free -h
   
   # Redémarrer le service
   sudo supervisorctl restart prospec-python-server
   ```

## 📈 Optimisation des performances

### Configuration système
```bash
# Augmenter les limites de fichiers
echo "* soft nofile 65536" | sudo tee -a /etc/security/limits.conf
echo "* hard nofile 65536" | sudo tee -a /etc/security/limits.conf

# Optimiser la mémoire
echo "vm.swappiness=10" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### Configuration Python
```bash
# Variables d'environnement optimisées
export PYTHONUNBUFFERED=1
export PYTHONOPTIMIZE=1
export PYTHONDONTWRITEBYTECODE=1
```

## 🔄 Mise à jour

### Mise à jour automatique
```bash
# Créer un script de mise à jour
cat > /opt/prospec-python-server/update.sh << 'EOF'
#!/bin/bash
cd /opt/prospec-python-server
git pull
source venv/bin/activate
pip install -r requirements.txt
sudo supervisorctl restart prospec-python-server
EOF

chmod +x /opt/prospec-python-server/update.sh
```

### Mise à jour manuelle
```bash
# Arrêter le service
sudo supervisorctl stop prospec-python-server

# Mettre à jour le code
cd /opt/prospec-python-server
git pull

# Mettre à jour les dépendances
source venv/bin/activate
pip install -r requirements.txt

# Redémarrer le service
sudo supervisorctl start prospec-python-server
```

## ✅ Vérification du déploiement

### Tests de connectivité
```bash
# Test local
curl -f http://localhost:8000/health

# Test via Nginx
curl -f http://localhost/health

# Test WebSocket
curl -f -I http://localhost:8000/socket.io/
```

### Tests de performance
```bash
# Test de charge simple
ab -n 100 -c 10 http://localhost:8000/health

# Test de mémoire
htop

# Test de réseau
iperf3 -c localhost -p 8000
```

## 📞 Support

En cas de problème :
1. Vérifier les logs : `/opt/prospec-python-server/logs/`
2. Vérifier le statut : `sudo supervisorctl status`
3. Vérifier la connectivité : `curl -f http://localhost:8000/health`
4. Vérifier les ressources : `htop`, `df -h`

Le serveur Python est maintenant optimisé pour AWS Ubuntu et prêt pour la production ! 🚀 